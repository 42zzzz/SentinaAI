// frontend/src/pages/EnergyPage.jsx
import "./EnergyPage.css";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Sparkline from "../components/Sparkline";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const SUST_GREEN = "#00802B";

function CardShell({ title, right, children }) {
  return (
    <div className="energyCard">
      <div className="energyCardHeader">
        <div className="energyCardTitle">{title}</div>
        {right ? <div className="energyCardRight">{right}</div> : null}
      </div>
      <div className="energyCardBody">{children}</div>
    </div>
  );
}

function BarsMiniChart({ points = [] }) {
  const vals = points.map((p) => Number(p.value || 0)).filter(Number.isFinite);
  const max = Math.max(...vals, 1);

  return (
    <div className="barsWrap" aria-hidden="true">
      {points.map((p, i) => {
        const v = Number(p.value || 0);
        const h = Math.max(2, Math.round((v / max) * 92));
        return <div key={i} className="bar" style={{ height: `${h}%` }} />;
      })}
    </div>
  );
}

function HorizontalBars({ rows = [] }) {
  const max = useMemo(() => Math.max(...rows.map((r) => Number(r.value || 0)), 1), [rows]);

  return (
    <div className="hBars">
      {rows.map((r, idx) => {
        const v = Number(r.value || 0);
        const w = Math.round((v / max) * 100);
        return (
          <div className="hBarRow" key={`${r.label}-${idx}`}>
            <div className="hBarLabel">{r.label}</div>
            <div className="hBarTrack">
              <div className="hBarFill" style={{ width: `${w}%` }} />
            </div>
            <div className="hBarVal">{Number.isFinite(v) ? v.toFixed(0) : "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

function KpiMiniCard({ label, value, sub, points }) {
  return (
    <div className="kpiMini" style={{ overflow: "hidden" }}>
      <div className="kpiMiniTop">
        <div className="kpiMiniLabel">{label}</div>
        <div className="kpiMiniValue">{value}</div>
      </div>
      {sub ? <div className="kpiMiniSub">{sub}</div> : null}
      <div className="kpiMiniSpark" style={{ width: "100%", overflow: "hidden", marginTop: 10 }}>
        <Sparkline points={points} height={85} accent={SUST_GREEN} />
      </div>
    </div>
  );
}

export default function EnergyPage() {
  const [q, setQ] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [metric, setMetric] = useState("energy");
  const [sortBy, setSortBy] = useState("kwh_desc");

  const [err, setErr] = useState("");

  const [energyPoints24h, setEnergyPoints24h] = useState([]);
  const [sparkEnergy6h, setSparkEnergy6h] = useState([]);

  const [zones, setZones] = useState([]);
  const [sources, setSources] = useState([]);
  const [anoms, setAnoms] = useState([]);

  // Live energy usage (24h)
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const r = await axios.get(`${API_BASE}/dashboard/trends`, {
          params: {
            metric,
            hours: 24,
            zone_id: zoneId || undefined,
          },
        });
        if (!alive) return;
        setEnergyPoints24h(r.data?.points || []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || e.message || "Failed to load live energy usage");
      }
    };

    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [metric, zoneId]);

  // Widgets (zones / sources / anomalies + 6h spark)
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const [z, s, a, e6] = await Promise.all([
          axios.get(`${API_BASE}/energy/zones-latest-day`, { params: { zone_id: zoneId || undefined } }),
          axios.get(`${API_BASE}/energy/sources-latest-day`, { params: { zone_id: zoneId || undefined } }),
          axios.get(`${API_BASE}/energy/anomalies-summary`, { params: { hours: 24, limit: 6 } }),
          axios.get(`${API_BASE}/dashboard/trends`, { params: { metric: "energy", hours: 6, zone_id: zoneId || undefined } }),
        ]);

        if (!alive) return;

        setZones(z.data?.rows || []);
        setSources(s.data?.rows || []);
        setAnoms(a.data?.rows || []);
        setSparkEnergy6h(e6.data?.points || []);
        setErr("");
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || e.message || "Failed to load energy widgets");
      }
    };

    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [zoneId]);

  // ✅ FIX: compute KPIs from real data we already have (no /energy/kpis-24h needed)
  const kpis = useMemo(() => {
    const totalKwh24h = (sources || []).reduce((sum, r) => sum + Number(r.total_kwh || 0), 0);

    const hvacKwh24h = (sources || [])
      .filter((r) => {
        const src = String(r.source || "").toLowerCase();
        return src === "derived_csv" || src.includes("hvac");
      })
      .reduce((sum, r) => sum + Number(r.total_kwh || 0), 0);

    const hvacSharePct = totalKwh24h > 0 ? (hvacKwh24h / totalKwh24h) * 100 : 0;

    const peakKwhInterval = Math.max(...(energyPoints24h || []).map((p) => Number(p.value || 0)), 0);

    return {
      totalKwh24h,
      peakKwhInterval,
      hvacKwh24h,
      hvacSharePct,
    };
  }, [sources, energyPoints24h]);

  const zonesFiltered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const rows = (zones || []).map((z) => ({
      label: z.zone_id,
      value: Number(z.total_kwh || 0),
    }));

    const filtered = !qq ? rows : rows.filter((r) => String(r.label || "").toLowerCase().includes(qq));

    if (sortBy === "kwh_asc") return filtered.sort((a, b) => a.value - b.value);
    return filtered.sort((a, b) => b.value - a.value);
  }, [zones, q, sortBy]);

  // ✅ REVERT: always show the device-type bar list (even if it’s only derived_csv)
  const sourcesFiltered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const rows = (sources || []).map((s) => ({
      label: String(s.source || "unknown"),
      value: Number(s.total_kwh || 0),
    }));

    const filtered = !qq ? rows : rows.filter((r) => String(r.label || "").toLowerCase().includes(qq));

    if (sortBy === "kwh_asc") return filtered.sort((a, b) => a.value - b.value);
    return filtered.sort((a, b) => b.value - a.value);
  }, [sources, q, sortBy]);

  const barsPoints = useMemo(() => energyPoints24h.slice(-36), [energyPoints24h]);

  return (
    <div className="sustTheme">
      <div className="energyPage">
        <div className="energyInner">
          {/* Filters row */}
          <div className="energyFiltersRow">
            <div className="filterPill pillSearch">
              <input
                className="pillInput"
                placeholder="Search here"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="filterPill pillSelectWrap">
              <select className="pillSelect" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                <option value="">Zone</option>
                {["zoneA", "zoneB", "zoneC", "zoneD"].map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <span className="pillRightCaret" aria-hidden />
            </div>

            <div className="filterPill pillSelectWrap">
              <select className="pillSelect" value={metric} onChange={(e) => setMetric(e.target.value)}>
                <option value="energy">Metrics: HVAC energy</option>
                <option value="temperature">Metrics: Temperature</option>
                <option value="carbon">Metrics: Carbon</option>
              </select>
              <span className="pillRightCaret" aria-hidden />
            </div>

            <div className="filterPill pillSelectWrap">
              <select className="pillSelect" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="kwh_desc">Sort by: kWh (desc)</option>
                <option value="kwh_asc">Sort by: kWh (asc)</option>
              </select>
              <span className="pillRightCaret" aria-hidden />
            </div>

            <button className="downloadBtn">
              Download Report
            </button>
          </div>

          {err ? <div className="energyError">{err}</div> : null}

          {/* Top 3 cards */}
          <div className="energyGridTop">
            <CardShell title="Live Energy Usage">
              <div className="liveChart">
                <BarsMiniChart points={barsPoints} />
              </div>
            </CardShell>

            <CardShell title="Average Consumption Per Zone (kWh)">
              <HorizontalBars rows={zonesFiltered} />
            </CardShell>

            <CardShell title="Energy Consumption By Device Type">
              <HorizontalBars rows={sourcesFiltered} />
            </CardShell>
          </div>

          {/* KPI row + anomalies */}
          <div className="energyGridBottom">
            <div className="kpiRow">
              <KpiMiniCard
                label="Total Energy (24h)"
                value={`${kpis.totalKwh24h.toFixed(0)} kWh`}
                sub="Sum of all intervals"
                points={sparkEnergy6h}
              />

              <KpiMiniCard
                label="Peak Interval (24h)"
                value={`${kpis.peakKwhInterval.toFixed(1)} kWh`}
                sub="Max 15-min interval"
                points={sparkEnergy6h}
              />

              <KpiMiniCard
                label="HVAC Share (24h)"
                value={`${kpis.hvacSharePct.toFixed(0)}%`}
                sub={`${kpis.hvacKwh24h.toFixed(0)} kWh HVAC`}
                points={sparkEnergy6h}
              />
            </div>

            <CardShell title="Anomalies / Alerts" right={<span className="hintPill">Last 24h</span>}>
              <div className="anomList">
                {!anoms.length ? (
                  <div className="anomEmpty">No anomalies found.</div>
                ) : (
                  anoms.map((a, i) => (
                    <div className="anomRow" key={i}>
                      <div className="anomLabel">{a.label}</div>
                      <div className="anomCount">{a.count}</div>
                    </div>
                  ))
                )}
              </div>
            </CardShell>
          </div>
        </div>
      </div>
    </div>
  );
}