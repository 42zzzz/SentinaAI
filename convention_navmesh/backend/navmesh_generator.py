"""
backend.navmesh_generator

Automatically generate a navigation graph from hall and corridor polygons.

Key requirements for this project:
- Create destination nodes for the 26 halls (exact names).
- Create dense navigation nodes in corridors/hallways for realistic routing.
- Keep corridors visually unified, but assign internal corridor "segments" for IoT weighting.
- Keep graph edges bidirectional and support dynamic edge weights (crowd multipliers).

Notes:
- This generator uses grid sampling within the corridor polygons. It does not do full collision testing
  against wall strokes; the corridor polygons are treated as the walkable domain.
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Tuple

def _dist(a: Dict[str, float], b: Dict[str, float]) -> float:
    dx = a["x"] - b["x"]
    dy = a["y"] - b["y"]
    return math.hypot(dx, dy)


def _point_in_poly(x: float, y: float, poly: List[List[float]]) -> bool:
    inside = False
    n = len(poly)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / ((yj - yi) if (yj - yi) != 0 else 1e-12) + xi
        ):
            inside = not inside
        j = i
    return inside


class NavMeshGenerator:
    """Generate a navigation mesh (graph) from room and corridor polygons."""

    def __init__(
        self,
        rooms: List[Dict],
        corridors: List[Dict],
        entrances: Optional[List[Dict]] = None,
        corridor_step_px: int = 140,
        segment_size_px: int = 300,
        max_corridor_nodes: int = 1800,
    ):
        self.rooms = rooms
        self.corridors = corridors
        self.entrances = entrances or []
        self.corridor_step_px = int(corridor_step_px)
        self.segment_size_px = int(segment_size_px)
        self.max_corridor_nodes = int(max_corridor_nodes)

        self.nodes: List[Dict] = []
        self.edges: List[Dict] = []

        # Cached for walkability checks
        self._hall_polys: List[List[List[float]]] = []
        self._corridor_polys: List[List[List[float]]] = [c["polygon"] for c in (corridors or [])]

    def generate(self) -> Dict:
        print("Generating navigation mesh")

        self._create_room_nodes()
        self._hall_polys = [n["polygon"] for n in self.nodes if n["type"] == "room"]

        corridor_node_map = self._create_corridor_nodes_dense_with_cap()
        self._connect_corridor_grid(corridor_node_map)
        self._connect_rooms_to_corridors(k=6)
        self._create_or_connect_entrance()

        print(f"Generated {len(self.nodes)} nodes and {len(self.edges)} edges")

        return {
            "nodes": self.nodes,
            "edges": self.edges,
            "rooms_metadata": self._extract_room_metadata(),
            "corridor_polygons": self.corridors,  # Add original corridor shapes for rendering
        }

    # -------------------------
    # Node creation
    # -------------------------

    def _create_room_nodes(self) -> None:
        # Deterministic ordering without relying on HALL_NAMES
        def _sort_key(r):
            name = (r.get("name") or "").strip().lower()
            area = r.get("_area", 0)
            return (name, -area)

        sorted_rooms = sorted(self.rooms, key=_sort_key)

        for idx, room in enumerate(sorted_rooms):
            node = {
                "id": f"room_{idx}",
                "type": "room",
                "name": room.get("name", f"Room {idx + 1}"),
                "position": room["center"],
                "bounds": room["bounds"],
                "polygon": room["polygon"],
                "is_destination": True,
            }
            self.nodes.append(node)

    def _create_corridor_nodes_dense_with_cap(self) -> Dict[Tuple[int, int], str]:
        """
        Sample many nodes within corridor polygons using a regular grid, but avoid node explosion by
        adaptively increasing step size if too many nodes would be created.
        """
        if not self.corridors:
            return {}

        step = max(40, int(self.corridor_step_px))
        for _ in range(6):  # up to 6 increases if needed
            grid_map, node_count = self._try_sample_corridors(step)
            if node_count <= self.max_corridor_nodes:
                self.corridor_step_px = step
                return grid_map
            step = int(step * 1.35)

        # last attempt (return whatever we got)
        self.corridor_step_px = step
        grid_map, _ = self._try_sample_corridors(step)
        return grid_map


    def _try_sample_corridors(self, step: int) -> Tuple[Dict[Tuple[int, int], str], int]:
        # Compute overall bounds of corridor polygons
        min_x = min(c["bounds"]["x"] for c in self.corridors)
        min_y = min(c["bounds"]["y"] for c in self.corridors)
        max_x = max(c["bounds"]["x"] + c["bounds"]["width"] for c in self.corridors)
        max_y = max(c["bounds"]["y"] + c["bounds"]["height"] for c in self.corridors)

        grid_map: Dict[Tuple[int, int], str] = {}

        def in_any_corridor(px: float, py: float) -> bool:
            for poly in self._corridor_polys:
                if _point_in_poly(px, py, poly):
                    return True
            return False

        def in_any_hall(px: float, py: float) -> bool:
            for poly in self._hall_polys:
                if _point_in_poly(px, py, poly):
                    return True
            return False

        # Remove previously created corridor nodes if re-sampling
        self.nodes = [n for n in self.nodes if n["type"] != "corridor"]

        node_index = 0
        i0 = int(math.floor(min_x / step))
        i1 = int(math.ceil(max_x / step))
        j0 = int(math.floor(min_y / step))
        j1 = int(math.ceil(max_y / step))

        for gi in range(i0, i1 + 1):
            x = gi * step + step / 2
            for gj in range(j0, j1 + 1):
                y = gj * step + step / 2

                if not in_any_corridor(x, y):
                    continue
                # corridor nodes should not be inside halls (keeps room centers from being flooded)
                if in_any_hall(x, y):
                    continue

                seg_i = int(x // self.segment_size_px)
                seg_j = int(y // self.segment_size_px)
                segment_id = f"corr_seg_{seg_i}_{seg_j}"

                node_id = f"corridor_{node_index}"
                node_index += 1

                node = {
                    "id": node_id,
                    "type": "corridor",
                    "position": {"x": float(x), "y": float(y)},
                    "segment_id": segment_id,
                    "is_destination": False,
                }
                self.nodes.append(node)
                grid_map[(gi, gj)] = node_id

        return grid_map, node_index

    def _create_or_connect_entrance(self) -> None:
        """Create a single entrance node (Entrance 1) and connect it to corridor network."""
        entrance_pos = None
        if self.entrances:
            entrance_pos = self.entrances[0].get("center")

        # Otherwise pick the leftmost corridor node.
        if entrance_pos is None:
            corridor_nodes = [n for n in self.nodes if n["type"] == "corridor"]
            if corridor_nodes:
                corridor_nodes.sort(key=lambda n: (n["position"]["x"], n["position"]["y"]))
                entrance_pos = corridor_nodes[0]["position"]

        if entrance_pos is None:
            return

        # Avoid duplicating if regenerate() called multiple times
        self.nodes = [n for n in self.nodes if n.get("type") != "entrance"]

        entrance_node = {
            "id": "entrance_0",
            "type": "entrance",
            "name": "Entrance 1",
            "position": {"x": float(entrance_pos["x"]), "y": float(entrance_pos["y"])},
            "is_destination": True,
        }
        self.nodes.append(entrance_node)

        corridor_nodes = [n for n in self.nodes if n["type"] == "corridor"]
        if not corridor_nodes:
            return

        dists = [(_dist(entrance_node["position"], c["position"]), c) for c in corridor_nodes]
        dists.sort(key=lambda x: x[0])

        added = 0
        for dist_val, corr in dists[:12]:
            if self._segment_walkable(entrance_node["position"], corr["position"]):
                self._add_edge_bidir(entrance_node["id"], corr["id"], float(dist_val))
                added += 1

        if added == 0 and dists:
            # Fallback: connect to nearest even if walkability test fails (so entrance isn't isolated)
            dist_val, corr = dists[0]
            self._add_edge_bidir(entrance_node["id"], corr["id"], float(dist_val))

    # -------------------------
    # Connectivity
    # -------------------------

    def _connect_corridor_grid(self, grid_map: Dict[Tuple[int, int], str]) -> None:
        """Connect corridor nodes along the sampling grid to avoid jumping across gaps."""
        if not grid_map:
            return

        step = float(self.corridor_step_px)
        neighbor_offsets = [
            (1, 0, step),
            (0, 1, step),
            (1, 1, math.hypot(step, step)),
            (1, -1, math.hypot(step, step)),
        ]

        node_pos = {n["id"]: n["position"] for n in self.nodes}

        def corridor_ok(mx: float, my: float) -> bool:
            for poly in self._corridor_polys:
                if _point_in_poly(mx, my, poly):
                    return True
            return False

        for (gi, gj), nid in list(grid_map.items()):
            x1, y1 = node_pos[nid]["x"], node_pos[nid]["y"]
            for di, dj, w in neighbor_offsets:
                other = grid_map.get((gi + di, gj + dj))
                if not other:
                    continue

                x2, y2 = node_pos[other]["x"], node_pos[other]["y"]
                mx, my = (x1 + x2) / 2.0, (y1 + y2) / 2.0
                if not corridor_ok(mx, my):
                    continue

                self._add_edge_bidir(nid, other, float(w))

    def _connect_rooms_to_corridors(self, k: int = 6) -> None:
        corridor_nodes = [n for n in self.nodes if n["type"] == "corridor"]
        room_nodes = [n for n in self.nodes if n["type"] == "room"]
        if not corridor_nodes:
            return

        for room in room_nodes:
            dists = [(_dist(room["position"], c["position"]), c) for c in corridor_nodes]
            dists.sort(key=lambda x: x[0])

            connected = 0
            for dist_val, corr in dists[: max(k * 3, 18)]:  # try extra candidates; only keep walkable
                if self._segment_walkable(room["position"], corr["position"]):
                    self._add_edge_bidir(room["id"], corr["id"], float(dist_val))
                    connected += 1
                    if connected >= k:
                        break

            # Fallback: ensure every room connects at least once
            if connected == 0 and dists:
                dist_val, corr = dists[0]
                self._add_edge_bidir(room["id"], corr["id"], float(dist_val))

    # -------------------------
    # Walkability checks (simple, polygon-only)
    # -------------------------

    def _in_walkable(self, x: float, y: float) -> bool:
        # walkable if inside any corridor OR inside any hall (so room->corridor can pass through the hall)
        for poly in self._corridor_polys:
            if _point_in_poly(x, y, poly):
                return True
        for poly in self._hall_polys:
            if _point_in_poly(x, y, poly):
                return True
        return False

    def _segment_walkable(self, a: Dict[str, float], b: Dict[str, float], samples: int = 7) -> bool:
        # Sample points along the segment; all must remain inside walkable domain
        ax, ay = a["x"], a["y"]
        bx, by = b["x"], b["y"]
        for s in range(1, samples):
            t = s / samples
            x = ax + (bx - ax) * t
            y = ay + (by - ay) * t
            if not self._in_walkable(x, y):
                return False
        return True

    # -------------------------
    # Edges (bidirectional)
    # -------------------------

    def _edge_exists_directed(self, a: str, b: str) -> bool:
        for e in self.edges:
            if e["from"] == a and e["to"] == b:
                return True
        return False

    def _add_edge_directed(self, from_id: str, to_id: str, weight: float) -> None:
        if from_id == to_id:
            return
        if self._edge_exists_directed(from_id, to_id):
            return
        self.edges.append(
            {
                "from": from_id,
                "to": to_id,
                "weight": float(weight),
                "crowd_multiplier": 1.0,
                "effective_weight": float(weight),
            }
        )

    def _add_edge_bidir(self, a: str, b: str, weight: float) -> None:
        self._add_edge_directed(a, b, weight)
        self._add_edge_directed(b, a, weight)

    # -------------------------
    # Frontend dropdown metadata
    # -------------------------

    def _extract_room_metadata(self) -> List[Dict]:
        """Return metadata used by the frontend dropdowns."""
        metadata: List[Dict] = []
        for n in self.nodes:
            if n.get("is_destination"):
                metadata.append(
                    {
                        "id": n["id"],
                        "name": n.get("name", n["id"]),
                        "position": n["position"],
                        "is_selectable": True,
                    }
                )
        return metadata

    # -------------------------
    # IoT weighting
    # -------------------------

    def update_edge_weights_from_iot(self, sensor_data: Dict[str, float]) -> None:
        """Update effective edge weights based on IoT crowd density.

        sensor_data keys may be:
        - node ids (e.g., room_0, corridor_12)
        - destination names (e.g., "North Hall 1")
        - corridor segment ids (e.g., corr_seg_3_5)

        Values are expected in [0.0, 1.0].
        """
        node_by_id = {n["id"]: n for n in self.nodes}

        def density_for(node_id: str) -> float:
            n = node_by_id.get(node_id)
            if not n:
                return 0.0
            if node_id in sensor_data:
                return float(sensor_data.get(node_id, 0.0) or 0.0)
            name = n.get("name")
            if name and name in sensor_data:
                return float(sensor_data.get(name, 0.0) or 0.0)
            seg = n.get("segment_id")
            if seg and seg in sensor_data:
                return float(sensor_data.get(seg, 0.0) or 0.0)
            return 0.0

        for e in self.edges:
            d1 = density_for(e["from"])
            d2 = density_for(e["to"])
            avg = max(0.0, min(1.0, (d1 + d2) / 2.0))
            # Scale: 0% crowd = 1.0x, 100% crowd = 3.0x
            mult = 1.0 + avg * 2.0
            e["crowd_multiplier"] = mult
            e["effective_weight"] = float(e["weight"]) * mult
