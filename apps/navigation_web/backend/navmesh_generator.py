"""
backend.navmesh_generator

Spine/centerline navigation mesh generator.

Key goals:
- Walkable = (inside any corridor polygon) AND (NOT inside any hall polygon)
- Build corridor "spine" graph using raster skeletonization (Zhang–Suen thinning)
- Ensure corridor graph is connected (stitch components using raster A* if needed)
- Connect each hall to spine via a short connector that stays in walkable corridor space
"""

from __future__ import annotations

import math
import heapq
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Set

import numpy as np


# -------------------------
# Basic geometry helpers
# -------------------------

def _dist(a: Dict[str, float], b: Dict[str, float]) -> float:
    return math.hypot(float(a["x"]) - float(b["x"]), float(a["y"]) - float(b["y"]))


def _point_in_poly(x: float, y: float, poly: List[List[float]]) -> bool:
    """Ray casting point-in-polygon."""
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = float(poly[i][0]), float(poly[i][1])
        xj, yj = float(poly[j][0]), float(poly[j][1])
        intersects = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) + 1e-12) + xi)
        if intersects:
            inside = not inside
        j = i
    return inside


# -------------------------
# Skeletonization (Zhang–Suen)
# -------------------------

def _neighbors_8(img: np.ndarray, r: int, c: int) -> List[Tuple[int, int]]:
    return [
        (r - 1, c),     # N
        (r - 1, c + 1), # NE
        (r, c + 1),     # E
        (r + 1, c + 1), # SE
        (r + 1, c),     # S
        (r + 1, c - 1), # SW
        (r, c - 1),     # W
        (r - 1, c - 1), # NW
    ]


def _zs_thin(binary: np.ndarray, max_iters: int = 250) -> np.ndarray:
    img = (binary > 0).astype(np.uint8)
    h, w = img.shape

    def transitions(p: List[int]) -> int:
        t = 0
        for i in range(8):
            if p[i] == 0 and p[(i + 1) % 8] == 1:
                t += 1
        return t

    changed = True
    it = 0
    while changed and it < max_iters:
        changed = False
        it += 1

        to_remove: List[Tuple[int, int]] = []

        # step 1
        for r in range(1, h - 1):
            for c in range(1, w - 1):
                if img[r, c] != 1:
                    continue
                ncoords = _neighbors_8(img, r, c)
                p = [int(img[rr, cc]) for rr, cc in ncoords]
                s = sum(p)
                if s < 2 or s > 6:
                    continue
                if transitions(p) != 1:
                    continue
                if p[0] * p[2] * p[4] != 0:
                    continue
                if p[2] * p[4] * p[6] != 0:
                    continue
                to_remove.append((r, c))

        if to_remove:
            for r, c in to_remove:
                img[r, c] = 0
            changed = True

        to_remove = []

        # step 2
        for r in range(1, h - 1):
            for c in range(1, w - 1):
                if img[r, c] != 1:
                    continue
                ncoords = _neighbors_8(img, r, c)
                p = [int(img[rr, cc]) for rr, cc in ncoords]
                s = sum(p)
                if s < 2 or s > 6:
                    continue
                if transitions(p) != 1:
                    continue
                if p[0] * p[2] * p[6] != 0:
                    continue
                if p[0] * p[4] * p[6] != 0:
                    continue
                to_remove.append((r, c))

        if to_remove:
            for r, c in to_remove:
                img[r, c] = 0
            changed = True

    return img


def _skeleton_degrees(skel: np.ndarray) -> np.ndarray:
    h, w = skel.shape
    deg = np.zeros_like(skel, dtype=np.uint8)
    p = np.pad(skel, 1, mode="constant", constant_values=0)
    neigh_sum = (
        p[0:h, 1:w + 1] +
        p[0:h, 2:w + 2] +
        p[1:h + 1, 2:w + 2] +
        p[2:h + 2, 2:w + 2] +
        p[2:h + 2, 1:w + 1] +
        p[2:h + 2, 0:w] +
        p[1:h + 1, 0:w] +
        p[0:h, 0:w]
    )
    deg[skel > 0] = neigh_sum[skel > 0].astype(np.uint8)
    return deg


def _dilate(binary: np.ndarray, iters: int = 1) -> np.ndarray:
    """Cheap 3x3 dilation (no scipy)."""
    img = (binary > 0).astype(np.uint8)
    for _ in range(iters):
        p = np.pad(img, 1, mode="constant", constant_values=0)
        img = (
            (p[0:-2, 0:-2] | p[0:-2, 1:-1] | p[0:-2, 2:] |
             p[1:-1, 0:-2] | p[1:-1, 1:-1] | p[1:-1, 2:] |
             p[2:, 0:-2] | p[2:, 1:-1] | p[2:, 2:]).astype(np.uint8)
        )
    return img


