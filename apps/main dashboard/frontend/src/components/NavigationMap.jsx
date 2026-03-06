// NavigationMap.jsx
// PixiJS-powered convention-centre floor plan for the main dashboard.
// Drops in as a replacement for the old SVG overlay in NavigationPage.jsx.

import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { aggregateHeatmapGrid, generateHeatmapImageData, getPolygonBounds } from "../utils/heatmapUtils.js";

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

function toXY(poly) {
  return (poly ?? []).map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y });
}

// ─── component ─────────────────────────────────────────────────────────────

export default function NavigationMap({ apiBase, pathPoints, showHeatmap }) {
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

  // Keep showHeat ref in sync + re-render heatmap instantly on toggle
  useEffect(() => {
    showHeatRef.current = showHeatmap;
    if (layersRef.current.heatmap) {
      layersRef.current.heatmap.visible = showHeatmap;
    }
  }, [showHeatmap]);

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

    // Use explicit pixel dimensions — avoids WebGL context creation on a 0×0 canvas
    const W = Math.max(container.clientWidth,  1);
    const H = Math.max(container.clientHeight, 1);

    // Let PIXI create its own canvas with known dimensions (no view: option)
    const app = new PIXI.Application({
      width: W,
      height: H,
      backgroundColor: 0xf8fafc,
      antialias: true,
      resolution: 1,
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
    layers.corridorOutlines.zIndex = 30;
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
      if (!dragging) return;
      const vp = viewportRef.current;
      vp.x = vpStart.x + (e.clientX - dragStart.x) / vp.zoom;
      vp.y = vpStart.y + (e.clientY - dragStart.y) / vp.zoom;
      applyViewport();
    });
    const stopDrag = () => { dragging = false; };
    cv.addEventListener("pointerup",     stopDrag);
    cv.addEventListener("pointercancel", stopDrag);

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
    const ro = new ResizeObserver(() => {
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
      for (const poly of nm.corridor_polygons ?? []) {
        if (!poly || poly.length < 3) continue;
        const pts = polyPoints(poly);
        const g = new PIXI.Graphics();
        g.beginFill(0x6b2737, 0.35);
        g.drawPolygon(pts);
        g.endFill();
        layer.addChild(g);

        const o = new PIXI.Graphics();
        o.lineStyle(1, 0x4a1025, 0.5);
        o.drawPolygon(pts);
        outlines.addChild(o);
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

      // Bounds over all room positions
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of telPoints) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }
      // Pad so outer halls get full coverage
      const pad = 100;
      const bounds = { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };

      const cell = 14;
      let gridData = aggregateHeatmapGrid(telPoints, cell, 80, bounds);
      if (!gridData || gridData.width === 0) return;

      // Cap to avoid WebGL texture limits
      const maxTex = 2048;
      let scaledCell = cell;
      while ((gridData.width > maxTex || gridData.height > maxTex) && scaledCell < 200) {
        scaledCell = Math.ceil(scaledCell * 1.25);
        gridData = aggregateHeatmapGrid(telPoints, scaledCell, 80, bounds);
      }

      const rgba     = generateHeatmapImageData(gridData, "hot", 1.0);
      const offCanvas = heatCanvasRef.current;
      offCanvas.width  = gridData.width;
      offCanvas.height = gridData.height;
      const ctx = offCanvas.getContext("2d");
      ctx.putImageData(new ImageData(rgba, gridData.width, gridData.height), 0, 0);

      const tex    = PIXI.Texture.from(offCanvas);
      const sprite = new PIXI.Sprite(tex);
      sprite.x      = bounds.minX;
      sprite.y      = bounds.minY;
      sprite.width  = gridData.width  * scaledCell;
      sprite.height = gridData.height * scaledCell;
      sprite.alpha  = 0.75;
      layer.addChild(sprite);
      heatSpriteRef.current = sprite;
    }

    // ─── data loading ──────────────────────────────────────────────────────

    async function loadNavmesh() {
      try {
        const res  = await fetch(`${apiBase}/nav/navmesh`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data?.nodes) return;
        navmeshRef.current = data;
        drawRooms(data);
        drawCorridors(data);
        centerMap();
      } catch (_) {}
    }

    async function loadIoT() {
      try {
        const res  = await fetch(`${apiBase}/nav/iot/data`, { cache: "no-store" });
        const data = await res.json();
        if (data && typeof data === "object") {
          iotDataRef.current = data;
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

    return () => {
      clearInterval(intervalRef.current);
      ro.disconnect();
      try { app.destroy(true, { children: true, texture: true, baseTexture: true }); } catch (_) {}
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

      {/* Zoom controls */}
      <div style={zoomBar}>
        <button onClick={zoomIn}    style={zoomBtn} title="Zoom in">+</button>
        <button onClick={zoomOut}   style={zoomBtn} title="Zoom out">−</button>
        <button onClick={resetView} style={zoomBtn} title="Reset view">⟳</button>
      </div>
    </div>
  );
}

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
