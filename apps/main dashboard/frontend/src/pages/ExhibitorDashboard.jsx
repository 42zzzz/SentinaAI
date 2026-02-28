import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_EXHIBITOR_ID = "EXH0240";

function buildQuery(params) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    qs.set(k, String(v));
  });
  return qs.toString();
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Simple blue->red scale (low=blue, high=red)
function heatColor(t) {
  const r = Math.round(lerp(40, 220, t));
  const g = Math.round(lerp(120, 60, t));
  const b = Math.round(lerp(220, 40, t));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function ExhibitorDashboard() {
  const [exhibitorId, setExhibitorId] = useState(DEFAULT_EXHIBITOR_ID);
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [catchmentK, setCatchmentK] = useState(6);
  const [mcPasses, setMcPasses] = useState(15);

  const [heatmap, setHeatmap] = useState(null);
  const [density, setDensity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const heatmapUrl = useMemo(() => {
    const qs = buildQuery({ intervalMinutes, catchmentK, mcPasses, agg: "mean" });
    return `/api/exhibitor-ai/api/exhibitor/${encodeURIComponent(
      exhibitorId
    )}/catchment/heatmap?${qs}`;
  }, [exhibitorId, intervalMinutes, catchmentK, mcPasses]);

  const densityUrl = useMemo(() => {
    const qs = buildQuery({ intervalMinutes, catchmentK, mcPasses });
    return `/api/exhibitor-ai/api/exhibitor/${encodeURIComponent(
      exhibitorId
    )}/competition/density?${qs}`;
  }, [exhibitorId, intervalMinutes, catchmentK, mcPasses]);

  const downloadUrl = useMemo(() => {
    const qs = buildQuery({ intervalMinutes, catchmentK, mcPasses });
    return `/api/exhibitor-ai-download/api/exhibitor/${encodeURIComponent(
      exhibitorId
    )}/report/download?${qs}`;
  }, [exhibitorId, intervalMinutes, catchmentK, mcPasses]);

  async function loadAll() {
    setErr("");
    setLoading(true);
    try {
      const [hRes, dRes] = await Promise.all([fetch(heatmapUrl), fetch(densityUrl)]);

      if (!hRes.ok) throw new Error(`Heatmap failed: ${hRes.status} ${await hRes.text()}`);
      if (!dRes.ok) throw new Error(`Density failed: ${dRes.status} ${await dRes.text()}`);

      const h = await hRes.json();
      const d = await dRes.json();

      setHeatmap(h);
      setDensity(d);
    } catch (e) {
      setHeatmap(null);
      setDensity(null);
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const densityLatest = useMemo(() => {
    if (!density?.series?.length) return null;
    return density.series[density.series.length - 1];
  }, [density]);

  const confidence = heatmap?.meta?.aiConfidence?.score ?? null;

  // Heatmap min/max (for colouring)
  const heatStats = useMemo(() => {
    if (!heatmap?.matrix?.length) return null;
    const values = heatmap.matrix.flat().map((v) => Number(v));
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const range = Math.max(1e-9, maxV - minV);
    return { minV, maxV, range };
  }, [heatmap]);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, Arial" }}>
      <h2 style={{ margin: 0 }}>Exhibitor Dashboard</h2>
      <p style={{ marginTop: 6, opacity: 0.8 }}>
        Live AI metrics for booth engagement (catchment) and competitive density.
      </p>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginTop: 12 }}>
        <div>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Exhibitor ID</label>
          <input
            value={exhibitorId}
            onChange={(e) => setExhibitorId(e.target.value)}
            style={{ display: "block", padding: 8, minWidth: 160 }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Interval (minutes)</label>
          <select
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            style={{ display: "block", padding: 8 }}
          >
            {[15, 30, 60, 120].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Catchment K</label>
          <input
            type="number"
            min={1}
            max={26}
            value={catchmentK}
            onChange={(e) => setCatchmentK(Number(e.target.value))}
            style={{ display: "block", padding: 8, width: 120 }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, opacity: 0.8 }}>MC passes</label>
          <input
            type="number"
            min={5}
            max={50}
            value={mcPasses}
            onChange={(e) => setMcPasses(Number(e.target.value))}
            style={{ display: "block", padding: 8, width: 120 }}
          />
        </div>

        <button onClick={loadAll} disabled={loading} style={{ padding: "10px 14px", cursor: "pointer" }}>
          {loading ? "Loading..." : "Refresh"}
        </button>

        <a href={downloadUrl} style={{ padding: "10px 14px", border: "1px solid #ccc", textDecoration: "none" }}>
          Download XLSX Report
        </a>
      </div>

      {err && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #f5c2c7", background: "#f8d7da" }}>
          <b>Error:</b> {err}
        </div>
      )}

      {/* KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginTop: 16,
        }}
      >
        <div style={{ border: "1px solid #ddd", padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Booth / Hall</div>
          <div style={{ fontSize: 16, marginTop: 6 }}>
            {heatmap?.meta?.boothId || "—"} · {heatmap?.meta?.hallName || "—"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Event: {heatmap?.meta?.eventId || "—"}</div>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>AI Confidence</div>
          <div style={{ fontSize: 22, marginTop: 6 }}>{confidence === null ? "—" : `${Math.round(confidence * 100)}%`}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Avg std: {heatmap?.meta?.aiConfidence?.avgStd?.toFixed?.(4) ?? "—"}
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Competitive Density (latest)</div>
          <div style={{ fontSize: 22, marginTop: 6 }}>{densityLatest ? densityLatest.competitive_density_label : "—"}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Score: {densityLatest ? densityLatest.competitive_density_score : "—"} · {densityLatest ? densityLatest.bucket_ts : ""}
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Catchment Engagement Heatmap</h3>

        {!heatmap ? (
          <div style={{ opacity: 0.7 }}>No data loaded.</div>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid #ddd" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #ddd",
                      background: "#fafafa",
                    }}
                  >
                    Time
                  </th>
                  {heatmap.xLabels.map((x) => (
                    <th
                      key={x}
                      style={{
                        textAlign: "left",
                        padding: 8,
                        borderBottom: "1px solid #ddd",
                        background: "#fafafa",
                      }}
                    >
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {heatmap.yLabels.map((t, rowIdx) => (
                  <tr key={t}>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{t}</td>

                    {heatmap.matrix[rowIdx].map((val, colIdx) => {
                      const num = Number(val);
                      const { minV, range } = heatStats || { minV: 0, range: 1 };
                      const norm = clamp01((num - minV) / range);
                      const bg = heatColor(norm);
                      const textColor = norm > 0.6 ? "#fff" : "#111";

                      return (
                        <td
                          key={`${t}-${colIdx}`}
                          title={`Value: ${num.toFixed(4)}`}
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #eee",
                            background: bg,
                            color: textColor,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {num.toFixed(3)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            {heatStats && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderTop: "1px solid #ddd" }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Low</span>
                <div
                  style={{
                    height: 10,
                    width: 180,
                    background: `linear-gradient(to right, ${heatColor(0)}, ${heatColor(1)})`,
                  }}
                />
                <span style={{ fontSize: 12, opacity: 0.8 }}>High</span>
                <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.75 }}>
                  min {heatStats.minV.toFixed(4)} · max {heatStats.maxV.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}