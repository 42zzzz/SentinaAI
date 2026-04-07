import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import Sparkline from "../components/Sparkline";

function maxPoint(points) {
  return points.reduce((best, point) => {
    if (!best) return point;
    return Number(point?.value) > Number(best?.value) ? point : best;
  }, null);
}

function minPoint(points) {
  return points.reduce((best, point) => {
    if (!best) return point;
    return Number(point?.value) < Number(best?.value) ? point : best;
  }, null);
}

function averageAbsoluteDelta(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const values = points.map((point) => Number(point?.value)).filter(Number.isFinite);
  if (values.length < 2) return null;

  let total = 0;
  for (let i = 1; i < values.length; i += 1) {
    total += Math.abs(values[i] - values[i - 1]);
  }
  return total / (values.length - 1);
}

function densityShare(series, label) {
  if (!Array.isArray(series) || !series.length) return null;
  const count = series.filter((item) => String(item?.competitive_density_label || "").toLowerCase() === label).length;
  return (count / series.length) * 100;
}

function trendLabel(points) {
  if (!Array.isArray(points) || points.length < 2) return "—";
  const first = Number(points[0]?.value);
  const last = Number(points[points.length - 1]?.value);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return "—";

  const delta = last - first;
  if (Math.abs(delta) < 0.01) return "Stable";
  return delta > 0 ? "Rising" : "Cooling";
}

