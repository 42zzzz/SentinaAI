import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const r = await axios.get(`${API_BASE}/ai/venue-status`);
        if (!alive) return;

        const rows = Array.isArray(r.data) ? r.data : r.data?.rows || [];
        setAlerts(rows.filter((x) => x.isAnomaly));
        setErr("");
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || e.message || "Failed to load alerts");
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
    <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "white" }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>AI Alerts (Operations)</div>

      {err ? (
        <div style={{ padding: 12, borderRadius: 12, background: "#fff1f2", marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>Error</div>
          <div style={{ fontFamily: "monospace", fontSize: 12 }}>{err}</div>
        </div>
      ) : null}

      {!alerts.length ? (
        <div style={{ opacity: 0.7 }}>No anomalies right now.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {alerts.map((a) => (
            <div key={a.hall_id} style={{ padding: 12, borderRadius: 12, border: "1px solid #fee2e2", background: "#fff1f2" }}>
              <div style={{ fontWeight: 900 }}>{a.hall_id}</div>
              <div style={{ marginTop: 4, fontSize: 13 }}>
                Occupancy: <b>{Math.round((a.occupancyRatio ?? 0) * 100)}%</b> · CO₂: <b>{a.co2}</b>
              </div>
              <div style={{ marginTop: 6, fontSize: 13 }}>
                Recommended action: <b>{a.aiAction}</b>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}