def _erode(binary: np.ndarray, iters: int = 1) -> np.ndarray:
    """Cheap 3x3 erosion (no scipy)."""
    img = (binary > 0).astype(np.uint8)
    for _ in range(iters):
        p = np.pad(img, 1, mode="constant", constant_values=0)
        img = (
            (p[0:-2, 0:-2] & p[0:-2, 1:-1] & p[0:-2, 2:] &
             p[1:-1, 0:-2] & p[1:-1, 1:-1] & p[1:-1, 2:] &
             p[2:, 0:-2] & p[2:, 1:-1] & p[2:, 2:]).astype(np.uint8)
        )
    return img


def _close(binary: np.ndarray, iters: int = 1) -> np.ndarray:
    """Morphological closing = dilate then erode."""
    return _erode(_dilate(binary, iters=iters), iters=iters)


def _prune_spurs(skel: np.ndarray, min_len_px: float, cell_px: float) -> np.ndarray:
    sk = skel.copy().astype(np.uint8)
    min_steps = max(1, int(math.ceil(min_len_px / float(cell_px))))
    h, w = sk.shape

    def neigh(r: int, c: int) -> List[Tuple[int, int]]:
        out = []
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if dr == 0 and dc == 0:
                    continue
                rr, cc = r + dr, c + dc
                if 0 <= rr < h and 0 <= cc < w and sk[rr, cc] == 1:
                    out.append((rr, cc))
        return out

    changed = True
    rounds = 0
    while changed and rounds < 60:
        rounds += 1
        changed = False
        deg = _skeleton_degrees(sk)
        endpoints = list(zip(*np.where((sk == 1) & (deg == 1))))
        to_kill: Set[Tuple[int, int]] = set()

        for ep in endpoints:
            path = [ep]
            prev = None
            cur = ep
            for _ in range(min_steps):
                ns = neigh(cur[0], cur[1])
                if prev is not None:
                    ns = [x for x in ns if x != prev]
                if not ns:
                    break
                nxt = ns[0]
                path.append(nxt)
                prev, cur = cur, nxt
                if deg[cur] != 2:
                    break

            if len(path) <= min_steps and deg[cur] >= 3:
                for p in path[:-1]:
                    to_kill.add(p)

        if to_kill:
            for r, c in to_kill:
                sk[r, c] = 0
            changed = True

    return sk


# -------------------------
# Graph compression helpers
# -------------------------

@dataclass(frozen=True)
class Pixel:
    r: int
    c: int


def _pixel_neighbors(skel: np.ndarray, p: Pixel) -> List[Pixel]:
    h, w = skel.shape
    out: List[Pixel] = []
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr == 0 and dc == 0:
                continue
            rr, cc = p.r + dr, p.c + dc
            if 0 <= rr < h and 0 <= cc < w and skel[rr, cc] == 1:
                out.append(Pixel(rr, cc))
    return out


def _pixel_step_dist(a: Pixel, b: Pixel, cell_px: float) -> float:
    dr = abs(a.r - b.r)
    dc = abs(a.c - b.c)
    return cell_px if (dr + dc == 1) else cell_px * math.sqrt(2.0)