function StatCard({ label, value, hint }) {
  return (
    <div className="exhStatCard">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export default function ExhibitorAnalyticsPage() {
  const {
    ACCENT,
    heatmap,
    events,
    density,
    densityLatest,
    confidencePct,
    engagementTrendPoints,
    densityTrendPoints,
    latestHallSnapshot,
    quickInsights,
    avgCatchmentEngagement,
    formatMetric,
    formatPercent,
    formatDateTime,
  } = useOutletContext();

  const hallCount = Array.isArray(heatmap?.xLabels) ? heatmap.xLabels.length : 0;
  const bucketCount = Array.isArray(heatmap?.yLabels) ? heatmap.yLabels.length : 0;
  const densitySeries = useMemo(() => (Array.isArray(density?.series) ? density.series : []), [density]);

  const peakEngagementPoint = useMemo(() => maxPoint(engagementTrendPoints), [engagementTrendPoints]);
  const quietEngagementPoint = useMemo(() => minPoint(engagementTrendPoints), [engagementTrendPoints]);
  const peakDensityPoint = useMemo(() => maxPoint(densityTrendPoints), [densityTrendPoints]);
  const engagementVolatility = useMemo(() => averageAbsoluteDelta(engagementTrendPoints), [engagementTrendPoints]);
  const densityTrendLabel = useMemo(() => trendLabel(densityTrendPoints), [densityTrendPoints]);

  const highDensityShare = useMemo(() => densityShare(densitySeries, "high"), [densitySeries]);
  const mediumDensityShare = useMemo(() => densityShare(densitySeries, "medium"), [densitySeries]);
  const lowDensityShare = useMemo(() => densityShare(densitySeries, "low"), [densitySeries]);

  const topHall = latestHallSnapshot[0] || null;
  const bottomHall = latestHallSnapshot.length ? latestHallSnapshot[latestHallSnapshot.length - 1] : null;
  const primaryEvent = Array.isArray(events) && events.length ? events[0] : null;

  return (
    <div className="exhPageWrap">
      <section className="exhCard">
        <div className="exhCardHeaderRow">
          <div className="exhCardHeaderLeft">
            <div>
              <h3>Engagement analytics</h3>
              <p>Expanded insights derived from the same live exhibitor AI responses already powering the portal.</p>
            </div>
          </div>
          <div className="exhHint">Runtime analytics only</div>
        </div>

        <div className="exhCardBody">
          <div className="exhStatsGrid">
            <StatCard
              label="Catchment halls tracked"
              value={hallCount || "—"}
              hint={heatmap?.meta?.hallName ? `Centred on ${heatmap.meta.hallName}` : "Current surrounding halls"}
            />
            <StatCard
              label="Time buckets analysed"
              value={bucketCount || "—"}
              hint={heatmap?.meta?.intervalMinutes ? `${heatmap.meta.intervalMinutes}-minute windows` : "Latest forecast windows"}
            />
            <StatCard
              label="Peak engagement"
              value={peakEngagementPoint ? formatMetric(peakEngagementPoint.value, 3) : "—"}
              hint={peakEngagementPoint?.ts ? formatDateTime(peakEngagementPoint.ts) : "Highest predicted period"}
            />
            <StatCard
              label="Peak competition"
              value={peakDensityPoint ? formatMetric(peakDensityPoint.value, 3) : "—"}
              hint={peakDensityPoint?.ts ? formatDateTime(peakDensityPoint.ts) : "Highest nearby density"}
            />
            <StatCard
              label="Engagement movement"
              value={engagementVolatility !== null ? formatMetric(engagementVolatility, 3) : "—"}
              hint="Average bucket-to-bucket change"
            />
            <StatCard
              label="Current trend"
              value={densityTrendLabel}
              hint={densityLatest ? `Latest score ${formatMetric(densityLatest.competitive_density_score, 3)}` : "Trend needs more data"}
            />
          </div>

          <div className="exhSectionDivider" />

          <div className="exhMiniChartGrid">
            <div className="exhMiniChartCard">
              <div className="exhMiniHeader">
                <div>
                  <strong>Average catchment engagement</strong>
                  <span>
                    {avgCatchmentEngagement !== null ? formatMetric(avgCatchmentEngagement, 3) : "—"}
                  </span>
                </div>
                <span className="exhMiniPill">
                  {confidencePct === null ? "Confidence —" : `Confidence ${formatPercent(confidencePct, 0)}`}
                </span>
              </div>
              <Sparkline points={engagementTrendPoints} height={120} accent={ACCENT} />
              <div className="exhMiniMetaRow">
                <span>
                  Peak {peakEngagementPoint ? formatMetric(peakEngagementPoint.value, 3) : "—"}
                </span>
                <span>
                  Quietest {quietEngagementPoint ? formatMetric(quietEngagementPoint.value, 3) : "—"}
                </span>
              </div>
            </div>

            <div className="exhMiniChartCard">
              <div className="exhMiniHeader">
                <div>
                  <strong>Competitive density score</strong>
                  <span>{densityLatest ? formatMetric(densityLatest.competitive_density_score, 3) : "—"}</span>
                </div>
                <span className="exhMiniPill">
                  {densityLatest?.competitive_density_label || "No label"}
                </span>
              </div>
              <Sparkline points={densityTrendPoints} height={120} accent={ACCENT} />
              <div className="exhMiniMetaRow">
                <span>High {highDensityShare !== null ? formatPercent(highDensityShare, 0) : "—"}</span>
                <span>Medium {mediumDensityShare !== null ? formatPercent(mediumDensityShare, 0) : "—"}</span>
                <span>Low {lowDensityShare !== null ? formatPercent(lowDensityShare, 0) : "—"}</span>
              </div>
            </div>
          </div>

          <div className="exhSectionDivider" />

          <div className="exhBottomGrid">
            <div className="exhTableCard">
              <div className="exhMiniHeader">
                <strong>Hall ranking</strong>
                <span>Latest bucket</span>
              </div>
              {!latestHallSnapshot.length ? (
                <div className="exhEmptyInline">No hall ranking is available yet.</div>
              ) : (
                <table className="exhDataTable">
                  <thead>
                    <tr>
                      <th>Hall</th>
                      <th className="isRight">Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestHallSnapshot.map((row) => (
                      <tr key={row.hall}>
                        <td><strong>{row.hall}</strong></td>
                        <td className="isRight">{formatMetric(row.value, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="exhTableCard">
              <div className="exhMiniHeader">
                <strong>Snapshot summary</strong>
                <span>Current runtime view</span>
              </div>
              <div className="exhSummaryStack">
                <div className="exhSummaryItem">
                  <label>Strongest nearby hall</label>
                  <strong>{topHall ? `${topHall.hall} · ${formatMetric(topHall.value, 3)}` : "—"}</strong>
                </div>
                <div className="exhSummaryItem">
                  <label>Weakest nearby hall</label>
                  <strong>{bottomHall ? `${bottomHall.hall} · ${formatMetric(bottomHall.value, 3)}` : "—"}</strong>
                </div>
                <div className="exhSummaryItem">
                  <label>Primary linked event</label>
                  <strong>{primaryEvent?.event_name || primaryEvent?.event_id || "—"}</strong>
                </div>
                <div className="exhSummaryItem">
                  <label>Package tier</label>
                  <strong>{primaryEvent?.package_tier || "—"}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="exhSectionDivider" />

          <div className="exhBottomGrid">
            <div className="exhTableCard">
              <div className="exhMiniHeader">
                <strong>Recent linked events</strong>
                <span>{events?.length || 0} record{events?.length === 1 ? "" : "s"}</span>
              </div>
              {!events?.length ? (
                <div className="exhEmptyInline">No linked events are available for this exhibitor.</div>
              ) : (
                <table className="exhDataTable">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Tier</th>
                      <th className="isRight">Start</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.slice(0, 5).map((event) => (
                      <tr key={`${event.event_id}-${event.start_datetime_utc || "na"}`}>
                        <td>
                          <strong>{event.event_name || event.event_id}</strong>
                          <p>{event.event_id}</p>
                        </td>
                        <td>{event.package_tier || "—"}</td>
                        <td className="isRight">{formatDateTime(event.start_datetime_utc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="exhTableCard">
              <div className="exhMiniHeader">
                <strong>Quick insights</strong>
              </div>
              <div className="exhInsightList">
                {quickInsights.length ? (
                  quickInsights.map((item) => (
                    <div key={item} className="exhInsightItem">
                      <span className="exhInsightBullet" />
                      <p>{item}</p>
                    </div>
                  ))
                ) : (
                  <div className="exhEmptyInline">No insights available yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
