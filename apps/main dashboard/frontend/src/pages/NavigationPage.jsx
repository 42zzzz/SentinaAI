// frontend/src/pages/NavigationPage.jsx
import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// Your PNG pixel size (keep this EXACT, because we are mapping coords into this)
const IMG_W = 1600;
const IMG_H = 900;

function toRoomOption(r) {
  const id = r?.id || r?.room_id || r?.name || r?.label;
  const label = r?.name || r?.label || r?.id || r?.room_id;
  return id ? { id, label } : null;
}

function normalizePoint(p) {
  if (Array.isArray(p) && p.length >= 2) {
    const x = Number(p[0]);
    const y = Number(p[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
  }
  if (p && typeof p === "object") {
    const x = Number(p.x ?? p.X ?? p.cx ?? p.left ?? p[0]);
    const y = Number(p.y ?? p.Y ?? p.cy ?? p.top ?? p[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
  }
  return null;
}

export default function NavigationPage() {
  const [roomsRaw, setRoomsRaw] = useState([]);
  const [navInfo, setNavInfo] = useState(null);

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [pathNav, setPathNav] = useState([]); // navmesh coords
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Load rooms + navmesh
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [roomsRes, navRes] = await Promise.all([
          fetch(`${API_BASE}/nav/rooms`),
          fetch(`${API_BASE}/nav/navmesh`),
        ]);

        const roomsData = await roomsRes.json();
        const navmeshData = await navRes.json();

        if (!alive) return;

        if (!roomsRes.ok) throw new Error(roomsData?.error || "Failed to load rooms");
        if (!navRes.ok) throw new Error(navmeshData?.error || "Failed to load navmesh");

        const list = Array.isArray(roomsData) ? roomsData : roomsData.rooms || [];
        setRoomsRaw(Array.isArray(list) ? list : []);
        setNavInfo(navmeshData);

        const opts = (Array.isArray(list) ? list : []).map(toRoomOption).filter(Boolean);
        if (!start && opts[0]) setStart(opts[0].id);
        if (!end && opts[1]) setEnd(opts[1].id);
      } catch (e) {
        setError(e.message || "Failed to load navigation data");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(() => {
    return (Array.isArray(roomsRaw) ? roomsRaw : []).map(toRoomOption).filter(Boolean);
  }, [roomsRaw]);

  // Compute navmesh bounds (this is the coordinate space that path points are in)
  const navBounds = useMemo(() => {
    const nodes = navInfo?.nodes;
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1, maxY: 1, w: 1, h: 1 };
    }

    const xs = [];
    const ys = [];

    for (const n of nodes) {
      const b = n?.bounds;
      if (
        b &&
        Number.isFinite(b.x) &&
        Number.isFinite(b.y) &&
        Number.isFinite(b.width) &&
        Number.isFinite(b.height)
      ) {
        xs.push(b.x, b.x + b.width);
        ys.push(b.y, b.y + b.height);
        continue;
      }

      const x = n?.position?.x;
      const y = n?.position?.y;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        xs.push(x);
        ys.push(y);
      }
    }

    if (!xs.length || !ys.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1, w: 1, h: 1 };

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);

    return { minX, minY, maxX, maxY, w, h };
  }, [navInfo]);

  // Convert navmesh coords -> image pixel coords (1600x900)
  const pathPx = useMemo(() => {
    if (!pathNav.length) return [];

    const sx = IMG_W / navBounds.w;
    const sy = IMG_H / navBounds.h;

    // Map each point into [0..IMG_W, 0..IMG_H]
    return pathNav.map(([x, y]) => [
      (x - navBounds.minX) * sx,
      (y - navBounds.minY) * sy,
    ]);
  }, [pathNav, navBounds]);

  async function findPath() {
    setError("");
    setPathNav([]);

    try {
      const r = await fetch(`${API_BASE}/nav/pathfind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end }),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Pathfind failed");

      // prefer smooth coords if your Python returns them
      const raw = data.path_coordinates_smooth || data.path_coordinates || [];
      const normalized = (Array.isArray(raw) ? raw : []).map(normalizePoint).filter(Boolean);

      setPathNav(normalized);

      // Debug: confirm ranges
      if (normalized.length) {
        const xs = normalized.map((p) => p[0]);
        const ys = normalized.map((p) => p[1]);
        console.log("NAV x range:", Math.min(...xs), Math.max(...xs));
        console.log("NAV y range:", Math.min(...ys), Math.max(...ys));
        console.log("NAV bounds:", navBounds);
      }
    } catch (e) {
      setError(e.message || "Pathfind failed");
    }
  }

  const points = pathPx.map((p) => `${p[0]},${p[1]}`).join(" ");

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Controls */}
      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Navigation</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={start} onChange={(e) => setStart(e.target.value)} style={sel} disabled={loading}>
            <option value="">{loading ? "Loading..." : "Start"}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          <select value={end} onChange={(e) => setEnd(e.target.value)} style={sel} disabled={loading}>
            <option value="">{loading ? "Loading..." : "End"}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          <button onClick={findPath} disabled={!start || !end || loading} style={btn}>
            Find Path
          </button>

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Rooms: {options.length} • NavBox: {Math.round(navBounds.w)}×{Math.round(navBounds.h)} → Img: {IMG_W}×{IMG_H}
          </div>

          {error ? <div style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</div> : null}
        </div>
      </div>

      {/* Map + Path */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        {/* ONE SVG in PNG pixel coords */}
        <svg
          viewBox={`0 0 ${IMG_W} ${IMG_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "auto", display: "block", background: "white" }}
        >
          {/* PNG fills the SVG coordinate space exactly */}
          <image href="/convention_map.png" x="0" y="0" width={IMG_W} height={IMG_H} />

          {/* Route in PNG pixel coords */}
          {pathPx.length > 1 ? (
            <polyline
              fill="none"
              stroke="red"
              strokeWidth="10"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points}
              opacity="0.95"
            />
          ) : null}

          {/* Start dot */}
          {pathPx.length > 0 ? <circle cx={pathPx[0][0]} cy={pathPx[0][1]} r="8" fill="blue" /> : null}

          {/* End dot */}
          {pathPx.length > 1 ? (
            <circle cx={pathPx[pathPx.length - 1][0]} cy={pathPx[pathPx.length - 1][1]} r="8" fill="green" />
          ) : null}
        </svg>

        <div style={{ padding: 12, fontSize: 12, opacity: 0.75 }}>
          {pathPx.length ? `Path points: ${pathPx.length}` : "Choose Start/End and click Find Path."}
        </div>
      </div>
    </div>
  );
}

const card = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "white",
};

const sel = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
};

const btn = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
  fontWeight: 800,
  cursor: "pointer",
};