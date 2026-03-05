// frontend/src/pages/NavigationPage.jsx
import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// Your NEW map space (SVG viewBox / PNG export space)
const MAP_W = 1600;
const MAP_H = 900;

function toRoomOption(r) {
  const id = r?.id || r?.room_id || r?.name || r?.label;
  const label = r?.name || r?.label || r?.id || r?.room_id;
  return id ? { id, label } : null;
}

function normalizePoint(p) {
  // backend may return {x,y} or [x,y]
  if (Array.isArray(p) && p.length >= 2) {
    const x = Number(p[0]);
    const y = Number(p[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }
  if (p && typeof p === "object") {
    const x = Number(p.x ?? p.X ?? p.cx ?? p.left ?? p[0]);
    const y = Number(p.y ?? p.Y ?? p.cy ?? p.top ?? p[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }
  return null;
}

export default function NavigationPage() {
  const [roomsRaw, setRoomsRaw] = useState([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pathPts, setPathPts] = useState([]); // points in 1600x900 coord space now
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const roomsRes = await fetch(`${API_BASE}/nav/rooms`);
        const roomsData = await roomsRes.json();

        if (!alive) return;
        if (!roomsRes.ok) throw new Error(roomsData?.error || "Failed to load rooms");

        const list = Array.isArray(roomsData) ? roomsData : roomsData.rooms || [];
        setRoomsRaw(Array.isArray(list) ? list : []);

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

  async function findPath() {
    setError("");
    setPathPts([]);

    try {
      const r = await fetch(`${API_BASE}/nav/pathfind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end }),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Pathfind failed");

      const raw = data.path_coordinates_smooth || data.path_coordinates || [];
      const normalized = (Array.isArray(raw) ? raw : []).map(normalizePoint).filter(Boolean);

      setPathPts(normalized);

      // Debug: prove coords are now inside ~1600x900 space
      if (normalized.length) {
        const xs = normalized.map((p) => p.x);
        const ys = normalized.map((p) => p.y);
        console.log("PATH x range:", Math.min(...xs), Math.max(...xs));
        console.log("PATH y range:", Math.min(...ys), Math.max(...ys));
        console.log("MAP:", { MAP_W, MAP_H });
      }
    } catch (e) {
      setError(e.message || "Pathfind failed");
    }
  }

  const points = pathPts.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div style={{ display: "grid", gap: 12 }}>
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
            Rooms: {options.length} • Img: {MAP_W}×{MAP_H}
          </div>

          {error ? <div style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</div> : null}
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "auto", display: "block", background: "white" }}
        >
          {/* Draw the PNG in its native 1600x900 coordinate space */}
          <image href="/convention_map.png" x="0" y="0" width={MAP_W} height={MAP_H} preserveAspectRatio="none" />

          {/* Route (coords now match map space directly) */}
          {pathPts.length > 1 ? (
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

          {/* Start/End dots */}
          {pathPts.length > 0 ? <circle cx={pathPts[0].x} cy={pathPts[0].y} r="8" fill="blue" /> : null}
          {pathPts.length > 1 ? (
            <circle cx={pathPts[pathPts.length - 1].x} cy={pathPts[pathPts.length - 1].y} r="8" fill="green" />
          ) : null}
        </svg>

        <div style={{ padding: 12, fontSize: 12, opacity: 0.75 }}>
          {pathPts.length ? `Path points: ${pathPts.length}` : "Choose Start/End and click Find Path."}
        </div>
      </div>
    </div>
  );
}

const card = {
  padding: 16,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "white",
  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
};

const sel = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
};

const btn = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "none",
  background: "#E8486F",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(232, 72, 111, 0.35)",
  transition: "transform 0.05s ease",
};