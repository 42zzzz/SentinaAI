// NavigationMap.jsx
// PixiJS-powered convention-centre floor plan for the main dashboard.
// Drops in as a replacement for the old SVG overlay in NavigationPage.jsx.

import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import "@pixi/canvas-renderer"; // registers CanvasRenderer so PIXI can fall back (or be forced) to Canvas2D
import { aggregateHeatmapGrid, generateHeatmapImageData } from "../utils/heatmapUtils.js";

// ─── helpers ───────────────────────────────────────────────────────────────

function getHallColor(name) {
  const n = (name ?? "").toLowerCase();
  if (n.startsWith("north hall")) return { color: 0x9e2a2b, alpha: 0.45 };
  if (n.startsWith("east hall"))  return { color: 0x1f3a5f, alpha: 0.45 };
  if (n.startsWith("south hall")) return { color: 0xe09f3e, alpha: 0.45 };
  if (n.startsWith("hall")) {
    const num = parseInt(n.replace("hall", "").trim(), 10);
    if (!isNaN(num)) {
      if (num >= 1 && num <= 6) return { color: 0x2f8f9d, alpha: 0.4 };
      if (num >= 7 && num <= 10) return { color: 0x1f3a5f, alpha: 0.3 };
    }
  }
  return { color: 0xaaaacc, alpha: 0.3 };
}

function polyPoints(poly) {
  // accepts [[x,y]] or [{x,y}]
  const pts = [];
  for (const p of poly ?? []) {
    if (Array.isArray(p)) { pts.push(p[0], p[1]); }
    else { pts.push(p.x, p.y); }
  }
  return pts;
}