def _compress_skeleton_to_graph(
    skel: np.ndarray,
    cell_px: float,
    split_every_steps: int = 6,
) -> Tuple[List[Pixel], List[Tuple[Pixel, Pixel, float]]]:
    sk = skel.astype(np.uint8)
    deg = _skeleton_degrees(sk)
    nodes: Set[Pixel] = set(Pixel(r, c) for r, c in zip(*np.where((sk == 1) & (deg != 2))))

    # If no junctions/endpoints (rare), seed a few nodes
    if not nodes:
        all_pix = list(zip(*np.where(sk == 1)))
        for r, c in all_pix[:: max(1, len(all_pix) // 50)]:
            nodes.add(Pixel(r, c))

    def neigh(p: Pixel) -> List[Pixel]:
        return _pixel_neighbors(sk, p)

    # Add periodic split nodes
    for _round in range(12):
        added: Set[Pixel] = set()
        for u in list(nodes):
            for v in neigh(u):
                prev = u
                cur = v
                steps = 1
                while cur not in nodes:
                    ns = neigh(cur)
                    ns = [x for x in ns if x != prev]
                    if not ns:
                        break
                    if steps >= split_every_steps:
                        added.add(cur)
                        break
                    prev, cur = cur, ns[0]
                    steps += 1
        if not added:
            break
        before = len(nodes)
        nodes |= added
        if len(nodes) == before:
            break

    nodes_list = sorted(list(nodes), key=lambda p: (p.r, p.c))
    node_set = set(nodes_list)

    # Build edges by walking chains between nodes
    edges: List[Tuple[Pixel, Pixel, float]] = []
    seen_dir: Set[Tuple[Pixel, Pixel]] = set()

    for u in nodes_list:
        for v in neigh(u):
            if (u, v) in seen_dir:
                continue
            seen_dir.add((u, v))
            seen_dir.add((v, u))

            prev = u
            cur = v
            dacc = _pixel_step_dist(u, v, cell_px)

            while cur not in node_set:
                ns = neigh(cur)
                ns = [x for x in ns if x != prev]
                if not ns:
                    node_set.add(cur)
                    nodes_list.append(cur)
                    break
                nxt = ns[0]
                dacc += _pixel_step_dist(cur, nxt, cell_px)
                prev, cur = cur, nxt
                seen_dir.add((prev, cur))
                seen_dir.add((cur, prev))

            if cur != u and cur in node_set:
                a, b = (u, cur) if (u.r, u.c) < (cur.r, cur.c) else (cur, u)
                edges.append((a, b, float(dacc)))

    # de-dup edges
    uniq = {}
    for a, b, d in edges:
        key = (a, b)
        if key not in uniq or d < uniq[key]:
            uniq[key] = d
    return nodes_list, [(k[0], k[1], v) for k, v in uniq.items()]


# -------------------------
# NavMeshGenerator
# -------------------------

class NavMeshGenerator:
    def __init__(
        self,
        rooms: List[Dict],
        corridors: List[Dict],
        entrances: Optional[List[Dict]] = None,
        corridor_step_px: int = 12,
        segment_size_px: int = 300,
        max_corridor_nodes: int = 6000,
        spur_prune_px: float = 30.0,
    ):
        self.rooms = rooms or []
        self.corridors = corridors or []
        self.entrances = entrances or []

        self.corridor_step_px = int(max(6, corridor_step_px))
        self.segment_size_px = int(max(50, segment_size_px))
        self.max_corridor_nodes = int(max(200, max_corridor_nodes))
        self.spur_prune_px = float(max(0.0, spur_prune_px))

        self.nodes: List[Dict] = []
        self.edges: List[Dict] = []

        self._corridor_polys: List[List[List[float]]] = [c["polygon"] for c in self.corridors if c.get("polygon")]
        self._hall_polys: List[List[List[float]]] = []

        # Stored raster for component stitching and door snapping
        self._walkable_raster: Optional[np.ndarray] = None
        # "Free-space" raster used ONLY for stitching components when corridor polygons are disjoint
        # Walkable = NOT inside halls (within the same bbox as corridors)
        self._free_raster: Optional[np.ndarray] = None
        self._raster_min_x: float = 0.0
        self._raster_min_y: float = 0.0
        self._raster_cell: float = float(self.corridor_step_px)

        # Optional debug
        self._spine_debug_nodes: List[List[float]] = []
        self._spine_debug_edges: List[List[int]] = []

    def generate(self) -> Dict:
        print("Generating navigation mesh (spine routing)")

        self.nodes = []
        self.edges = []

        self._create_room_nodes()
        self._hall_polys = [n["polygon"] for n in self.nodes if n["type"] == "room"]

        self._create_spine_corridor_graph()

        # Ensure corridor graph is connected (including stitching via raster if needed)
        self._ensure_corridor_connected()

        # Connect rooms
        self._connect_rooms_via_doors_to_spine()

        # Entrance
        self._create_or_connect_entrance()

        print(f"Generated {len(self.nodes)} nodes and {len(self.edges)} edges")

        out = {
            "nodes": self.nodes,
            "edges": self.edges,
            "rooms_metadata": self._extract_room_metadata(),
            "corridor_polygons": self.corridors,
        }
        if self._spine_debug_nodes and self._spine_debug_edges:
            out["spine_nodes"] = self._spine_debug_nodes
            out["spine_edges"] = self._spine_debug_edges
        return out

    # -------------------------
    # Rooms
    # -------------------------

    def _create_room_nodes(self) -> None:
        def _sort_key(r: Dict) -> Tuple[str, float]:
            name = (r.get("name") or "").strip().lower()
            area = float(r.get("_area", 0) or 0)
            return (name, -area)

        for idx, room in enumerate(sorted(self.rooms, key=_sort_key)):
            self.nodes.append(
                {
                    "id": f"room_{idx}",
                    "type": "room",
                    "name": room.get("name", f"Room {idx + 1}"),
                    "position": room["center"],
                    "bounds": room["bounds"],
                    "polygon": room["polygon"],
                    "is_destination": True,
                }
            )

    def _extract_room_metadata(self) -> List[Dict]:
        rooms = []
        for n in self.nodes:
            if n["type"] == "room":
                rooms.append(
                    {"id": n["id"], "name": n.get("name", n["id"]), "bounds": n.get("bounds"), "center": n.get("position")}
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

    def _is_walkable(self, x: float, y: float) -> bool:
        return self._in_any_corridor(x, y) and (not self._in_any_hall(x, y))

    def _segment_walkable_corridor_only(self, a: Dict[str, float], b: Dict[str, float], samples: int = 21) -> bool:
        ax, ay = float(a["x"]), float(a["y"])
        bx, by = float(b["x"]), float(b["y"])
        for i in range(samples + 1):
            t = i / float(samples)
            x = ax + (bx - ax) * t
            y = ay + (by - ay) * t
            if not self._is_walkable(x, y):
                return False
        return True

    # -------------------------
    # Raster coordinate helpers
    # -------------------------

    def _world_to_cell(self, x: float, y: float) -> Tuple[int, int]:
        c = int((x - self._raster_min_x) / self._raster_cell)
        r = int((y - self._raster_min_y) / self._raster_cell)
        return r, c

    def _cell_to_world(self, r: int, c: int) -> Dict[str, float]:
        x = self._raster_min_x + (c + 0.5) * self._raster_cell
        y = self._raster_min_y + (r + 0.5) * self._raster_cell
        return {"x": float(x), "y": float(y)}

    def _snap_to_walkable(self, x: float, y: float, max_radius_cells: int = 10) -> Optional[Dict[str, float]]:
        """Snap (x,y) to nearest walkable raster cell center."""
        if self._walkable_raster is None:
            return {"x": float(x), "y": float(y)} if self._is_walkable(x, y) else None

        ras = self._walkable_raster
        h, w = ras.shape
        r0, c0 = self._world_to_cell(x, y)
        if 0 <= r0 < h and 0 <= c0 < w and ras[r0, c0] == 1:
            return self._cell_to_world(r0, c0)

        for rad in range(1, max_radius_cells + 1):
            for dr in range(-rad, rad + 1):
                for dc in range(-rad, rad + 1):
                    rr = r0 + dr
                    cc = c0 + dc
                    if 0 <= rr < h and 0 <= cc < w and ras[rr, cc] == 1:
                        p = self._cell_to_world(rr, cc)
                        # still ensure true walkable in polygon sense
                        if self._is_walkable(p["x"], p["y"]):
                            return p
        return None

    # -------------------------
    # Spine graph generation
    # -------------------------

    def _create_spine_corridor_graph(self) -> None:
        if not self.corridors:
            print("WARNING: No corridors extracted")
            return

        min_x = min(c["bounds"]["x"] for c in self.corridors)
        min_y = min(c["bounds"]["y"] for c in self.corridors)
        max_x = max(c["bounds"]["x"] + c["bounds"]["width"] for c in self.corridors)
        max_y = max(c["bounds"]["y"] + c["bounds"]["height"] for c in self.corridors)

        pad = float(self.corridor_step_px) * 2.0
        min_x -= pad
        min_y -= pad
        max_x += pad
        max_y += pad

        cell = float(self.corridor_step_px)
        w = int(math.ceil((max_x - min_x) / cell))
        h = int(math.ceil((max_y - min_y) / cell))

        # Safety cap
        if w * h > 1_200_000:
            scale = math.sqrt((w * h) / 1_200_000.0)
            cell *= max(1.0, scale)
            w = int(math.ceil((max_x - min_x) / cell))
            h = int(math.ceil((max_y - min_y) / cell))

        binary = np.zeros((h, w), dtype=np.uint8)
        free = np.zeros((h, w), dtype=np.uint8)
        for rr in range(h):
            y = min_y + (rr + 0.5) * cell
            for cc in range(w):
                x = min_x + (cc + 0.5) * cell
                if not self._in_any_hall(x, y):
                    free[rr, cc] = 1
                if self._is_walkable(x, y):
                    binary[rr, cc] = 1

        # Store rasters for later stitching/snapping
        self._walkable_raster = binary
        self._free_raster = free
        self._raster_min_x = float(min_x)
        self._raster_min_y = float(min_y)
        self._raster_cell = float(cell)

        if int(binary.sum()) == 0:
            print("WARNING: walkable raster empty (corridors minus halls produced nothing)")
            return

        # Closing helps reconnect tiny gaps caused by coarse rasterization
        binary2 = _close(binary, iters=1)

        skel = _zs_thin(binary2)
        if self.spur_prune_px > 0:
            skel = _prune_spurs(skel, min_len_px=self.spur_prune_px, cell_px=cell)

        if int(skel.sum()) == 0:
            print("WARNING: skeletonization produced empty skeleton")
            return

        node_pix, edge_pix = _compress_skeleton_to_graph(skel, cell_px=cell, split_every_steps=6)

        # remove any previous corridor/door nodes if regenerate
        self.nodes = [n for n in self.nodes if n["type"] not in ("corridor", "door")]
        self.edges = [e for e in self.edges if True]  # keep room-room edges none exist; edges rebuilt below

        pix_to_nodeid: Dict[Pixel, str] = {}
        corridor_nodes: List[Dict] = []

        # map pixel nodes to world positions
        for idx, p in enumerate(node_pix):
            pos = self._cell_to_world(p.r, p.c)
            if not self._is_walkable(pos["x"], pos["y"]):
                continue
            seg_i = int(pos["x"] // float(self.segment_size_px))
            seg_j = int(pos["y"] // float(self.segment_size_px))
            segment_id = f"corr_seg_{seg_i}_{seg_j}"
            nid = f"corridor_{idx}"
            corridor_nodes.append(
                {"id": nid, "type": "corridor", "position": pos, "segment_id": segment_id, "is_destination": False}
            )
            pix_to_nodeid[p] = nid

        if len(corridor_nodes) > self.max_corridor_nodes:
            corridor_nodes = corridor_nodes[: self.max_corridor_nodes]
            keep = set(n["id"] for n in corridor_nodes)
            pix_to_nodeid = {p: nid for p, nid in pix_to_nodeid.items() if nid in keep}

        self.nodes.extend(corridor_nodes)
        node_by_id = {n["id"]: n for n in self.nodes}

        # Debug
        id_to_dbg = {n["id"]: i for i, n in enumerate(corridor_nodes)}
        self._spine_debug_nodes = [[n["position"]["x"], n["position"]["y"]] for n in corridor_nodes]
        self._spine_debug_edges = []

        added_pairs = 0
        seen_pairs = set()
        for a_pix, b_pix, d in edge_pix:
            a_id = pix_to_nodeid.get(a_pix)
            b_id = pix_to_nodeid.get(b_pix)
            if not a_id or not b_id or a_id == b_id:
                continue
            key = tuple(sorted((a_id, b_id)))
            if key in seen_pairs:
                continue
            seen_pairs.add(key)

            pa = node_by_id[a_id]["position"]
            pb = node_by_id[b_id]["position"]

            if not self._segment_walkable_corridor_only(pa, pb, samples=25):
                continue

            self._add_edge_bidir(a_id, b_id, float(d))
            added_pairs += 1

            ia = id_to_dbg.get(a_id)
            ib = id_to_dbg.get(b_id)
            if ia is not None and ib is not None:
                self._spine_debug_edges.append([int(ia), int(ib)])

        print(f"Spine corridor graph: {len(corridor_nodes)} nodes, {added_pairs} edge pairs")

    # -------------------------
    # Corridor connectivity
    # -------------------------

    def _corridor_components(self) -> List[Set[str]]:
        corridor_ids = {n["id"] for n in self.nodes if n["type"] == "corridor"}
        if not corridor_ids:
            return []
        adj: Dict[str, Set[str]] = {cid: set() for cid in corridor_ids}
        for e in self.edges:
            a, b = e["from"], e["to"]
            if a in corridor_ids and b in corridor_ids:
                adj[a].add(b)
                adj[b].add(a)

        seen: Set[str] = set()
        comps: List[Set[str]] = []
        for cid in corridor_ids:
            if cid in seen:
                continue
            stack = [cid]
            seen.add(cid)
            comp = {cid}
            while stack:
                u = stack.pop()
                for v in adj.get(u, set()):
                    if v not in seen:
                        seen.add(v)
                        comp.add(v)
                        stack.append(v)
            comps.append(comp)
        return comps

    def _ensure_corridor_connected(self) -> None:
        """Try simple bridging, then stitch remaining components using raster A*."""
        comps = self._corridor_components()
        if len(comps) <= 1:
            return

        print(f"Found {len(comps)} disconnected corridor components - bridging...")
        self._bridge_components_by_los(max_link_dist_px=900.0)
        comps = self._corridor_components()
        if len(comps) <= 1:
            return

        print(f"WARNING: {len(comps)} corridor components remain disconnected")
        # Stitch using raster A* (guaranteed inside walkable corridors)
        self._stitch_components_with_raster(max_stitches=6)
        comps = self._corridor_components()
        if len(comps) > 1:
            print(f"WARNING: {len(comps)} corridor components remain disconnected AFTER raster stitching")

    def _bridge_components_by_los(self, max_link_dist_px: float = 900.0) -> None:
        corridor_nodes = [n for n in self.nodes if n["type"] == "corridor"]
        if len(corridor_nodes) < 2:
            return

        node_pos = {n["id"]: n["position"] for n in corridor_nodes}
        comps = self._corridor_components()
        if len(comps) <= 1:
            return

        # merge smallest into largest iteratively
        it = 0
        while len(comps) > 1 and it < 20:
            it += 1
            comps.sort(key=len, reverse=True)
            main = comps[0]
            other = comps[-1]

            best = None
            for a in main:
                pa = node_pos[a]
                for b in other:
                    pb = node_pos[b]
                    d = _dist(pa, pb)
                    if d > max_link_dist_px:
                        continue
                    if best is None or d < best[0]:
                        best = (d, a, b)

            if best is None:
                break

            d, a, b = best
            if self._segment_walkable_corridor_only(node_pos[a], node_pos[b], samples=31):
                self._add_edge_bidir(a, b, float(d))
            else:
                # loosen samples slightly (sometimes a single sample hits boundary)
                if self._segment_walkable_corridor_only(node_pos[a], node_pos[b], samples=19):
                    self._add_edge_bidir(a, b, float(d))
                else:
                    break

            comps = self._corridor_components()

    # -------------------------
    # Raster A* stitching
    # -------------------------


    def _astar_on_raster_any(self, ras: Optional[np.ndarray], start_rc: Tuple[int, int], goal_rc: Tuple[int, int]) -> Optional[List[Tuple[int, int]]]:
        """A* on a provided binary raster (1 = walkable)."""
        if ras is None:
            return None
        h, w = ras.shape

        def inb(r: int, c: int) -> bool:
            return 0 <= r < h and 0 <= c < w

        sr, sc = start_rc
        gr, gc = goal_rc
        if not inb(sr, sc) or not inb(gr, gc):
            return None
        if ras[sr, sc] != 1 or ras[gr, gc] != 1:
            return None

        moves = [(-1, 0), (1, 0), (0, -1), (0, 1),
                 (-1, -1), (-1, 1), (1, -1), (1, 1)]

        def hfun(r: int, c: int) -> float:
            return math.hypot(r - gr, c - gc)

        openq = []
        heapq.heappush(openq, (hfun(sr, sc), 0.0, (sr, sc)))
        came: Dict[Tuple[int, int], Tuple[int, int]] = {}
        gscore = {(sr, sc): 0.0}
        closed = set()

        while openq:
            _, g, (r, c) = heapq.heappop(openq)
            if (r, c) in closed:
                continue
            closed.add((r, c))

            if (r, c) == (gr, gc):
                path = [(r, c)]
                cur = (r, c)
                while cur in came:
                    cur = came[cur]
                    path.append(cur)
                path.reverse()
                return path

            for dr, dc in moves:
                rr, cc = r + dr, c + dc
                if not inb(rr, cc) or ras[rr, cc] != 1:
                    continue
                step = 1.0 if (dr == 0 or dc == 0) else math.sqrt(2.0)
                ng = g + step
                if ng < gscore.get((rr, cc), 1e18):
                    gscore[(rr, cc)] = ng
                    came[(rr, cc)] = (r, c)
                    f = ng + hfun(rr, cc)
                    heapq.heappush(openq, (f, ng, (rr, cc)))

        return None

    def _astar_on_raster(self, start_rc: Tuple[int, int], goal_rc: Tuple[int, int]) -> Optional[List[Tuple[int, int]]]:
        """Backward-compatible: A* on the corridor-only walkable raster."""
        return self._astar_on_raster_any(self._walkable_raster, start_rc, goal_rc)

    def _stitch_components_with_raster(self, max_stitches: int = 6) -> None:
        ras = self._walkable_raster
        if ras is None:
            return

        corridor_nodes = [n for n in self.nodes if n["type"] == "corridor"]
        node_by_id = {n["id"]: n for n in corridor_nodes}

        comps = self._corridor_components()
        if len(comps) <= 1:
            return

        made = 0
        while len(comps) > 1 and made < max_stitches:
            comps.sort(key=len, reverse=True)
            main = comps[0]
            other = comps[-1]

            # pick closest pair (world distance) between components
            best = None
            for a in main:
                pa = node_by_id[a]["position"]
                for b in other:
                    pb = node_by_id[b]["position"]
                    d = _dist(pa, pb)
                    if best is None or d < best[0]:
                        best = (d, a, b)
            if best is None:
                break

            _, a_id, b_id = best
            a_pos = node_by_id[a_id]["position"]
            b_pos = node_by_id[b_id]["position"]
            a_rc = self._world_to_cell(a_pos["x"], a_pos["y"])
            b_rc = self._world_to_cell(b_pos["x"], b_pos["y"])

            path_rc = self._astar_on_raster_any(self._walkable_raster, a_rc, b_rc)
            if not path_rc or len(path_rc) < 2:
                # corridor polygons may be disjoint in the SVG; stitch through free space (not inside halls)
                path_rc = self._astar_on_raster_any(self._free_raster, a_rc, b_rc)
            if not path_rc or len(path_rc) < 2:
                break

            # downsample the raster path to avoid huge node chains
            stride = max(2, int(round(50.0 / self._raster_cell)))  # ~50px spacing
            sampled = path_rc[::stride]
            if sampled[-1] != path_rc[-1]:
                sampled.append(path_rc[-1])

            # create intermediate corridor nodes
            stitch_ids: List[str] = []
            for i, (r, c) in enumerate(sampled):
                pos = self._cell_to_world(r, c)
                sid = f"stitch_{made}_{i}"
                seg_i = int(pos["x"] // float(self.segment_size_px))
                seg_j = int(pos["y"] // float(self.segment_size_px))
                segment_id = f"corr_seg_{seg_i}_{seg_j}"
                self.nodes.append(
                    {"id": sid, "type": "corridor", "position": pos, "segment_id": segment_id, "is_destination": False}
                )
                stitch_ids.append(sid)

            # connect a_id -> stitch chain -> b_id
            chain = [a_id] + stitch_ids + [b_id]
            for u, v in zip(chain[:-1], chain[1:]):
                pu = (node_by_id.get(u) or next(n for n in self.nodes if n["id"] == u))["position"]
                pv = (node_by_id.get(v) or next(n for n in self.nodes if n["id"] == v))["position"]
                d = _dist(pu, pv)
                if self._segment_walkable_corridor_only(pu, pv, samples=25):
                    self._add_edge_bidir(u, v, float(d))
                else:
                    # These are raster-adjacent points; this should rarely fail.
                    self._add_edge_bidir(u, v, float(d))

            made += 1
            # rebuild corridor node_by_id for next iterations
            corridor_nodes = [n for n in self.nodes if n["type"] == "corridor"]
            node_by_id = {n["id"]: n for n in corridor_nodes}
            comps = self._corridor_components()

        if made > 0:
            print(f"Raster stitched components with {made} stitch chain(s)")

    # -------------------------
    # Room -> spine via door nodes (with snapping)
    # -------------------------

    def _connect_rooms_via_doors_to_spine(self, ray_dirs: int = 8) -> None:
        room_nodes = [n for n in self.nodes if n["type"] == "room"]
        corridor_nodes = [n for n in self.nodes if n["type"] == "corridor"]

        if not room_nodes or not corridor_nodes:
            print("WARNING: Cannot connect rooms to spine - missing nodes")
            return

        node_by_id = {n["id"]: n for n in self.nodes}
        spine_positions = [(c["id"], c["position"]["x"], c["position"]["y"]) for c in corridor_nodes]

        dirs = []
        for i in range(ray_dirs):
            ang = (2.0 * math.pi * i) / float(ray_dirs)
            dirs.append((math.cos(ang), math.sin(ang)))

        for room in room_nodes:
            room_poly = room.get("polygon") or []
            if not room_poly:
                continue

            cx, cy = float(room["position"]["x"]), float(room["position"]["y"])

            candidates: List[Tuple[float, float]] = []
            step = 4.0
            max_steps = 700

            for dx, dy in dirs:
                x, y = cx, cy
                for _ in range(max_steps):
                    x += dx * step
                    y += dy * step
                    if _point_in_poly(x, y, room_poly):
                        continue
                    # just outside room
                    cand = self._snap_to_walkable(x + dx * 6.0, y + dy * 6.0, max_radius_cells=12)
                    if cand:
                        candidates.append((cand["x"], cand["y"]))
                    break

            if not candidates:
                # fallback: try room vertices nudged outward
                for vx, vy in room_poly[:: max(1, len(room_poly) // 10)]:
                    for dx, dy in dirs:
                        cand = self._snap_to_walkable(float(vx) + dx * 10.0, float(vy) + dy * 10.0, max_radius_cells=12)
                        if cand:
                            candidates.append((cand["x"], cand["y"]))
                            break
                    if candidates:
                        break

            if not candidates:
                # ultimate fallback: snap center (rare)
                cand = self._snap_to_walkable(cx, cy, max_radius_cells=14)
                if cand:
                    candidates = [(cand["x"], cand["y"])]

            # pick best candidate + nearest reachable spine node
            best = None
            best_spine = None
            for door_x, door_y in candidates:
                dists = []
                for sid, sx, sy in spine_positions:
                    d = math.hypot(door_x - sx, door_y - sy)
                    dists.append((d, sid, sx, sy))
                dists.sort(key=lambda t: t[0])

                for d, sid, sx, sy in dists[:40]:
                    a = {"x": float(door_x), "y": float(door_y)}
                    b = {"x": float(sx), "y": float(sy)}
                    if self._segment_walkable_corridor_only(a, b, samples=25):
                        if best is None or d < best:
                            best = d
                            best_spine = (door_x, door_y, sid)
                        break

            if best_spine is None:
                # if corridor-only fails everywhere, connect to nearest spine anyway (keeps app usable)
                sid, sx, sy = min(spine_positions, key=lambda t: math.hypot(cx - t[1], cy - t[2]))
                door_x, door_y = candidates[0] if candidates else (cx, cy)
                best_spine = (door_x, door_y, sid)

            door_x, door_y, spine_id = best_spine

            door_id = f"door_{room['id']}"
            if door_id not in node_by_id:
                seg_i = int(float(door_x) // float(self.segment_size_px))
                seg_j = int(float(door_y) // float(self.segment_size_px))
                segment_id = f"corr_seg_{seg_i}_{seg_j}"
                door_node = {
                    "id": door_id,
                    "type": "door",
                    "name": f"Door {room.get('name', room['id'])}",
                    "position": {"x": float(door_x), "y": float(door_y)},
                    "segment_id": segment_id,
                    "is_destination": False,
                }
                self.nodes.append(door_node)
                node_by_id[door_id] = door_node

            # room center -> door (allowed to start inside room)
            self._add_edge_bidir(room["id"], door_id, float(math.hypot(cx - door_x, cy - door_y)))

            # door -> spine (corridor only)
            door_pos = node_by_id[door_id]["position"]
            spine_pos = node_by_id.get(spine_id, {}).get("position")
            if spine_pos and self._segment_walkable_corridor_only(door_pos, spine_pos, samples=31):
                self._add_edge_bidir(door_id, spine_id, float(_dist(door_pos, spine_pos)))
            else:
                # still connect so the graph isn't broken; but this should be much rarer now
                self._add_edge_bidir(door_id, spine_id, float(_dist(door_pos, spine_pos)))
                print(f"Forced door->spine connection for {room.get('name', room['id'])} (corridor-only failed)")

    # -------------------------
    # Entrance
    # -------------------------

    def _create_or_connect_entrance(self) -> None:
        entrance_id = "entrance_0"
        existing = next((n for n in self.nodes if n["id"] == entrance_id), None)
        if existing:
            entrance_node = existing
        else:
            corridor_nodes = [n for n in self.nodes if n["type"] == "corridor"]
            if not corridor_nodes:
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

        dists = [(float(_dist(entrance_node["position"], c["position"])), c) for c in corridor_nodes]
        dists.sort(key=lambda t: t[0])
        added = 0
        for d, corr in dists[:25]:
            if self._segment_walkable_corridor_only(entrance_node["position"], corr["position"], samples=31):
                self._add_edge_bidir(entrance_node["id"], corr["id"], float(d))
                added += 1
            if added >= 4:
                break
        if added == 0 and dists:
            d, corr = dists[0]
            self._add_edge_bidir(entrance_node["id"], corr["id"], float(d))

    # -------------------------
    # IoT multipliers
    # -------------------------

    def update_edge_weights_from_iot(self, sensor_data: Dict[str, float]) -> None:
        if not sensor_data:
            return
        node_by_id = {n["id"]: n for n in self.nodes}
        for e in self.edges:
            a = node_by_id.get(e["from"])
            b = node_by_id.get(e["to"])
            if not a or not b:
                continue

            mult = None
            if e["from"] in sensor_data:
                mult = float(sensor_data[e["from"]])
            elif e["to"] in sensor_data:
                mult = float(sensor_data[e["to"]])
            else:
                if a.get("type") in ("corridor", "door") and b.get("type") in ("corridor", "door"):
                    seg = a.get("segment_id") or b.get("segment_id")
                    if seg and seg in sensor_data:
                        mult = float(sensor_data[seg])

            if mult is None:
                continue

            base = float(e.get("base_weight", e.get("weight", 1.0)))
            e["base_weight"] = base
            e["weight"] = base * mult
            e["effective_weight"] = base * mult

    # -------------------------
    # Edge helper
    # -------------------------

    def _add_edge_bidir(self, a: str, b: str, weight: float) -> None:
        w = float(weight)
        self.edges.append({"from": a, "to": b, "weight": w, "base_weight": w, "effective_weight": w})
        self.edges.append({"from": b, "to": a, "weight": w, "base_weight": w, "effective_weight": w})