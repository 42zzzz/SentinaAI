// NavigationMap.jsx
// Canvas2D floor plan — no PixiJS dependency.
// Draws rooms, corridors, heatmap overlay and navigation path directly onto
// an HTML5 <canvas> element using the 2D context API.

import { useEffect, useRef } from "react";
import { aggregateHeatmapGrid, generateHeatmapImageData } from "../utils/heatmapUtils.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function getHallColor(name) {
  const n = (name ?? "").toLowerCase();
  if (n.startsWith("north hall")) return { color: 0x9e2a2b, alpha: 0.45 };
  if (n.startsWith("east hall"))  return { color: 0x1f3a5f, alpha: 0.45 };
  if (n.startsWith("south hall")) return { color: 0xe09f3e, alpha: 0.45 };
  if (n.startsWith("hall")) {
    const num = parseInt(n.replace("hall", "").trim(), 10);
    if (!isNaN(num)) {
      if (num >= 1 && num <= 6)  return { color: 0x2f8f9d, alpha: 0.40 };
      if (num >= 7 && num <= 10) return { color: 0x1f3a5f, alpha: 0.30 };
    }
  }
  return { color: 0xaaaacc, alpha: 0.30 };
}

function hexToRgb(hex) {
  return { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff };
}

function centroid(poly) {
  if (!poly || !poly.length) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (const p of poly) {
    sx += Array.isArray(p) ? p[0] : p.x;
    sy += Array.isArray(p) ? p[1] : p.y;
  }
  return { x: sx / poly.length, y: sy / poly.length };
}

