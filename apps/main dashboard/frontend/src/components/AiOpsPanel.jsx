import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function Badge({ children, danger }) {
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 12,
        background: danger ? "#fee2e2" : "#dcfce7",
      }}
    >
      {children}
    </span>
  );
}

export default function AiOpsPanel() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        // ✅ Telemetry-driven AI (Option A)
        const r = await axios.get(`${API_BASE}/ai/ops-live`);
        if (!alive) return;

        if (r.data && r.data.ok === false) {
          throw new Error(r.data.error || "AI ops-live failed");
        }

        setRows(r.data?.rows || []);
        setErr("");
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || e.message || "Failed to load AI ops-live");
      }
    };

    load();
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", overflowX: "auto" }}>
      <div style={{ padding: 14, fontWeight: 900, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>AI Operations – Live Status</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Source: /ai/ops-live</div>
      </div>

      {err ? (
        <div style={{ padding: 12, background: "#fff1f2" }}>
          <div style={{ fontWeight: 800 }}>AI Error</div>
          <div style={{ fontFamily: "monospace", fontSize: 12 }}>{err}</div>
        </div>
      ) : null}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
            <th style={{ padding: 12 }}>Hall</th>
            <th style={{ padding: 12 }}>Occupancy</th>
            <th style={{ padding: 12 }}>CO₂</th>
            <th style={{ padding: 12 }}>Congestion</th>
            <th style={{ padding: 12 }}>AI Action</th>
            <th style={{ padding: 12 }}>Anomaly</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.hall_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: 12, fontWeight: 900 }}>{h.hall_name ? `${h.hall_name} (${h.hall_id})` : h.hall_id}</td>
              <td style={{ padding: 12 }}>{Math.round((h.occupancyRatio ?? 0) * 100)}%</td>
              <td style={{ padding: 12 }}>{Math.round(Number(h.co2 || 0))}</td>
              <td style={{ padding: 12 }}>{Number(h.flowCongestionIndex ?? 0).toFixed(2)}</td>
              <td style={{ padding: 12 }}>
                <Badge danger={h.aiAction && String(h.aiAction).toLowerCase() !== "none"}>{h.aiAction || "none"}</Badge>
              </td>
              <td style={{ padding: 12 }}>
                <Badge danger={!!h.isAnomaly}>{h.isAnomaly ? "Yes" : "No"}</Badge>
              </td>
            </tr>
          ))}

          {!rows.length ? (
            <tr>
              <td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>
                No AI rows yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}