import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function LineChart({ points }) {
  // points: [{ offsetMinutes, predictedOccupancy }]
  const w = 520;
  const h = 160;
  const pad = 18;

  const xs = points.map((p) => p.offsetMinutes);
  const ys = points.map((p) => p.predictedOccupancy);

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  const xScale = (x) => {
    if (xMax === xMin) return pad;
    return pad + ((x - xMin) / (xMax - xMin)) * (w - pad * 2);
  };
  const yScale = (y) => {
    if (yMax === yMin) return h / 2;
    return h - pad - ((y - yMin) / (yMax - yMin)) * (h - pad * 2);
  };

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.offsetMinutes)} ${yScale(p.predictedOccupancy)}`)
    .join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {/* axes */}
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#e5e7eb" />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#e5e7eb" />

      {/* line */}
      <path d={d} fill="none" stroke="#111827" strokeWidth="2" />

      {/* points */}
      {points.map((p) => (
        <circle key={p.offsetMinutes} cx={xScale(p.offsetMinutes)} cy={yScale(p.predictedOccupancy)} r="3" fill="#111827" />
      ))}

      {/* labels */}
      <text x={pad} y={pad - 4} fontSize="10" fill="#6b7280">
        {yMax} ppl
      </text>
      <text x={pad} y={h - 4} fontSize="10" fill="#6b7280">
        {yMin} ppl
      </text>
    </svg>
  );
}

export default function PredictedOccupancyChart({ refreshSignal }) {
  const [rows, setRows] = useState([]);
  const [hallId, setHallId] = useState("");
  const [forecast, setForecast] = useState(null);
  const [err, setErr] = useState("");

  // Load halls from ops-live (telemetry-driven)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await axios.get(`${API_BASE}/ai/ops-live`);
        if (!alive) return;
        const list = r.data?.rows || [];
        setRows(list);
        if (!hallId && list.length) setHallId(list[0].hall_id);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || e.message || "Failed to load halls");
      }
    };
    load();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  // Load forecast for selected hall
  useEffect(() => {
    let alive = true;
    const loadForecast = async () => {
      try {
        if (!hallId) return;
        const r = await axios.get(`${API_BASE}/ai/occupancy-forecast`, { params: { hall_id: hallId } });
        if (!alive) return;
        if (r.data?.ok === false) throw new Error(r.data.error || "Forecast error");
        console.log("Forecast response in frontend:", r.data);
        setForecast(r.data);
        setErr("");
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || e.message || "Failed to load forecast");
      }
    };
    loadForecast();
    const t = setInterval(loadForecast, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [hallId, refreshSignal]);

  const selected = useMemo(() => rows.find((x) => x.hall_id === hallId), [rows, hallId]);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white" }}>
      <div style={{ padding: 14, fontWeight: 900, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>Predicted Occupancy (Next 60 min)</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Source: /ai/occupancy-forecast</div>
      </div>

      <div style={{ padding: 14, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>Hall:</div>
          <select
            value={hallId}
            onChange={(e) => setHallId(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", minWidth: 220 }}
          >
            {rows.map((h) => (
              <option key={h.hall_id} value={h.hall_id}>
                {h.hall_name ? `${h.hall_name} (${h.hall_id})` : h.hall_id}
              </option>
            ))}
          </select>

          {selected ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Current: <b>{Math.round((selected.occupancyRatio || 0) * 100)}%</b> ({selected.current_occupancy} ppl)
            </div>
          ) : null}
        </div>

        {err ? (
          <div style={{ padding: 12, background: "#fff1f2", borderRadius: 10, border: "1px solid #fecdd3", fontWeight: 700 }}>
            {err}
          </div>
        ) : null}

        {forecast?.points?.length ? (
          <>
            <LineChart points={forecast.points} />
            <div style={{ display: "flex", gap: 12, fontSize: 12, opacity: 0.75, flexWrap: "wrap" }}>
              {forecast.points.map((p) => (
                <div key={p.offsetMinutes}>
                  +{p.offsetMinutes}m: <b>{p.predictedOccupancy}</b>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.7 }}>No forecast points yet.</div>
        )}
      </div>
    </div>
  );
}