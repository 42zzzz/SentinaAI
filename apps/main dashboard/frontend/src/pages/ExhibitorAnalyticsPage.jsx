import { useOutletContext } from "react-router-dom";
import Sparkline from "../components/Sparkline";

export default function ExhibitorAnalyticsPage() {
  const {
    ACCENT,
    avgCatchmentEngagement,
    densityLatest,
    engagementTrendPoints,
    densityTrendPoints,
    latestHallSnapshot,
    quickInsights,
    formatMetric,
  } = useOutletContext();

  return (
    <div className="exhPageWrap">
      <section className="exhCard">
        <div className="exhCardHeaderRow">
          <div className="exhCardHeaderLeft">
            <div>
              <h3>Engagement analytics</h3>
              <p>Trend view of catchment engagement and surrounding competition.</p>
            </div>
          </div>
        </div>

        <div className="exhCardBody">
          <div className="exhMiniChartGrid">
            <div className="exhMiniChartCard">
              <div className="exhMiniHeader">
                <strong>Average catchment engagement</strong>
                <span>{avgCatchmentEngagement !== null ? formatMetric(avgCatchmentEngagement, 3) : "—"}</span>
              </div>
              <Sparkline points={engagementTrendPoints} height={120} accent={ACCENT} />
            </div>

            <div className="exhMiniChartCard">
              <div className="exhMiniHeader">
                <strong>Competitive density score</strong>
                <span>{densityLatest ? formatMetric(densityLatest.competitive_density_score, 3) : "—"}</span>
              </div>
              <Sparkline points={densityTrendPoints} height={120} accent={ACCENT} />
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