function pointInPolygon(wx, wy, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = Array.isArray(poly[i]) ? poly[i][0] : poly[i].x;
    const yi = Array.isArray(poly[i]) ? poly[i][1] : poly[i].y;
    const xj = Array.isArray(poly[j]) ? poly[j][0] : poly[j].x;
    const yj = Array.isArray(poly[j]) ? poly[j][1] : poly[j].y;
    if ((yi > wy) !== (yj > wy) && wx < ((xj - xi) * (wy - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function getCrowdStatus(occ) {
  if (occ >= 0.8) return { label: "Very Crowded", color: "#dc2626" };
  if (occ >= 0.6) return { label: "Crowded",      color: "#f97316" };
  if (occ >= 0.3) return { label: "Moderate",     color: "#eab308" };
  return           { label: "Normal",       color: "#22c55e" };
}

function hashString(s) {
  s = String(s ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDemoIoTData(real, nodes) {
  const out       = Object.assign({}, real && typeof real === "object" ? real : {});
  const roomNodes = (nodes ?? []).filter(n => n.type === "room");
  if (!roomNodes.length) return out;

  const sorted = [...roomNodes].sort((a, b) =>
    String(a.name ?? a.id).localeCompare(String(b.name ?? b.id)));
  const N = sorted.length;

  const realVals = sorted.map(n => Number(out[n.id])).filter(v => Number.isFinite(v));
  const spread   = realVals.length ? Math.max(...realVals) - Math.min(...realVals) : 0;

  const pick = (p) => sorted[Math.max(0, Math.min(N - 1, Math.floor(p * (N - 1))))];
  const redIds    = new Set([pick(0.15)?.id, pick(0.55)?.id, pick(0.85)?.id].filter(Boolean));
  const yellowIds = new Set([pick(0.30)?.id, pick(0.40)?.id, pick(0.70)?.id].filter(Boolean));
  const greenIds  = new Set([pick(0.05)?.id, pick(0.25)?.id, pick(0.95)?.id].filter(Boolean));

  const fullSim = spread < 0.20;
  for (const n of sorted) {
    const id   = n.id;
    const rand = mulberry32(hashString(id) ^ 0xa5a5a5a5)();
    if (fullSim) {
      if      (redIds.has(id))    out[id] = 0.90 + 0.09 * rand;
      else if (yellowIds.has(id)) out[id] = 0.55 + 0.18 * rand;
      else                        out[id] = 0.10 + 0.25 * rand;
    } else {
      const base = Number.isFinite(Number(out[id]))
        ? Math.max(0, Math.min(1, Number(out[id])))
        : 0.10 + 0.25 * rand;
      if      (redIds.has(id))   out[id] = Math.max(base, 0.88 + 0.10 * rand);
      else if (greenIds.has(id)) out[id] = Math.min(base, 0.18 + 0.12 * rand);
      else                       out[id] = base;
    }
  }
  return out;
}

// ─── component ──────────────────────────────────────────────────────────────

export default function NavigationMap({ apiBase, pathPoints, showHeatmap, demoMode }) {
  const containerRef    = useRef(null);
  const canvasRef       = useRef(null);
  const ctxRef          = useRef(null);
  const navmeshRef      = useRef(null);
  const iotDataRef      = useRef({});
  const iotDataRealRef  = useRef({});
  const viewportRef     = useRef({ zoom: 1, x: 0, y: 0 });
  const showHeatRef     = useRef(showHeatmap);
  const demoModeRef     = useRef(demoMode);
  const intervalRef     = useRef(null);
  const tooltipRef      = useRef(null);
  const hitTestRef      = useRef([]);
  const heatCanvasRef   = useRef(null);   // offscreen canvas for heatmap image
  const pathPointsRef   = useRef(pathPoints);
  const renderRef       = useRef(null);
  const renderHeatmapRef = useRef(null);

  // Sync showHeatmap → re-render (heatmap layer is toggled inside render())
  useEffect(() => {
    showHeatRef.current = showHeatmap;
    if (showHeatmap) renderHeatmapRef.current?.(); // rebuild if just switched on
    else             renderRef.current?.();
  }, [showHeatmap]);

  // Sync demoMode → rebuild IoT simulation data → re-render heatmap
  useEffect(() => {
    demoModeRef.current = demoMode;
    const nm = navmeshRef.current;
    if (!nm) return;
    const real = iotDataRealRef.current;
    iotDataRef.current = demoMode ? buildDemoIoTData(real, nm.nodes) : { ...real };
    renderHeatmapRef.current?.();
  }, [demoMode]);

  // Sync pathPoints → re-render (path is drawn in the main render pass)
  useEffect(() => {
    pathPointsRef.current = pathPoints;
    renderRef.current?.();
  }, [pathPoints]);

  // ─── main canvas lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let alive = true;
    let ro    = null;

    // Defer one macrotask so React 18 StrictMode's immediate cleanup can
    // cancel this before any canvas/context is created.
    const timeoutId = setTimeout(() => {
      if (!alive) return;

      // ── create canvas ────────────────────────────────────────────────────
      const canvas = document.createElement("canvas");
      canvas.width  = Math.max(container.clientWidth,  1);
      canvas.height = Math.max(container.clientHeight, 1);
      canvas.style.cssText = "display:block;width:100%;height:100%;cursor:grab";
      container.insertBefore(canvas, container.firstChild);
      canvasRef.current = canvas;

      const ctx = canvas.getContext("2d");
      ctxRef.current = ctx;

      // Offscreen canvas for the heatmap image (reused across updates)
      const heatCanvas = document.createElement("canvas");
      heatCanvasRef.current = heatCanvas;

      const vp = viewportRef.current;

      // ── coordinate helper ────────────────────────────────────────────────
      function screenToWorld(sx, sy) {
        return { x: sx / vp.zoom - vp.x, y: sy / vp.zoom - vp.y };
      }

      // ── main render pass ─────────────────────────────────────────────────
      function render() {
        const nm = navmeshRef.current;
        const W  = canvas.width, H = canvas.height;

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, W, H);

        if (!nm) return;

        ctx.save();
        ctx.translate(vp.x * vp.zoom, vp.y * vp.zoom);
        ctx.scale(vp.zoom, vp.zoom);

        // Helper: trace a polygon path without stroking/filling
        function tracePoly(poly) {
          ctx.beginPath();
          poly.forEach((p, i) => {
            const x = Array.isArray(p) ? p[0] : p.x;
            const y = Array.isArray(p) ? p[1] : p.y;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          });
          ctx.closePath();
        }

        // 1. Corridors
        for (const corridor of nm.corridor_polygons ?? []) {
          const poly = corridor?.polygon ?? (Array.isArray(corridor) ? corridor : null);
          if (!Array.isArray(poly) || poly.length < 3) continue;
          tracePoly(poly);
          ctx.fillStyle = "rgba(43,43,43,0.18)";
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,1)";
          ctx.lineWidth   = 4 / vp.zoom;
          ctx.lineJoin    = "miter";
          ctx.stroke();
        }

        // 2. Heatmap overlay
        if (showHeatRef.current && heatCanvas._bounds && heatCanvas.width > 0) {
          const b = heatCanvas._bounds;
          ctx.globalAlpha = 0.75;
          ctx.drawImage(heatCanvas, b.minX, b.minY, b.w, b.h);
          ctx.globalAlpha = 1;
        }

        // 3. Rooms + labels (greyscale when heatmap is active)
        if (showHeatRef.current) ctx.filter = "grayscale(100%)";
        for (const room of nm.rooms ?? []) {
          const poly = room.polygon;
          if (!poly || poly.length < 3) continue;
          const { color, alpha } = getHallColor(room.name);
          const { r, g, b } = hexToRgb(color);

          tracePoly(poly);
          ctx.fillStyle   = `rgba(${r},${g},${b},${alpha})`;
          ctx.fill();
          // 4px solid black outline — matches nav_web room style
          ctx.strokeStyle = "rgba(0,0,0,1)";
          ctx.lineWidth   = 4 / vp.zoom;
          ctx.lineJoin    = "miter";
          ctx.stroke();

          const c    = centroid(poly);
          const size = Math.max(8, Math.min(13, 11 / vp.zoom));
          ctx.fillStyle    = "#1e293b";
          ctx.font         = `600 ${size}px sans-serif`;
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(room.name ?? room.id ?? "", c.x, c.y);
        }
        ctx.filter = "none";

        // 4. Navigation path
        const pts = pathPointsRef.current;
        if (pts && pts.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.strokeStyle = "rgba(0,188,212,0.95)";
          ctx.lineWidth   = 6 / vp.zoom;
          ctx.lineJoin    = "round";
          ctx.lineCap     = "round";
          ctx.stroke();

          const r = 10 / vp.zoom;
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2);
          ctx.fillStyle = "#22c55e";
          ctx.fill();

          const last = pts[pts.length - 1];
          ctx.beginPath();
          ctx.arc(last.x, last.y, r, 0, Math.PI * 2);
          ctx.fillStyle = "#ef4444";
          ctx.fill();
        }

        ctx.restore();
      }

      renderRef.current = render;

      // ── heatmap builder ──────────────────────────────────────────────────
      function renderHeatmap() {
        const nm     = navmeshRef.current;
        const iotRaw = iotDataRef.current;
        if (!nm || !nm.nodes) { render(); return; }

        const telPoints = [];
        for (const node of nm.nodes) {
          if (node.type !== "room") continue;
          const occ = Number(iotRaw[node.id]);
          if (!isFinite(occ) || occ <= 0) continue;
          const pos = node.position ?? (node.polygon ? centroid(node.polygon) : null);
          if (!pos) continue;
          telPoints.push({
            x: pos.x ?? (Array.isArray(pos) ? pos[0] : 0),
            y: pos.y ?? (Array.isArray(pos) ? pos[1] : 0),
            value: occ,
          });
        }
        if (!telPoints.length) { heatCanvas._bounds = null; render(); return; }

        // Derive map bounds from all polygon vertices
        let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
        const allPolys = [
          ...(nm.nodes ?? []).map(n => n.polygon).filter(p => Array.isArray(p) && p.length >= 3),
          ...(nm.corridor_polygons ?? [])
            .map(c => c?.polygon ?? (Array.isArray(c) ? c : null))
            .filter(p => Array.isArray(p) && p.length >= 3),
        ];
        for (const poly of allPolys) {
          for (const p of poly) {
            const px = Array.isArray(p) ? p[0] : p.x;
            const py = Array.isArray(p) ? p[1] : p.y;
            if (Number.isFinite(px)) { bMinX = Math.min(bMinX, px); bMaxX = Math.max(bMaxX, px); }
            if (Number.isFinite(py)) { bMinY = Math.min(bMinY, py); bMaxY = Math.max(bMaxY, py); }
          }
        }
        if (!Number.isFinite(bMinX)) {
          bMinX = 0; bMinY = 0;
          bMaxX = nm?.scale_info?.svg_dimensions?.width  ?? 1600;
          bMaxY = nm?.scale_info?.svg_dimensions?.height ?? 900;
        }
        const bounds = { minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY };

        let cell = 14;
        let gridData = aggregateHeatmapGrid(telPoints, cell, 400, bounds);
        if (!gridData || gridData.width === 0) { render(); return; }

        const maxTex = 2048;
        while ((gridData.width > maxTex || gridData.height > maxTex) && cell < 200) {
          cell = Math.ceil(cell * 1.25);
          gridData = aggregateHeatmapGrid(telPoints, cell, 400, bounds);
        }

        const rgba = generateHeatmapImageData(gridData, "rainbow", 1.0);
        heatCanvas.width  = gridData.width;
        heatCanvas.height = gridData.height;
        heatCanvas.getContext("2d").putImageData(
          new ImageData(rgba, gridData.width, gridData.height), 0, 0
        );
        heatCanvas._bounds = {
          minX: bounds.minX,
          minY: bounds.minY,
          w: gridData.width  * cell,
          h: gridData.height * cell,
        };
        render();
      }

      renderHeatmapRef.current = renderHeatmap;

      // ── navmesh helpers ──────────────────────────────────────────────────
      function buildHitTest(nm) {
        hitTestRef.current = [];
        for (const node of nm.nodes ?? []) {
          const poly = node.polygon;
          if (!poly || poly.length < 3) continue;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const p of poly) {
            const x = Array.isArray(p) ? p[0] : p.x;
            const y = Array.isArray(p) ? p[1] : p.y;
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          }
          hitTestRef.current.push({ node, poly, bbox: { minX, minY, maxX, maxY } });
        }
      }

      function centerMap() {
        const nm   = navmeshRef.current;
        const svgW = nm?.scale_info?.svg_dimensions?.width  ?? 1600;
        const svgH = nm?.scale_info?.svg_dimensions?.height ?? 900;
        const zoom = Math.min(canvas.width / svgW, canvas.height / svgH) * 0.92;
        vp.zoom = zoom;
        vp.x    = (canvas.width  / zoom - svgW) / 2;
        vp.y    = (canvas.height / zoom - svgH) / 2;
        render();
      }

      container._resetView = centerMap;
      container._zoomIn    = () => { vp.zoom = Math.min(5, vp.zoom * 1.25); render(); };
      container._zoomOut   = () => { vp.zoom = Math.max(0.3, vp.zoom / 1.25); render(); };

      // ── pan / zoom ───────────────────────────────────────────────────────
      let dragging = false, dragStart = { x: 0, y: 0 }, vpStart = { x: 0, y: 0 };

      canvas.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        dragging  = true;
        dragStart = { x: e.clientX, y: e.clientY };
        vpStart   = { x: vp.x, y: vp.y };
        canvas.style.cursor = "grabbing";
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      });

      canvas.addEventListener("pointermove", (e) => {
        if (dragging) {
          vp.x = vpStart.x + (e.clientX - dragStart.x) / vp.zoom;
          vp.y = vpStart.y + (e.clientY - dragStart.y) / vp.zoom;
          render();
          if (tooltipRef.current) tooltipRef.current.style.display = "none";
          return;
        }

        // Hover tooltip
        const tip  = tooltipRef.current;
        const hits = hitTestRef.current;
        if (!tip || !hits.length) return;

        const rect = canvas.getBoundingClientRect();
        const { x: wx, y: wy } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

        let found = null;
        for (const h of hits) {
          if (wx < h.bbox.minX || wx > h.bbox.maxX || wy < h.bbox.minY || wy > h.bbox.maxY) continue;
          if (pointInPolygon(wx, wy, h.poly)) { found = h; break; }
        }

        if (!found) { tip.style.display = "none"; return; }

        const occ    = Number(iotDataRef.current[found.node.id]);
        const occPct = isFinite(occ) && occ > 0 ? Math.round(occ * 100) : null;
        const crowd  = occPct !== null ? getCrowdStatus(occ) : null;

        tip.innerHTML =
          `<div style="font-weight:700;font-size:13px;margin-bottom:3px">${found.node.name ?? found.node.id ?? "Room"}</div>` +
          (occPct !== null
            ? `<div style="font-size:12px;opacity:0.85;margin-bottom:2px">Occupancy: ${occPct}%</div>` +
              `<div style="font-size:11px;font-weight:700;color:${crowd.color}">${crowd.label}</div>`
            : "");

        const cRect = container.getBoundingClientRect();
        tip.style.display = "block";
        tip.style.left = Math.max(8, Math.min(e.clientX - cRect.left + 14, cRect.width  - 180)) + "px";
        tip.style.top  = Math.max(8, Math.min(e.clientY - cRect.top  + 14, cRect.height - 90))  + "px";
      });

      const stopDrag = () => { dragging = false; canvas.style.cursor = "grab"; };
      canvas.addEventListener("pointerup",     stopDrag);
      canvas.addEventListener("pointercancel", stopDrag);
      canvas.addEventListener("pointerleave",  () => {
        if (tooltipRef.current) tooltipRef.current.style.display = "none";
      });

      canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const rect    = canvas.getBoundingClientRect();
        const mx      = e.clientX - rect.left;
        const my      = e.clientY - rect.top;
        const factor  = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const newZoom = Math.max(0.3, Math.min(5, vp.zoom * factor));
        vp.x    = mx / newZoom - mx / vp.zoom + vp.x;
        vp.y    = my / newZoom - my / vp.zoom + vp.y;
        vp.zoom = newZoom;
        render();
      }, { passive: false });

      // ── resize ───────────────────────────────────────────────────────────
      ro = new ResizeObserver(() => {
        const w = container.clientWidth, h = container.clientHeight;
        if (w > 0 && h > 0) { canvas.width = w; canvas.height = h; render(); }
      });
      ro.observe(container);

      // ── data loading ─────────────────────────────────────────────────────
      async function loadNavmesh() {
        try {
          const res  = await fetch(`${apiBase}/nav/navmesh`, { cache: "no-store" });
          const data = await res.json();
          if (!res.ok || !data?.nodes) return;
          navmeshRef.current = data;
          buildHitTest(data);
          centerMap();
        } catch (_) {}
      }

      async function loadIoT() {
        try {
          const res  = await fetch(`${apiBase}/nav/iot/data`, { cache: "no-store" });
          const data = await res.json();
          if (data && typeof data === "object") {
            iotDataRealRef.current = data;
            iotDataRef.current = demoModeRef.current
              ? buildDemoIoTData(data, navmeshRef.current?.nodes)
              : { ...data };
            renderHeatmap();
          }
        } catch (_) {}
      }

      loadNavmesh().then(loadIoT);
      intervalRef.current = setInterval(loadIoT, 5000);

    }, 0); // end deferred init

    return () => {
      alive = false;
      clearTimeout(timeoutId);
      clearInterval(intervalRef.current);
      if (ro) ro.disconnect();
      if (canvasRef.current) {
        try { canvasRef.current.remove(); } catch (_) {}
        canvasRef.current = null;
        ctxRef.current    = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  // ─── zoom button handlers ────────────────────────────────────────────────
  const zoomIn    = () => containerRef.current?._zoomIn?.();
  const zoomOut   = () => containerRef.current?._zoomOut?.();
  const resetView = () => containerRef.current?._resetView?.();

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Canvas2D inserted by useEffect */}

      {/* Hover tooltip */}
      <div ref={tooltipRef} style={tooltipStyle} />

      {/* Zoom controls */}
      <div style={zoomBar}>
        <button onClick={zoomIn}    style={zoomBtn} title="Zoom in">+</button>
        <button onClick={zoomOut}   style={zoomBtn} title="Zoom out">−</button>
        <button onClick={resetView} style={zoomBtn} title="Reset view">⟳</button>
      </div>
    </div>
  );
}

// ─── styles ─────────────────────────────────────────────────────────────────

const tooltipStyle = {
  position:       "absolute",
  display:        "none",
  pointerEvents:  "none",
  background:     "rgba(15,23,42,0.88)",
  backdropFilter: "blur(6px)",
  color:          "white",
  padding:        "8px 12px",
  borderRadius:   10,
  zIndex:         20,
  minWidth:       130,
  boxShadow:      "0 4px 16px rgba(0,0,0,0.3)",
  lineHeight:     1.4,
};

const zoomBar = {
  position:      "absolute",
  top:           10,
  right:         10,
  display:       "flex",
  flexDirection: "column",
  gap:           4,
  zIndex:        10,
};

const zoomBtn = {
  width:          32,
  height:         32,
  borderRadius:   8,
  border:         "1px solid #e5e7eb",
  background:     "white",
  color:          "#374151",
  fontWeight:     700,
  fontSize:       16,
  cursor:         "pointer",
  boxShadow:      "0 2px 6px rgba(0,0,0,0.1)",
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
  lineHeight:     1,
};
