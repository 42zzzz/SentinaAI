import { useEffect, useState } from "react";
import axios from "axios";
import TopHallsToday from "../components/TopHallsToday";
import AiOpsPanel from "../components/AiOpsPanel";
import AiSimulateSurge from "../components/AiSimulateSurge";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function Card({ title, value, sub }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, border: "1px solid #e5e7eb", background: "white" }}>
      <div style={{ fontWeight: 800, opacity: 0.8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{value}</div>
      {sub ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>{sub}</div> : null}
    </div>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [zones, setZones] = useState([]);
  const [error, setError] = useState("");

  // Poll every 10s (MVP “live”). Later swap to SSE/WebSocket.
  useEffect(() => {
    let alive = true;

    const fetchAll = async () => {
      try {
        const [ov, zs] = await Promise.all([
          axios.get(`${API_BASE}/dashboard/overview`),
          axios.get(`${API_BASE}/dashboard/zones-summary`),
        ]);
        if (!alive) return;
        setOverview(ov.data);
        setZones(zs.data.rows || []);
        setError("");
      } catch (e) {
        if (!alive) return;
        setError(e?.response?.data?.error || e.message || "Failed to load dashboard");
      }
    };

    fetchAll();
    const t = setInterval(fetchAll, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const k = overview?.kpis;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {error ? (
        <div style={{ padding: 12, borderRadius: 12, background: "#fff1f2" }}>
          <div style={{ fontWeight: 800 }}>Error</div>
          <div style={{ fontFamily: "monospace", fontSize: 12 }}>{error}</div>
        </div>
      ) : null}

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Card title="Current Occupancy" value={k ? k.currentOccupancy : "—"} sub={overview?.ts ? `Latest interval: ${new Date(overview.ts).toLocaleString()}` : ""} />
        <Card title="Average Temperature (°C)" value={k ? k.averageTemperatureC : "—"} />
        <Card title="Crowd Flow" value={k ? `${k.crowdFlowEfficiencyPct}%` : "—"} sub="Derived from congestion index" />
        <Card title="Comfort Index" value={k ? k.comfortIndex : "—"} sub={`Overcrowded halls: ${k ? k.overcrowdedHalls : "—"}`} />
      </div>

      {/* Zone table */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", overflowX: "auto" }}>
        <div style={{ padding: 14, fontWeight: 900 }}>Zone Overview</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: 12 }}>Zone</th>
              <th style={{ padding: 12 }}>Occupancy Status</th>
              <th style={{ padding: 12 }}>Crowd Flow</th>
              <th style={{ padding: 12 }}>Comfort Score</th>
              <th style={{ padding: 12 }}>Issues</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.zone_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: 12, fontWeight: 900 }}>{z.zone_id}</td>
                <td style={{ padding: 12 }}>{z.occupancyStatus}</td>
                <td style={{ padding: 12 }}>{z.crowdFlow}</td>
                <td style={{ padding: 12 }}>{z.comfortScore}</td>
                <td style={{ padding: 12 }}>
                  <span style={{ padding: "4px 10px", borderRadius: 999, background: z.issueStatus === "Critical" ? "#fee2e2" : "#dcfce7", fontWeight: 800, fontSize: 12 }}>
                    {z.issues?.length ? z.issues.join(", ") : "Normal"}
                  </span>
                </td>
              </tr>
            ))}
            {!zones.length ? (
              <tr>
                <td colSpan={5} style={{ padding: 12, opacity: 0.7 }}>No zone data yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      
      <AiSimulateSurge onSimulated={() => {
      }} />
      <AiOpsPanel />
      <TopHallsToday zoneId="zoneB" limit={5} />
    </div>
  );
}