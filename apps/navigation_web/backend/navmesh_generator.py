"""
backend.navmesh_generator

Automatically generate a navigation graph from hall and corridor polygons.

Key improvements:
- Smaller corridor step size for denser nodes (80px instead of 140px)
- Better component bridging with larger link distance
- More walkability samples for accurate path validation
- Improved corridor grid connectivity

Notes:
- Creates destination nodes for the 26 halls
- Creates dense navigation nodes in corridors for realistic routing
- Supports dynamic edge weights (crowd multipliers)
- All edges are bidirectional
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Tuple


def _dist(a: Dict[str, float], b: Dict[str, float]) -> float:
    dx = a["x"] - b["x"]
    dy = a["y"] - b["y"]
    return math.hypot(dx, dy)


def _point_in_poly(x: float, y: float, poly: List[List[float]]) -> bool:
    """Ray casting point-in-polygon."""
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
        corridor_step_px: int = 80,  # REDUCED from 140 for more nodes
        segment_size_px: int = 300,
        max_corridor_nodes: int = 3000,  # INCREASED from 1800
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

        # Connect corridor "islands" so paths exist across the whole building
        self._connect_corridor_components(
            max_link_dist_px=max(6.0 * self.corridor_step_px, 800.0),  # INCREASED from 4x/650
            force_bridge=False,
        )

        self._connect_rooms_to_corridors(k=8)  # INCREASED from 6
        self._create_or_connect_entrance()

        print(f"Generated {len(self.nodes)} nodes and {len(self.edges)} edges")

        return {
            "nodes": self.nodes,
            "edges": self.edges,
            "rooms_metadata": self._extract_room_metadata(),
            "corridor_polygons": self.corridors,
        }

    # -------------------------
    # Node creation
    # -------------------------

    def _create_room_nodes(self) -> None:
        # Deterministic ordering without relying on HALL_NAMES
        def _sort_key(r: Dict) -> Tuple[str, float]:
            name = (r.get("name") or "").strip().lower()
            area = float(r.get("_area", 0) or 0)
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
            print("WARNING: No corridors detected - check SVG corridor colors")
            return {}

        step = max(40, int(self.corridor_step_px))

        # First, ensure we actually sample at least a few corridor nodes.
        for _ in range(6):
            grid_map, node_count = self._try_sample_corridors(step)
            if node_count > 0:
                break
            step = max(20, int(step * 0.7))

        # Then, if we still exceed the cap, increase step size.
        for _ in range(6):
            grid_map, node_count = self._try_sample_corridors(step)
            if 0 < node_count <= self.max_corridor_nodes:
                self.corridor_step_px = step
                print(f"Corridor sampling: {node_count} nodes with step size {step}px")
                return grid_map
            if node_count == 0:
                step = max(20, int(step * 0.7))
            else:
                step = int(step * 1.35)

        # last attempt (return whatever we got)
        self.corridor_step_px = step
        grid_map, node_count = self._try_sample_corridors(step)
        print(f"Corridor sampling: {node_count} nodes with step size {step}px (capped)")
        return grid_map

    def _try_sample_corridors(self, step: int) -> Tuple[Dict[Tuple[int, int], str], int]:
        # Compute overall bounds of corridor polygons
        if not self.corridors:
            return {}, 0
            
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
        """Create a single entrance node (Entrance 0) and connect it to corridor network."""
        entrance_id = "entrance_0"

        existing = next((n for n in self.nodes if n["id"] == entrance_id), None)
        if existing:
            entrance_node = existing
        else:
            # If entrances exist, use the first; else default to leftmost corridor node
            if self.entrances and isinstance(self.entrances[0], dict):
                e0 = self.entrances[0]
                if "position" in e0 and isinstance(e0["position"], dict):
                    ex = float(e0["position"]["x"])
                    ey = float(e0["position"]["y"])
                else:
                    ex = float(e0.get("x", 0.0))
                    ey = float(e0.get("y", 0.0))
                entrance_pos = {"x": ex, "y": ey}
            else:
                corridor_nodes = [n for n in self.nodes if n["type"] == "corridor"]
                if not corridor_nodes:
                    print("WARNING: No corridor nodes - cannot create entrance")
                    return
                corridor_nodes.sort(key=lambda n: (n["position"]["x"], n["position"]["y"]))
                entrance_pos = corridor_nodes[0]["position"]

            entrance_node = {
                "id": entrance_id,
                "type": "entrance",
                "name": "Entrance 0",
                "position": {"x": float(entrance_pos["x"]), "y": float(entrance_pos["y"])},
                "is_destination": True,
            }
            self.nodes.append(entrance_node)

        corridor_nodes = [n for n in self.nodes if n["type"] == "corridor"]
        if not corridor_nodes:
            return

        # Connect entrance to nearest corridor nodes
        dists = []
        for corr in corridor_nodes:
            d = _dist(entrance_node["position"], corr["position"])
            dists.append((d, corr))
        dists.sort(key=lambda x: x[0])

        added = 0
        for dist_val, corr in dists[:15]:  # INCREASED from 12
            if self._segment_walkable(entrance_node["position"], corr["position"], samples=11):  # INCREASED from 7
                self._add_edge_bidir(entrance_node["id"], corr["id"], float(dist_val))
                added += 1

        if added == 0 and dists:
            dist_val, corr = dists[0]
            self._add_edge_bidir(entrance_node["id"], corr["id"], float(dist_val))
            print("Forced entrance connection (walkability failed)")

    # -------------------------
    # Connectivity
    # -------------------------

    def _connect_corridor_grid(self, grid_map: Dict[Tuple[int, int], str]) -> None:
        """Connect corridor nodes along the sampling grid to avoid jumping across gaps."""
        if not grid_map:
            return

        step = float(self.corridor_step_px)
        neighbor_offsets = [
            # 1-step neighbors (adjacent)
            (1, 0, step),
            (0, 1, step),
            (1, 1, math.hypot(step, step)),
            (1, -1, math.hypot(step, step)),

            # 2-step neighbors (bridge small gaps)
            (2, 0, 2 * step),
            (0, 2, 2 * step),
            (2, 1, math.hypot(2 * step, step)),
            (1, 2, math.hypot(step, 2 * step)),
            (2, 2, math.hypot(2 * step, 2 * step)),
            (2, -1, math.hypot(2 * step, step)),
            (1, -2, math.hypot(step, 2 * step)),
            
            # 3-step neighbors (bridge larger gaps) - NEW
            (3, 0, 3 * step),
            (0, 3, 3 * step),
        ]

        node_pos = {n["id"]: n["position"] for n in self.nodes}

        def corridor_ok(mx: float, my: float) -> bool:
            for poly in self._corridor_polys:
                if _point_in_poly(mx, my, poly):
                    return True
            return False

        edges_added = 0
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
                # Ensure corridor edges never cut through halls/open space (corridor-only visibility)
                if not self._segment_walkable_corridor_only(node_pos[nid], node_pos[other], samples=9):
                    continue


                self._add_edge_bidir(nid, other, float(w))
                edges_added += 1

        print(f"Corridor grid connectivity: {edges_added} edge pairs")

    def _connect_corridor_components(
        self,
        max_link_dist_px: Optional[float] = None,
        links_per_merge: int = 3,  # INCREASED from 2
        force_bridge: bool = True,
    ) -> None:
        """
        Bridge disconnected corridor components ("islands") by connecting closest nodes across components.

        If force_bridge=True, it connects the closest pair even if walkability sampling fails.
        """
        corridor_nodes = [n for n in self.nodes if n["type"] == "corridor"]
        if len(corridor_nodes) < 2:
            return

        step = float(self.corridor_step_px)
        if max_link_dist_px is None:
            max_link_dist_px = max(2.5 * step, 320.0)

        corridor_ids = {n["id"] for n in corridor_nodes}

        # Build undirected adjacency from current corridor edges
        adj = {cid: set() for cid in corridor_ids}
        for e in self.edges:
            a, b = e["from"], e["to"]
            if a in corridor_ids and b in corridor_ids:
                adj[a].add(b)
                adj[b].add(a)

        def _components() -> List[set]:
            seen = set()
            comps: List[set] = []
            for cid in corridor_ids:
                if cid in seen:
                    continue
                stack = [cid]
                seen.add(cid)
                comp = set([cid])
                while stack:
                    u = stack.pop()
                    for v in adj[u]:
                        if v not in seen:
                            seen.add(v)
                            comp.add(v)
                            stack.append(v)
                comps.append(comp)
            return comps

        node_pos = {n["id"]: n["position"] for n in corridor_nodes}
        comps = _components()
        
        if len(comps) > 1:
            print(f"Found {len(comps)} disconnected corridor components - bridging...")
        
        merged_any = True
        iterations = 0
        while len(comps) > 1 and merged_any and iterations < 20:  # Added iteration limit
            iterations += 1
            merged_any = False
            comps.sort(key=len, reverse=True)
            main = comps[0]
            others = comps[1:]

            for comp in others:
                candidates: List[Tuple[float, str, str]] = []
                for a in main:
                    pa = node_pos[a]
                    for b in comp:
                        pb = node_pos[b]
                        d = _dist(pa, pb)
                        if d <= float(max_link_dist_px):
                            candidates.append((d, a, b))

                if not candidates:
                    continue

                candidates.sort(key=lambda t: t[0])

                added = 0
                best_fallback = candidates[0]

                for d, a, b in candidates:
                    if self._segment_walkable_corridor_only(node_pos[a], node_pos[b], samples=13):  # INCREASED from 9
                        self._add_edge_bidir(a, b, float(d))
                        adj[a].add(b)
                        adj[b].add(a)
                        added += 1
                        if added >= int(links_per_merge):
                            break

                if added == 0 and force_bridge:
                    d, a, b = best_fallback
                    self._add_edge_bidir(a, b, float(d))
                    adj[a].add(b)
                    adj[b].add(a)
                    added = 1

                if added > 0:
                    merged_any = True

            comps = _components()

        final_comps = _components()
        if len(final_comps) > 1:
            print(f"WARNING: {len(final_comps)} corridor components remain disconnected")
        else:
            print("All corridor components connected successfully")

    def _connect_rooms_to_corridors(self, k: int = 8) -> None:  # INCREASED from 6
        """Connect each room node to k nearest corridor nodes."""
        room_nodes = [n for n in self.nodes if n["type"] == "room"]
        corridor_nodes = [n for n in self.nodes if n["type"] == "corridor"]

        if not room_nodes or not corridor_nodes:
            print("WARNING: Cannot connect rooms to corridors - missing nodes")
            return

        for room in room_nodes:
            rx, ry = room["position"]["x"], room["position"]["y"]

            dists = []
            for corr in corridor_nodes:
                cx, cy = corr["position"]["x"], corr["position"]["y"]
                d = math.hypot(rx - cx, ry - cy)
                dists.append((d, corr))

            dists.sort(key=lambda x: x[0])

            added = 0
            for dist_val, corr in dists[: max(k, 1) * 5]:  # INCREASED search space
                if self._segment_walkable(room["position"], corr["position"], samples=11):  # INCREASED from 7
                    self._add_edge_bidir(room["id"], corr["id"], float(dist_val))
                    added += 1
                    if added >= k:
                        break

            if added == 0 and dists:
                dist_val, corr = dists[0]
                self._add_edge_bidir(room["id"], corr["id"], float(dist_val))
                print(f"Forced connection for {room.get('name', room['id'])} (walkability failed)")

    # -------------------------
    # Room metadata
    # -------------------------

    def _extract_room_metadata(self) -> List[Dict]:
        """Return room metadata used by frontend + telemetry mapping."""
        rooms = []
        for n in self.nodes:
            if n["type"] != "room":
                continue
            rooms.append(
                {
                    "id": n["id"],
                    "name": n.get("name", n["id"]),
                    "bounds": n.get("bounds"),
                    "center": n.get("position"),
                }
            )
        return rooms

    # -------------------------
    # Walkability
    # -------------------------

    def _in_any_corridor(self, x: float, y: float) -> bool:
        for poly in self._corridor_polys:
            if _point_in_poly(x, y, poly):
                return True
        return False

    def _in_any_hall(self, x: float, y: float) -> bool:
        for poly in self._hall_polys:
            if _point_in_poly(x, y, poly):
                return True
        return False

    def _segment_walkable(self, a: Dict[str, float], b: Dict[str, float], samples: int = 11) -> bool:  # INCREASED from 7
        """Check if a straight line segment between two points is walkable."""
        ax, ay = a["x"], a["y"]
        bx, by = b["x"], b["y"]

        for i in range(samples + 1):
            t = i / float(samples)
            x = ax + (bx - ax) * t
            y = ay + (by - ay) * t

            if not (self._in_any_corridor(x, y) or self._in_any_hall(x, y)):
                return False

        return True
    def _segment_walkable_corridor_only(self, a: Dict[str, float], b: Dict[str, float], samples: int = 21) -> bool:
        """Corridor-only walkability for corridor edges and path smoothing.

        Allows halls only at the endpoints (so routes may start/end inside rooms),
        but otherwise the segment must stay within corridor polygons.
        """
        ax, ay = a["x"], a["y"]
        bx, by = b["x"], b["y"]

        for i in range(samples + 1):
            t = i / float(samples)
            x = ax + (bx - ax) * t
            y = ay + (by - ay) * t

            if self._in_any_corridor(x, y):
                continue

            if (i == 0 or i == samples) and self._in_any_hall(x, y):
                continue

            return False

        return True



    # -------------------------
    # IoT weight updates
    # -------------------------

    def update_edge_weights_from_iot(self, sensor_data: Dict[str, float]) -> None:
        """
        Apply crowd multipliers to corridor edges by segment_id.
        sensor_data is expected like: {"corr_seg_12_8": 1.35, ...} or {"room_0": 0.85, ...}
        """
        if not sensor_data:
            return

        node_by_id = {n["id"]: n for n in self.nodes}

        for e in self.edges:
            a = node_by_id.get(e["from"])
            b = node_by_id.get(e["to"])
            if not a or not b:
                continue

            # Check for direct node ID match (for room-based sensor data)
            mult = None
            if e["from"] in sensor_data:
                mult = float(sensor_data[e["from"]])
            elif e["to"] in sensor_data:
                mult = float(sensor_data[e["to"]])
            
            # Check for segment ID match (for corridor-based sensor data)
            if mult is None:
                if a.get("type") == "corridor" and b.get("type") == "corridor":
                    seg = a.get("segment_id") or b.get("segment_id")
                    if seg and seg in sensor_data:
                        mult = float(sensor_data[seg])

            if mult is not None:
                base = float(e.get("base_weight", e["weight"]))
                e["base_weight"] = base
                e["weight"] = base * mult
                e["effective_weight"] = base * mult  # Add for compatibility

    # -------------------------
    # Edge helpers
    # -------------------------

    def _add_edge_bidir(self, a: str, b: str, weight: float) -> None:
        """Add bidirectional edge with proper weight fields."""
        w = float(weight)
        self.edges.append({
            "from": a,
            "to": b,
            "weight": w,
            "base_weight": w,
            "effective_weight": w
        })
        self.edges.append({
            "from": b,
            "to": a,
            "weight": w,
            "base_weight": w,
            "effective_weight": w
        })
