import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export default function AiSimulateSurge({ onSimulated }) {
  const [rows, setRows] = useState([]);
  const [hallId, setHallId] = useState("");
  const [occupancy, setOccupancy] = useState(85);
  const [co2, setCo2] = useState(950);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const hallOptions = useMemo(() => {
    // rows from /ai/ops-live: { hall_id, hall_name, ... }
    return rows
      .map((h) => h.hall_id)
      .filter(Boolean);
  }, [rows]);

  useEffect(() => {
    let alive = true;

    const loadHalls = async () => {
      try {
        // ✅ Telemetry-driven source
        const r = await axios.get(`${API_BASE}/ai/ops-live`);
        if (!alive) return;

        if (r.data && r.data.ok === false) {
          throw new Error(r.data.error || "AI ops-live failed");
        }

        const fetched = r.data?.rows || [];
        setRows(fetched);

        if (!hallId && fetched.length) setHallId(fetched[0].hall_id);
        setMsg({ type: "", text: "" });
      } catch (e) {
        if (!alive) return;
        setMsg({
          type: "error",
          text: e?.response?.data?.error || e.message || "Failed to load halls from ops-live",
        });
      }
    };

    loadHalls();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const simulate = async () => {
    setLoading(true);
    setMsg({ type: "", text: "" });

    try {
      if (!hallId) throw new Error("Please select a hall.");

      const occ = Math.max(0, Math.min(100, Number(occupancy)));
      const co2Val = Number(co2);

      // We keep using the simulation endpoint for surge injection demo
      const r = await axios.post(`${API_BASE}/ai/simulate-prediction`, {
        hall_id: hallId,
        occupancy: occ,
        co2: co2Val,
      });

      setMsg({
        type: "success",
        text: `Simulated surge for ${hallId} (occupancy ${occ}%, CO₂ ${co2Val}).`,
      });

      if (typeof onSimulated === "function") onSimulated(r.data);
    } catch (e) {
      setMsg({
        type: "error",
        text: e?.response?.data?.error || e?.response?.data?.detail || e.message || "Simulation failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white" }}>
      <div style={{ padding: 14, fontWeight: 900, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>AI Simulator – Trigger Crowd Surge</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Halls source: /ai/ops-live</div>
      </div>

      <div style={{ padding: 14, display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Hall</div>
            <select
              value={hallId}
              onChange={(e) => setHallId(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            >
              {hallOptions.length ? (
                hallOptions.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))
              ) : (
                <option value="">No halls loaded</option>
              )}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Occupancy (%)</div>
            <input
              type="number"
              min={0}
              max={100}
              value={occupancy}
              onChange={(e) => setOccupancy(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>CO₂ (ppm)</div>
            <input
              type="number"
              min={0}
              value={co2}
              onChange={(e) => setCo2(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </div>
        </div>

        <button
          onClick={simulate}
          disabled={loading || !hallOptions.length}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111827",
            background: loading ? "#f3f4f6" : "#111827",
            color: loading ? "#111827" : "white",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Simulating..." : "Simulate Surge"}
        </button>

        {msg.text ? (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: msg.type === "error" ? "#fff1f2" : "#ecfdf5",
              border: msg.type === "error" ? "1px solid #fecdd3" : "1px solid #bbf7d0",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {msg.text}
          </div>
        ) : null}

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Tip: occupancy above <b>75%</b> triggers spillover. (AI actions may still show <b>none</b> until model/rules are improved.)
        </div>
      </div>
    </div>
  );
}