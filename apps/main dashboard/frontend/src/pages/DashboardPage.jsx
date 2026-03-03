import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import AiOpsPanel from "../components/AiOpsPanel";
import AiSimulateSurge from "../components/AiSimulateSurge";
import PredictedOccupancyChart from "../components/PredictedOccupancyChart";

import TrendPanel from "../components/TrendPanel";
import TopHallsEnergyBar from "../components/TopHallsEnergyBar";
import ComfortGauge from "../components/ComfortGauge";
import TopHallsBar from "../components/TopHallsBar";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function MiniCard({ title, value, sub }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        background: "white",
        minHeight: 110,
      }}
    >
      <div style={{ fontWeight: 900, opacity: 0.85 }}>{title}</div>
      <div style={{ fontSize: 30, fontWeight: 950, marginTop: 8, lineHeight: 1.05 }}>
        {value}
      </div>
      {sub ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>{sub}</div> : null}
    </div>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [simTick, setSimTick] = useState(0);

  // ✅ NEW: congestion value from trends (latest point)
  const [congestionLatest, setCongestionLatest] = useState(null);

  useEffect(() => {
    let alive = true;

    const fetchAll = async () => {
      try {
        const ov = await axios.get(`${API_BASE}/dashboard/overview`);
        if (!alive) return;
        setOverview(ov.data);
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
  }, [simTick]);

  // ✅ NEW: keep congestion mini-card always populated
  useEffect(() => {
    let alive = true;

    const loadCongestion = async () => {
      try {
        const r = await axios.get(`${API_BASE}/dashboard/trends`, {
          params: { metric: "congestion", limit: 1 },
        });
        if (!alive) return;
        const pts = r.data?.points || [];
        const v = pts.length ? Number(pts[pts.length - 1].value) : null;
        setCongestionLatest(Number.isFinite(v) ? v : null);
      } catch {
        if (!alive) return;
        setCongestionLatest(null);
      }
    };

    loadCongestion();
    const t = setInterval(loadCongestion, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [simTick]);

  const k = overview?.kpis;

  const latestTsLabel = useMemo(() => {
    if (!overview?.ts) return "";
    try {
      return `Latest interval: ${new Date(overview.ts).toLocaleString()}`;
    } catch {
      return "";
    }
  }, [overview?.ts]);

  const occupancyValue = useMemo(() => {
    const n = Number(k?.currentOccupancy);
    return Number.isFinite(n) ? String(Math.round(n)) : "—";
  }, [k?.currentOccupancy]);

  const tempValue = useMemo(() => {
    const n = Number(k?.averageTemperatureC);
    return Number.isFinite(n) ? n.toFixed(2) : "—";
  }, [k?.averageTemperatureC]);

  const crowdFlowValue = useMemo(() => {
    const n = Number(k?.crowdFlowEfficiencyPct);
    return Number.isFinite(n) ? `${Math.round(n)}%` : "—";
  }, [k?.crowdFlowEfficiencyPct]);

  const congestionValue = useMemo(() => {
    if (congestionLatest === null) return "—";
    return congestionLatest.toFixed(2);
  }, [congestionLatest]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {error ? (
        <div style={{ padding: 12, borderRadius: 12, background: "#fff1f2" }}>
          <div style={{ fontWeight: 800 }}>Error</div>
          <div style={{ fontFamily: "monospace", fontSize: 12 }}>{error}</div>
        </div>
      ) : null}

      {/* Row 1: 4 small cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        <MiniCard title="Occupancy" value={occupancyValue} sub={latestTsLabel} />
        <MiniCard title="Avg Temp (°C)" value={tempValue} />
        <MiniCard title="Crowd Flow" value={crowdFlowValue} sub="Derived from congestion index" />
        <MiniCard title="Congestion" value={congestionValue} />
      </div>

      {/* Row 2: Big charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <TrendPanel title="Carbon" metric="carbon" unit="kgCO2" hours={6} />
        <TrendPanel title="HVAC energy" metric="energy" unit="kWh" hours={6} />
      </div>

      {/* Row 3: Top 5 energy + Comfort gauge */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <TopHallsEnergyBar title="Top 5 halls by energy" zoneId="zoneB" limit={5} />
        <ComfortGauge title="Comfort Index" value={k ? k.comfortIndex : null} subtitle="Current interval" />
      </div>

      {/* Busiest halls snapshot */}
      <TopHallsBar title="Busiest halls (snapshot)" zoneId="zoneB" limit={8} />

      {/* Ops panels */}
      <AiSimulateSurge onSimulated={() => setSimTick((t) => t + 1)} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <AiOpsPanel />
        <PredictedOccupancyChart refreshSignal={simTick} />
      </div>
    </div>
  );
}