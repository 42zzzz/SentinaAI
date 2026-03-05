import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Sparkline from "../components/Sparkline";
import "./EnvironmentalPage.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function fmt(n, digits = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

// simple SVG bar chart (like your “Live Energy Usage” look)
function BarTrend({ points = [], height = 220 }) {
  const w = 520;
  const h = height;
  const pad = 14;

  if (!points.length) return <div style={{ height, opacity: 0.6 }}>No data yet.</div>;

  const vals = points.map((p) => Number(p.value || 0)).filter(Number.isFinite);
  const maxV = Math.max(...vals, 1);

  const barCount = points.length;
  const barGap = 3;
  const usableW = w - pad * 2;
  const barW = Math.max(4, Math.floor((usableW - barGap * (barCount - 1)) / barCount));

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {points.map((p, i) => {
        const v = Number(p.value || 0);
        const bh = Math.round(clamp01(v / maxV) * (h - pad * 2));
        const x = pad + i * (barW + barGap);
        const y = h - pad - bh;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={bh}
            rx="3"
            fill="var(--accent)"
            opacity="0.28"
          />
        );
      })}
    </svg>
  );
}

export default function EnvironmentalPage() {
  const [q, setQ] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [metric, setMetric] = useState("air_quality"); // dropdown
  const [sort, setSort] = useState("desc");

  const [overview, setOverview] = useState(null);
  const [byZone, setByZone] = useState([]);
  const [anoms, setAnoms] = useState([]);

  const [trendAQ, setTrendAQ] = useState([]);
  const [trendTemp, setTrendTemp] = useState([]);
  const [trendHum, setTrendHum] = useState([]);
  const [trendCarbon, setTrendCarbon] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Debounce search
  const [qLive, setQLive] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQLive(q.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setErr("");

      try {
        // 1) Overview KPIs (24h)
        const ov = await axios.get(`${API_BASE}/environment/overview`, {
          params: { hours: 24, zone_id: zoneId || undefined },
        });

        // 2) By-zone bars (24h)
        const bz = await axios.get(`${API_BASE}/environment/by-zone`, {
          params: { hours: 24, metric },
        });

        // 3) Anomalies list (24h)
        const an = await axios.get(`${API_BASE}/environment/anomalies`, {
          params: { hours: 24, limit: 6 },
        });

        // 4) Trends (sparklines + live bars)
        const [tAQ, tTemp, tHum, tCarb] = await Promise.all([
          axios.get(`${API_BASE}/dashboard/trends`, {
            params: { metric: "efficiency", hours: 6, zone_id: zoneId || undefined },
          }),
          axios.get(`${API_BASE}/dashboard/trends`, {
            params: { metric: "temperature", hours: 24, zone_id: zoneId || undefined },
          }),
          axios.get(`${API_BASE}/dashboard/trends`, {
            params: { metric: "humidity", hours: 24, zone_id: zoneId || undefined },
          }),
          axios.get(`${API_BASE}/dashboard/trends`, {
            params: { metric: "carbon", hours: 24, zone_id: zoneId || undefined },
          }),
        ]);

        if (!alive) return;

        setOverview(ov.data?.kpis || null);

        // filter by-zone rows using search (optional)
        const rows = (bz.data?.rows || []).filter((r) =>
          qLive ? String(r.zone_id || "").toLowerCase().includes(qLive) : true
        );

        // sort rows
        rows.sort((a, b) => (sort === "asc" ? a.value - b.value : b.value - a.value));
        setByZone(rows);

        setAnoms(an.data?.rows || []);
        setTrendAQ((tAQ.data?.points || []).map((p) => ({ ts: p.ts, value: p.value })));
        setTrendTemp((tTemp.data?.points || []).map((p) => ({ ts: p.ts, value: p.value })));
        setTrendHum((tHum.data?.points || []).map((p) => ({ ts: p.ts, value: p.value })));
        setTrendCarbon((tCarb.data?.points || []).map((p) => ({ ts: p.ts, value: p.value })));
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || e.message || "Failed to load environmental data");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    const t = setInterval(load, 15000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [zoneId, metric, sort, qLive]);

  const metricLabel = useMemo(() => {
    if (metric === "temperature") return "Temperature (°C)";
    if (metric === "humidity") return "Humidity (%)";
    if (metric === "carbon") return "Carbon (kgCO2)";
    if (metric === "efficiency") return "Efficiency (%)";
    return "Air Quality Score";
  }, [metric]);

  const byZoneMax = useMemo(() => {
    if (!byZone.length) return 1;
    return Math.max(...byZone.map((r) => Number(r.value || 0)), 1);
  }, [byZone]);

  const downloadReport = () => {
    // light CSV report (overview + zone table + anomalies)
    const lines = [];
    lines.push(["Environmental Report", new Date().toISOString()].join(","));
    lines.push("");

    if (overview) {
      lines.push("Overview (24h)");
      lines.push("air_quality_score,avg_temp_c,avg_humidity_pct,total_carbon_kgco2,avg_efficiency_score,avg_comfort_index");
      lines.push(
        [
          overview.air_quality_score,
          overview.avg_temp_c,
          overview.avg_humidity_pct,
          overview.total_carbon_kgco2,
          overview.avg_efficiency_score,
          overview.avg_comfort_index,
        ].join(",")
      );
      lines.push("");
    }

    lines.push("By Zone");
    lines.push("zone_id,value");
    byZone.forEach((r) => lines.push([r.zone_id, r.value].join(",")));
    lines.push("");

    lines.push("Anomalies (24h)");
    lines.push("label,count");
    anoms.forEach((r) => lines.push([r.label, r.count].join(",")));

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Environmental_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // live chart uses “efficiency” points (6h) just as a visual “live environmental signal”
  // (we can swap this to air_quality later if you add a direct sensor field)
  const livePoints = trendAQ;

  return (
    <div className="sustTheme envPage">
      <div className="envInner">
        {/* top controls */}
        <div className="envControls">
          <div className="envPill envSearch">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search here"
              className="envInput"
            />
          </div>

          <div className="envPill envSelect">
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="envSelectEl">
              <option value="">Zone</option>
              {/* we keep zones from byZone list */}
              {[...new Set(byZone.map((r) => r.zone_id))].map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            <span className="envCaret" />
          </div>

          <div className="envPill envSelect">
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className="envSelectEl">
              <option value="air_quality">Metrics: Air quality</option>
              <option value="temperature">Metrics: Temperature</option>
              <option value="humidity">Metrics: Humidity</option>
              <option value="carbon">Metrics: Carbon</option>
              <option value="efficiency">Metrics: Efficiency</option>
              <option value="comfort">Metrics: Comfort</option>
            </select>
            <span className="envCaret" />
          </div>

          <div className="envPill envSelect">
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="envSelectEl">
              <option value="desc">Sort: {metricLabel} (desc)</option>
              <option value="asc">Sort: {metricLabel} (asc)</option>
            </select>
            <span className="envCaret" />
          </div>

          <button className="envDownloadBtn" onClick={downloadReport}>
            Download Report
          </button>
        </div>

        {err ? <div className="envError">{err}</div> : null}

        {/* top grid */}
        <div className="envGridTop">
          <div className="envCard">
            <div className="envCardHead">
              <div className="envCardTitle">Live Environmental Signal</div>
            </div>
            <div className="envCardBody">
              {loading ? <div className="envMuted">Loading…</div> : <BarTrend points={livePoints} />}
            </div>
          </div>

          <div className="envCard">
            <div className="envCardHead">
              <div className="envCardTitle">Average by Zone (24h)</div>
            </div>
            <div className="envCardBody">
              {loading ? (
                <div className="envMuted">Loading…</div>
              ) : (
                <div className="envBars">
                  {byZone.map((r) => {
                    const v = Number(r.value || 0);
                    const pct = clamp01(v / byZoneMax) * 100;
                    return (
                      <div className="envBarRow" key={r.zone_id}>
                        <div className="envBarLabel">{r.zone_id}</div>
                        <div className="envBarTrack">
                          <div className="envBarFill" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="envBarValue">{fmt(v, metric === "carbon" ? 1 : 0)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="envCard">
            <div className="envCardHead">
              <div className="envCardTitle">Anomalies / Alerts</div>
              <div className="envPillMini">Last 24h</div>
            </div>
            <div className="envCardBody">
              {loading ? (
                <div className="envMuted">Loading…</div>
              ) : (
                <div className="envList">
                  {anoms.length ? (
                    anoms.map((a, idx) => (
                      <div className="envListRow" key={idx}>
                        <div className="envListLabel">{a.label}</div>
                        <div className="envListCount">{a.count}</div>
                      </div>
                    ))
                  ) : (
                    <div className="envMuted">No anomalies in the last 24h.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* bottom KPIs */}
        <div className="envGridBottom">
          <div className="envKpi">
            <div className="envKpiTop">
              <div className="envKpiLabel">Total Carbon (24h)</div>
              <div className="envKpiValue">
                {overview ? fmt(overview.total_carbon_kgco2, 0) : "—"} <span className="envUnit">kgCO2</span>
              </div>
              <div className="envKpiSub">Sum across halls/intervals</div>
            </div>
            <div className="envKpiChart">
              <Sparkline points={trendCarbon} height={110} xMode="time" />
            </div>
          </div>

          <div className="envKpi">
            <div className="envKpiTop">
              <div className="envKpiLabel">Avg Indoor Temp (24h)</div>
              <div className="envKpiValue">
                {overview ? fmt(overview.avg_temp_c, 1) : "—"} <span className="envUnit">°C</span>
              </div>
              <div className="envKpiSub">
                Range: {overview ? `${fmt(overview.min_temp_c, 1)}–${fmt(overview.max_temp_c, 1)}°C` : "—"}
              </div>
            </div>
            <div className="envKpiChart">
              <Sparkline points={trendTemp} height={110} xMode="time" />
            </div>
          </div>

          <div className="envKpi">
            <div className="envKpiTop">
              <div className="envKpiLabel">Avg Humidity (24h)</div>
              <div className="envKpiValue">
                {overview ? fmt(overview.avg_humidity_pct, 0) : "—"} <span className="envUnit">%</span>
              </div>
              <div className="envKpiSub">Comfort band target ~45–55%</div>
            </div>
            <div className="envKpiChart">
              <Sparkline points={trendHum} height={110} xMode="time" />
            </div>
          </div>

          <div className="envKpi">
            <div className="envKpiTop">
              <div className="envKpiLabel">Air Quality Score (24h)</div>
              <div className="envKpiValue">
                {overview ? fmt(overview.air_quality_score, 0) : "—"} <span className="envUnit">/ 100</span>
              </div>
              <div className="envKpiSub">Derived from temp + humidity + carbon</div>
            </div>
            <div className="envKpiChart">
              {/* reuse efficiency as a “signal” trend */}
              <Sparkline points={trendAQ} height={110} xMode="time" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}