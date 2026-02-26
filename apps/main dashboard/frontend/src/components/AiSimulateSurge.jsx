import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export default function AiSimulateSurge({ onSimulated }) {
  const [halls, setHalls] = useState([]);
  const [hallId, setHallId] = useState("");
  const [occupancy, setOccupancy] = useState(85);
  const [co2, setCo2] = useState(950);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const hallOptions = useMemo(() => {
    // Expecting rows like: { hall_id: "hall1", occupancyRatio, co2, ... }
    return halls.map((h) => h.hall_id).filter(Boolean);
  }, [halls]);

  useEffect(() => {
    let alive = true;

    const loadHalls = async () => {
      try {
        const r = await axios.get(`${API_BASE}/ai/venue-status`);
        if (!alive) return;

        const rows = Array.isArray(r.data) ? r.data : r.data?.rows || [];
        setHalls(rows);

        // Default selection if empty
        if (!hallId && rows.length) setHallId(rows[0].hall_id);
      } catch (e) {
        if (!alive) return;
        setMsg({ type: "error", text: e?.response?.data?.error || e.message || "Failed to load halls" });
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

      // Clamp occupancy to 0–100
      const occ = Math.max(0, Math.min(100, Number(occupancy)));
      const co2Val = Number(co2);

      const r = await axios.post(`${API_BASE}/ai/simulate-prediction`, {
        hall_id: hallId,
        occupancy: occ,
        co2: co2Val,
      });

      // FastAPI returns something like { updates: [...] } OR an array depending on your implementation
      setMsg({ type: "success", text: `Simulated surge for ${hallId} (occupancy ${occ}%, CO₂ ${co2Val}).` });

      // Optional callback: tell parent to refresh immediately
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
        <div style={{ fontSize: 12, opacity: 0.7 }}>POST /ai/simulate-prediction</div>
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
          Tip: set occupancy above <b>75%</b> to trigger spillover and anomaly behaviour.
        </div>
      </div>
    </div>
  );
}