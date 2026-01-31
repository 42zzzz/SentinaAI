"""backend.app

Flask backend for the Convention Center Navigation system.

This backend:
- Parses an SVG floor plan into hall (room) polygons and corridor polygons.
- Generates a navigation graph (navmesh).
- Computes shortest paths using Dijkstra's algorithm.
- Supports dynamic edge weights via IoT crowd/occupancy updates.

Environment variables:
- CONVENTION_SVG_PATH: Optional absolute/relative path to the SVG floor plan.

Run:
  cd convention_navmesh/backend
  py app.py
"""

from __future__ import annotations

import inspect
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from svg_parser import SVGParser
from coordinate_transformer import CoordinateTransformer, extract_geojson_bounds
from navmesh_generator import NavMeshGenerator
from pathfinder import DijkstraPathfinder


app = Flask(__name__, static_folder="../frontend", static_url_path="/static")
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
CORS(app)


@app.after_request
def _no_cache_static(resp):
    # Avoid browser 304 caching while you iterate on frontend files
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

# Global state
navmesh_data: Optional[Dict] = None
transformer: Optional[CoordinateTransformer] = None
pathfinder: Optional[DijkstraPathfinder] = None
iot_sensor_data: Dict[str, float] = {}


def _resolve_svg_path() -> Path:
    env_path = os.environ.get("CONVENTION_SVG_PATH")
    if env_path:
        p = Path(env_path).expanduser().resolve()
        if p.exists():
            return p

    backend_dir = Path(__file__).resolve().parent
    candidate_1 = (backend_dir.parent / "convention_map.svg").resolve()
    if candidate_1.exists():
        return candidate_1

    candidate_2 = (Path.cwd() / "convention_map.svg").resolve()
    if candidate_2.exists():
        return candidate_2

    return candidate_1


def _looks_like_geometry_dict(obj: Any) -> bool:
    """Heuristic: geometry dict should have dimensions + rooms/corridors keys."""
    if not isinstance(obj, dict):
        return False
    if "dimensions" not in obj:
        return False
    dims = obj.get("dimensions")
    if not isinstance(dims, dict) or "width" not in dims or "height" not in dims:
        return False
    # rooms/corridors may be empty but keys should exist (or at least one)
    return ("rooms" in obj) or ("corridors" in obj) or ("entrances" in obj)


def _extract_geometry_from_parser(parser: Any) -> Dict:
    """
    Robustly extract geometry from an unknown SVGParser implementation.

    Strategy:
    1) Try a list of common method names.
    2) If none exist, try calling every public zero-arg method and accept the first
       one that returns a dict that looks like the expected geometry_data.
    """
    common_names = [
        "extract_all",
        "parse",
        "extract",
        "run",
        "process",
        "get_geometry",
        "extract_geometry",
        "extract_geometry_data",
        "extract_shapes",
        "extract_polygons",
        "build",
        "build_geometry",
        "to_dict",
    ]

    # 1) Try common names first
    for name in common_names:
        fn = getattr(parser, name, None)
        if callable(fn):
            try:
                result = fn()
                if _looks_like_geometry_dict(result):
                    return result
            except TypeError:
                # method needs args; skip
                continue
            except Exception:
                # method exists but failed; keep trying others
                continue

    # 2) Try any public zero-arg method
    candidates = []
    for name in dir(parser):
        if name.startswith("_"):
            continue
        fn = getattr(parser, name, None)
        if not callable(fn):
            continue

        # Only consider methods that can be called without args
        try:
            sig = inspect.signature(fn)
        except Exception:
            continue

        # bound method: no params means callable with ()
        if any(
            p.default is inspect._empty and p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)
            for p in sig.parameters.values()
        ):
            # has required params -> skip
            continue

        candidates.append(name)

    # Try in deterministic order
    for name in sorted(candidates):
        fn = getattr(parser, name)
        try:
            result = fn()
            if _looks_like_geometry_dict(result):
                return result
        except Exception:
            continue

    # If we reach here, show helpful debug info
    public_methods = [n for n in dir(parser) if not n.startswith("_") and callable(getattr(parser, n, None))]
    raise AttributeError(
        "Could not find any SVGParser method that returns the expected geometry dict. "
        f"Public methods available on SVGParser: {public_methods}"
    )