function centroid(poly) {
  if (!poly || poly.length === 0) return { x: 0, y: 0 };
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

// Deterministic hash + PRNG (FNV-1a + Mulberry32) for stable demo values
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

// ─── component ─────────────────────────────────────────────────────────────

export default function NavigationMap({ apiBase, pathPoints, showHeatmap, demoMode }) {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null); // set to app.view after PIXI init

  // Stable refs so callbacks see latest values without re-mounting PIXI
  const appRef        = useRef(null);
  const layersRef     = useRef({});
  const navmeshRef    = useRef(null);
  const iotDataRef    = useRef({});
  const viewportRef   = useRef({ zoom: 1, x: 0, y: 0 });
  const heatSpriteRef = useRef(null);
  const heatCanvasRef = useRef(null);
  const showHeatRef   = useRef(showHeatmap);
  const intervalRef   = useRef(null);
  const tooltipRef       = useRef(null);
  const hitTestRef       = useRef([]);
  const demoModeRef      = useRef(demoMode);
  const iotDataRealRef   = useRef({});     // raw data from backend
  const renderHeatmapRef = useRef(null);   // set inside main useEffect

  // Keep showHeat ref in sync + re-render heatmap instantly on toggle
  useEffect(() => {
    showHeatRef.current = showHeatmap;
    const { heatmap, rooms, corridors, corridorOutlines } = layersRef.current;

    if (heatmap) heatmap.visible = showHeatmap;

    // Re-render in case the sprite was created while the layer was hidden
    if (showHeatmap) renderHeatmapRef.current?.();

    // Greyscale hall colours so they don't clash with the rainbow heatmap
    const makeGrey = () => {
      const f = new PIXI.ColorMatrixFilter();
      f.greyscale(0, false);
      return [f];
    };
    if (rooms)            rooms.filters            = showHeatmap ? makeGrey() : null;
    if (corridors)        corridors.filters        = showHeatmap ? makeGrey() : null;
    if (corridorOutlines) corridorOutlines.filters = showHeatmap ? makeGrey() : null;
  }, [showHeatmap]);

  // Demo mode toggle: rebuild iot data and re-render heatmap
  useEffect(() => {
    demoModeRef.current = demoMode;
    const nm = navmeshRef.current;
    if (!nm) return;
    const real = iotDataRealRef.current;
    iotDataRef.current = demoMode ? buildDemoIoTData(real, nm.nodes) : { ...real };
    renderHeatmapRef.current?.();
    if (layersRef.current.heatmap) layersRef.current.heatmap.visible = showHeatRef.current;
  }, [demoMode]);

  // Re-draw path whenever pathPoints changes
  useEffect(() => {
    const layer = layersRef.current.path;
    if (!layer) return;
    layer.removeChildren();
    if (!pathPoints || pathPoints.length < 2) return;

    const g = new PIXI.Graphics();
    g.lineStyle(6, 0x00bcd4, 0.95);
    g.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) g.lineTo(pathPoints[i].x, pathPoints[i].y);

    // start (green) / end (red) circles
    const start = new PIXI.Graphics();
    start.beginFill(0x22c55e).drawCircle(pathPoints[0].x, pathPoints[0].y, 10).endFill();
    const end = new PIXI.Graphics();
    end.beginFill(0xef4444).drawCircle(pathPoints[pathPoints.length - 1].x, pathPoints[pathPoints.length - 1].y, 10).endFill();

    layer.addChild(g, start, end);
  }, [pathPoints]);

  // ─── mount: init PIXI ────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Defer PIXI init by one macrotask so React 18 StrictMode's immediate
    // cleanup can cancel the timeout before a WebGL context is ever created.
    // This avoids the "Unable to auto-detect a suitable renderer" error caused
    // by StrictMode's mount→cleanup→remount cycle exhausting WebGL contexts.
    let app = null;
    let ro  = null;
    const timeoutId = setTimeout(() => {

    // Use explicit pixel dimensions — avoids WebGL context creation on a 0×0 canvas
    const W = Math.max(container.clientWidth,  1);
    const H = Math.max(container.clientHeight, 1);

    // Let PIXI create its own canvas with known dimensions (no view: option)
    app = new PIXI.Application({
      width: W,
      height: H,
      backgroundColor: 0xf8fafc,
      antialias: true,
      resolution: 1,
      forceCanvas: true, // 2D floor plan needs no WebGL; Canvas2D frees GPU contexts for Three.js
    });
    appRef.current = app;

    // Insert canvas before the zoom controls overlay
    app.view.style.display = "block";
    app.view.style.width   = "100%";
    app.view.style.height  = "100%";
    container.insertBefore(app.view, container.firstChild);
    canvasRef.current = app.view; // so pan/zoom listeners use the real canvas
    app.stage.sortableChildren = true;

    // layers
    const layers = {
      corridors:       new PIXI.Container(),
      heatmap:         new PIXI.Container(),
      corridorOutlines:new PIXI.Container(),
      rooms:           new PIXI.Container(),
      path:            new PIXI.Container(),
    };
    layers.corridors.zIndex        = 10;
    layers.heatmap.zIndex          = 20;
    layers.corridorOutlines.zIndex = 5;
    layers.rooms.zIndex            = 40;
    layers.path.zIndex             = 50;
    layers.heatmap.visible         = showHeatRef.current;

    for (const l of Object.values(layers)) app.stage.addChild(l);
    layersRef.current = layers;

    // reusable offscreen canvas for heatmap texture
    heatCanvasRef.current = document.createElement("canvas");

    // ─── pan / zoom ────────────────────────────────────────────────────────
    let dragging = false, dragStart = { x: 0, y: 0 }, vpStart = { x: 0, y: 0 };

    const applyViewport = () => {
      const vp = viewportRef.current;
      app.stage.scale.set(vp.zoom);
      app.stage.position.set(vp.x * vp.zoom, vp.y * vp.zoom);
    };

    const cv = app.view; // shorthand for event binding

    cv.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      vpStart   = { ...viewportRef.current };
      try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    });
    cv.addEventListener("pointermove", (e) => {
      if (dragging) {
        const vp = viewportRef.current;
        vp.x = vpStart.x + (e.clientX - dragStart.x) / vp.zoom;
        vp.y = vpStart.y + (e.clientY - dragStart.y) / vp.zoom;
        applyViewport();
        if (tooltipRef.current) tooltipRef.current.style.display = "none";
        return;
      }

      // ── hover tooltip ──────────────────────────────────────────────────────
      const tip  = tooltipRef.current;
      const hits = hitTestRef.current;
      if (!tip || !hits.length) return;

      const rect  = cv.getBoundingClientRect();
      const world = app.stage.toLocal(new PIXI.Point(e.clientX - rect.left, e.clientY - rect.top));
      const wx = world.x, wy = world.y;

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

      const cRect = containerRef.current.getBoundingClientRect();
      const relX  = e.clientX - cRect.left;
      const relY  = e.clientY - cRect.top;
      tip.style.display = "block";
      tip.style.left = Math.max(8, Math.min(relX + 14, cRect.width  - 180)) + "px";
      tip.style.top  = Math.max(8, Math.min(relY + 14, cRect.height - 90))  + "px";
    });
    const stopDrag = () => { dragging = false; };
    cv.addEventListener("pointerup",     stopDrag);
    cv.addEventListener("pointercancel", stopDrag);
    cv.addEventListener("pointerleave",  () => { if (tooltipRef.current) tooltipRef.current.style.display = "none"; });

    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
      const vp  = viewportRef.current;
      const rect = cv.getBoundingClientRect();
      const mx  = e.clientX - rect.left;
      const my  = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = Math.max(0.3, Math.min(5, vp.zoom * factor));
      // zoom toward cursor
      vp.x = mx / newZoom - mx / vp.zoom + vp.x;
      vp.y = my / newZoom - my / vp.zoom + vp.y;
      vp.zoom = newZoom;
      applyViewport();
    }, { passive: false });

    // ─── resize ────────────────────────────────────────────────────────────
    ro = new ResizeObserver(() => {
      const w = container.clientWidth, h = container.clientHeight;
      if (w > 0 && h > 0) app.renderer.resize(w, h);
    });
    ro.observe(container);

    // ─── rendering helpers ─────────────────────────────────────────────────

    function centerMap() {
      const nm = navmeshRef.current;
      const svgW = nm?.scale_info?.svg_dimensions?.width  ?? 1600;
      const svgH = nm?.scale_info?.svg_dimensions?.height ?? 900;
      const scW  = app.screen.width, scH = app.screen.height;
      const zoom  = Math.min(scW / svgW, scH / svgH) * 0.92;
      viewportRef.current = {
        zoom,
        x: (scW / zoom - svgW) / 2,
        y: (scH / zoom - svgH) / 2,
      };
      applyViewport();
    }

    // expose reset for button
    containerRef.current._resetView = centerMap;
    containerRef.current._zoomIn    = () => { viewportRef.current.zoom = Math.min(5, viewportRef.current.zoom * 1.25); applyViewport(); };
    containerRef.current._zoomOut   = () => { viewportRef.current.zoom = Math.max(0.3, viewportRef.current.zoom / 1.25); applyViewport(); };

    function drawRooms(nm) {
      const layer = layers.rooms;
      layer.removeChildren();
      for (const room of nm.rooms ?? []) {
        const poly = room.polygon;
        if (!poly || poly.length < 3) continue;
        const pts = polyPoints(poly);
        const { color, alpha } = getHallColor(room.name);
        const g = new PIXI.Graphics();
        g.beginFill(color, alpha);
        g.lineStyle(1.5, color, 0.6);
        g.drawPolygon(pts);
        g.endFill();
        layer.addChild(g);

        // label
        const c = centroid(poly);
        const label = new PIXI.Text(room.name ?? room.id ?? "", {
          fontSize: 11,
          fill: 0x1e293b,
          fontWeight: "600",
          align: "center",
          wordWrap: true,
          wordWrapWidth: 120,
        });
        label.anchor.set(0.5);
        label.position.set(c.x, c.y);
        layer.addChild(label);
      }
    }

    function drawCorridors(nm) {
      const layer = layers.corridors;
      const outlines = layers.corridorOutlines;
      layer.removeChildren();
      outlines.removeChildren();
      for (const corridor of nm.corridor_polygons ?? []) {
        // corridor_polygons items are either {polygon:[...]} objects or raw arrays
        const poly = corridor?.polygon ?? (Array.isArray(corridor) ? corridor : null);
        if (!Array.isArray(poly) || poly.length < 3) continue;
        const pts = polyPoints(poly);

        // Fill — near-transparent background colour so it's neutral under semi-transparent rooms
        const g = new PIXI.Graphics();
        g.beginFill(0xf8fafc, 0.05);
        g.drawPolygon(pts);
        g.endFill();
        layer.addChild(g);

        // Outline — faint wall boundary; low alpha prevents bleed through room fills
        const o = new PIXI.Graphics();
        o.lineStyle(2, 0x555555, 0.25);
        o.drawPolygon(pts);
        outlines.addChild(o);
      }
    }

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

    function renderHeatmap() {
      const nm     = navmeshRef.current;
      const iotRaw = iotDataRef.current;
      const layer  = layers.heatmap;
      layer.removeChildren();
      heatSpriteRef.current = null;

      if (!nm || !nm.nodes) return;

      // Build {x, y, value} points from room centroids + IoT occupancy
      const telPoints = [];
      for (const node of nm.nodes) {
        if (node.type !== "room") continue;
        const occ = Number(iotRaw[node.id]);
        if (!isFinite(occ) || occ <= 0) continue;
        const pos = node.position ?? (node.polygon ? centroid(node.polygon) : null);
        if (!pos) continue;
        const x = pos.x ?? (Array.isArray(pos) ? pos[0] : 0);
        const y = pos.y ?? (Array.isArray(pos) ? pos[1] : 0);
        telPoints.push({ x, y, value: occ });
      }
      if (telPoints.length === 0) return;

      // Derive bounds from ALL polygon vertices so the heatmap always covers
      // the full map regardless of whether scale_info matches the coordinate space
      let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
      const allPolys = [
        ...(nm.nodes ?? []).map(n => n.polygon).filter(p => Array.isArray(p) && p.length >= 3),
        ...(nm.corridor_polygons ?? []).map(c => c?.polygon ?? (Array.isArray(c) ? c : null)).filter(p => Array.isArray(p) && p.length >= 3),
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

      const cell = 14;
      let gridData = aggregateHeatmapGrid(telPoints, cell, 400, bounds);
      if (!gridData || gridData.width === 0) return;

      // Cap to avoid WebGL texture limits
      const maxTex = 2048;
      let scaledCell = cell;
      while ((gridData.width > maxTex || gridData.height > maxTex) && scaledCell < 200) {
        scaledCell = Math.ceil(scaledCell * 1.25);
        gridData = aggregateHeatmapGrid(telPoints, scaledCell, 400, bounds);
      }

      const rgba     = generateHeatmapImageData(gridData, "rainbow", 1.0);
      const offCanvas = heatCanvasRef.current;
      offCanvas.width  = gridData.width;
      offCanvas.height = gridData.height;
      const ctx = offCanvas.getContext("2d");
      ctx.putImageData(new ImageData(rgba, gridData.width, gridData.height), 0, 0);

      const tex = PIXI.Texture.from(offCanvas);
      tex.baseTexture.resource.update(); // force PixiJS to re-read canvas data on reuse
      const sprite = new PIXI.Sprite(tex);
      sprite.x      = bounds.minX;
      sprite.y      = bounds.minY;
      sprite.width  = gridData.width  * scaledCell;
      sprite.height = gridData.height * scaledCell;
      sprite.alpha  = 0.75;
      layer.addChild(sprite);
      heatSpriteRef.current = sprite;
    }

    // Expose renderHeatmap so the demoMode useEffect can call it without re-mounting
    renderHeatmapRef.current = renderHeatmap;

    // ─── data loading ──────────────────────────────────────────────────────

    async function loadNavmesh() {
      try {
        const res  = await fetch(`${apiBase}/nav/navmesh`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data?.nodes) return;
        navmeshRef.current = data;
        drawRooms(data);
        buildHitTest(data);
        drawCorridors(data);
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

    async function refresh() {
      await loadIoT();
      if (layersRef.current.heatmap) layersRef.current.heatmap.visible = showHeatRef.current;
    }

    loadNavmesh().then(loadIoT);
    intervalRef.current = setInterval(refresh, 5000);

    }, 0); // end of deferred init setTimeout

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalRef.current);
      if (ro) ro.disconnect();
      if (app) {
        try { app.destroy(true, { children: true, texture: true, baseTexture: true }); } catch (_) {}
      }
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  // ─── zoom button handlers (read from exposed refs) ─────────────────────
  const zoomIn    = () => containerRef.current?._zoomIn?.();
  const zoomOut   = () => containerRef.current?._zoomOut?.();
  const resetView = () => containerRef.current?._resetView?.();

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* PIXI injects its canvas here via useEffect */}

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
  position: "absolute",
  top: 10,
  right: 10,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  zIndex: 10,
};

const zoomBtn = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "white",
  color: "#374151",
  fontWeight: 700,
  fontSize: 16,
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};
