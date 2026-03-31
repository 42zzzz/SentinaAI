import { useOutletContext } from "react-router-dom";

export default function ExhibitorReportsPage() {
  const {
    reportDownloadUrl,
    reportChecklist,
    filteredEvents,
    formatDateTime,
  } = useOutletContext();

  return (
    <div className="exhPageWrap">
      <section className="exhCard">
        <div className="exhCardHeaderRow">
          <div className="exhCardHeaderLeft">
            <div>
              <h3>Reports & exports</h3>
              <p>Status of the current downloadable report set and linked event participation.</p>
            </div>
          </div>
          <div className="exhCardHeaderRight">
            <span className="exhHint">Export ready</span>
          </div>
        </div>

        <div className="exhCardBody">
          <div className="exhReportsGrid">
            <div className="exhReportActions">
              <a className="exhPrimaryBtn isBlock" href={reportDownloadUrl}>
                Download report workbook
              </a>
              <p className="exhMutedNote">
                The workbook bundles catchment heat map values and competitive density summaries for the selected exhibitor window.
              </p>
            </div>

            <div className="exhChecklist">
              {reportChecklist.map((item) => (
                <div key={item.label} className="exhChecklistItem">
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.status}</p>
                  </div>
                  <span className={`exhStatusDot is${item.tone}`} />
                </div>
              ))}
            </div>
          </div>

          <div className="exhSectionDivider" />

          <div className="exhTableCard">
            <div className="exhMiniHeader">
              <strong>Event participation</strong>
              <span>{filteredEvents.length} record{filteredEvents.length === 1 ? "" : "s"}</span>
            </div>

            {!filteredEvents.length ? (
              <div className="exhEmptyInline">No event records were returned for this exhibitor.</div>
            ) : (
              <table className="exhDataTable">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Tier</th>
                    <th>Start</th>
                    <th className="isRight">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.slice(0, 10).map((event) => (
                    <tr key={`${event.event_id}-${event.start_datetime_utc}`}>
                      <td>
                        <strong>{event.event_name || event.event_id}</strong>
                        <p>{event.event_id}</p>
                      </td>
                      <td>{event.package_tier || "—"}</td>
                      <td>{formatDateTime(event.start_datetime_utc)}</td>
                      <td className="isRight">
                        {Number.isFinite(Number(event.amount_paid_aed))
                          ? `AED ${Number(event.amount_paid_aed).toLocaleString()}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}