def initialize_system() -> None:
    global navmesh_data, transformer, pathfinder

    svg_path = _resolve_svg_path()

    print("Initializing Convention Center Navigation System")
    print(f"Using SVG: {svg_path}")

    if not svg_path.exists():
        raise FileNotFoundError(
            f"SVG file not found at {svg_path}. Set CONVENTION_SVG_PATH to override."
        )

    # 1) Parse SVG (ROBUST)
    parser = SVGParser(str(svg_path))
    geometry_data = _extract_geometry_from_parser(parser)

    # Corridors (fix undefined variable)
    corridors = geometry_data.get("corridors", [])
    if not corridors:
        print("WARNING: No corridors detected")

    # 2) Setup coordinate transformer (GeoJSON bounds provide real-world scaling)
    geojson_str = (
        '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},'
        '"geometry":{"coordinates":[[[55.28514167811778,25.221544615013386],'
        '[55.285686028545314,25.22123340829775],[55.28616814714442,25.221948974483112],'
        '[55.28827305653181,25.220899043260104],[55.29181204995919,25.225541532185503],'
        '[55.29026162371224,25.227136599916307],[55.2890019971085,25.226140196693052],'
        '[55.28699133263294,25.22713370705307],[55.28514635183484,25.224359979970103],'
        '[55.28401929803499,25.22246726320094],[55.285294274281426,25.22176237175553],'
        '[55.28514167811778,25.221544615013386]]],"type":"Polygon"}}]}'
    )
    geojson_data = json.loads(geojson_str)
    bounds = extract_geojson_bounds(geojson_data)

    transformer = CoordinateTransformer(
        svg_dimensions=(
            geometry_data["dimensions"]["width"],
            geometry_data["dimensions"]["height"],
        ),
        geojson_bounds=bounds,
    )

    # 3) Generate navmesh
    generator = NavMeshGenerator(
        rooms=geometry_data.get("rooms", []),
        corridors=corridors,
        entrances=geometry_data.get("entrances", []),
    )
    navmesh_data = generator.generate()

    # Keep references for IoT updates
    navmesh_data["transformer"] = transformer
    navmesh_data["generator"] = generator

    # 4) Initialize pathfinder
    pathfinder = DijkstraPathfinder(navmesh_data["nodes"], navmesh_data["edges"])

    print("System initialized")
    print(f"Nodes: {len(navmesh_data['nodes'])}")
    print(f"Edges: {len(navmesh_data['edges'])}")
    print(f"Rooms: {len(navmesh_data['rooms_metadata'])}")


@app.route("/api/navmesh", methods=["GET"])
def get_navmesh():
    if not navmesh_data or not transformer:
        return jsonify({"error": "System not initialized"}), 500

    response = {
        "nodes": navmesh_data["nodes"],
        "edges": navmesh_data["edges"],
        "rooms": navmesh_data["rooms_metadata"],
        "scale_info": transformer.get_scale_info(),
    }
    return jsonify(response)


@app.route("/api/rooms", methods=["GET"])
def get_rooms():
    if not navmesh_data:
        return jsonify({"error": "System not initialized"}), 500
    return jsonify(navmesh_data["rooms_metadata"])


@app.route("/api/pathfind", methods=["POST"])
def calculate_path():
    if not pathfinder or not transformer:
        return jsonify({"error": "System not initialized"}), 500

    data = request.json or {}
    start_id = data.get("start")
    end_id = data.get("end")

    if not start_id or not end_id:
        return jsonify({"error": "start and end required"}), 400

    try:
        path = pathfinder.find_path(start_id, end_id)
        if not path:
            return jsonify({"error": "No path found"}), 404

        path_coords = [pathfinder.nodes[node_id]["position"] for node_id in path]

        total_distance_pixels = pathfinder.get_path_distance(path)
        total_distance_meters = total_distance_pixels * transformer.meters_per_pixel

        return jsonify(
            {
                "success": True,
                "path": path,
                "path_coordinates": path_coords,
                "distance": {
                    "pixels": round(total_distance_pixels, 2),
                    "meters": round(total_distance_meters, 2),
                },
                "node_count": len(path),
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/iot/update", methods=["POST"])
def update_iot_sensors():
    if not navmesh_data or not pathfinder:
        return jsonify({"error": "System not initialized"}), 500

    data = request.json or {}
    sensor_data = data.get("sensor_data", {})

    # Update global sensor state
    iot_sensor_data.update(sensor_data)

    # Update navmesh edge weights
    navmesh_data["generator"].update_edge_weights_from_iot(iot_sensor_data)

    # Refresh pathfinder with new weights
    pathfinder.update_weights(navmesh_data["edges"])

    return jsonify(
        {
            "success": True,
            "updated_nodes": len(sensor_data),
            "message": "Edge weights updated based on crowd density",
        }
    )


@app.route("/api/iot/data", methods=["GET"])
def get_iot_data():
    return jsonify(iot_sensor_data)


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify(
        {
            "status": "healthy",
            "system_initialized": navmesh_data is not None,
            "nodes": len(navmesh_data["nodes"]) if navmesh_data else 0,
            "edges": len(navmesh_data["edges"]) if navmesh_data else 0,
            "rooms": len(navmesh_data["rooms_metadata"]) if navmesh_data else 0,
        }
    )


@app.route("/")
def serve_frontend():
    return send_from_directory(app.static_folder, "index.html")


@app.errorhandler(404)
def not_found(_):
    return send_from_directory(app.static_folder, "index.html")



@app.errorhandler(404)
def spa_fallback(e):
    path = request.path or ""
    # Do not fallback for API or static assets
    if path.startswith("/api/") or path.startswith("/static/"):
        return jsonify({"error": "not found", "path": path}), 404
    frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
    return send_from_directory(frontend_dir, "index.html")

if __name__ == "__main__":
    initialize_system()
    print("Starting Flask server on http://localhost:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)
