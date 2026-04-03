import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import "./ReportsPage.css";
import MultiSelectPill from "../components/MultiSelectPill";

function IconSearch() {
  return (
    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 11C8.76142 11 11 8.76142 11 6C11 3.23858 8.76142 1 6 1C3.23858 1 1 3.23858 1 6C1 8.76142 3.23858 11 6 11Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 15L9 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconReportType() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="1.75" width="10" height="10.5" rx="2" stroke="currentColor" />
      <path d="M4.5 4.5H9.5" stroke="currentColor" strokeLinecap="round" />
      <path d="M4.5 7H8.5" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function IconDate() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2.75" width="10" height="8.5" rx="2" stroke="currentColor" />
      <path d="M4 1.75V4" stroke="currentColor" strokeLinecap="round" />
      <path d="M10 1.75V4" stroke="currentColor" strokeLinecap="round" />
      <path d="M2 5.25H12" stroke="currentColor" />
    </svg>
  );
}

function IconFormat() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.25" y="1.75" width="9.5" height="10.5" rx="2" stroke="currentColor" />
      <path d="M4.5 5H9.5" stroke="currentColor" strokeLinecap="round" />
      <path d="M4.5 7.5H8" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function IconStatus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9.91675 13.2702H4.08341C1.51091 13.2702 0.729248 12.4885 0.729248 9.91602V4.08268C0.729248 1.51018 1.51091 0.728516 4.08341 0.728516H4.95841C5.97925 0.728516 6.30008 1.06102 6.70841 1.60352L7.58341 2.77018C7.77591 3.02685 7.80508 3.06185 8.16675 3.06185H9.91675C12.4892 3.06185 13.2709 3.84352 13.2709 6.41602V9.91602C13.2709 12.4885 12.4892 13.2702 9.91675 13.2702Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconSort() {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9.16659 1.5H0.833252L4.16659 6.23V9.5L5.83325 10.5V6.23L9.16659 1.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 2.25V8.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4.75 6.75L7 9L9.25 6.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 11.25H11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconPreview() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M1.25 7.5C2.45 5.2 4.65 3.75 7.5 3.75C10.35 3.75 12.55 5.2 13.75 7.5C12.55 9.8 10.35 11.25 7.5 11.25C4.65 11.25 2.45 9.8 1.25 7.5Z"
        stroke="currentColor"
      />
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" />
    </svg>
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusPill(status) {
  const s = String(status || "").toLowerCase();

  let bg = "#e5e7eb";
  let color = "#475569";

  if (s === "scheduled") {
    bg = "#facc15";
    color = "#5b4300";
  } else if (s === "completed") {
    bg = "#0a8a36";
    color = "#ffffff";
  } else if (s === "processing") {
    bg = "#ddd6fe";
    color = "#4c1d95";
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
    height: 18,
    padding: "0 10px",
    borderRadius: 4,
    background: bg,
    color,
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1,
    textTransform: "capitalize",
  };
}

export default function ReportsPage() {
  const location = useLocation();

  const isSustainability = location.pathname.startsWith("/sustainability");
  const isExhibitor = location.pathname.startsWith("/exhibitor");
  const themeClass = isSustainability ? "sustTheme" : isExhibitor ? "exhTheme" : "opsTheme";

  const [q, setQ] = useState("");
  const [reportTypes, setReportTypes] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [format, setFormat] = useState("");
  const [statuses, setStatuses] = useState([]);
  const [sort, setSort] = useState("timestamp_desc");
  const [page, setPage] = useState(1);
  const [showNewReport, setShowNewReport] = useState(false);

  const [newReport, setNewReport] = useState({
    title: "",
    type: "Summary",
    format: "PDF",
    description: "",
  });

  const pageSize = 10;

  const rows = useMemo(
    () => [
      {
        report_id: "RPT-2311",
        report_title: "Visitor Traffic Report",
        description: "Shows hourly booth footfall and peak congestion times.",
        timestamp: "2025-03-18T07:55:00",
        report_type: "Traffic",
        format: "PDF",
        status: "Scheduled",
      },
      {
        report_id: "RPT-2312",
        report_title: "Engagement Summary",
        description: "Measures interactions at the booth and average dwell time.",
        timestamp: "2025-03-05T13:40:00",
        report_type: "Engagement",
        format: "PDF",
        status: "Scheduled",
      },
      {
        report_id: "RPT-2313",
        report_title: "Lead Conversion Snapshot",
        description: "Tracks daily lead capture volume and conversion estimates.",
        timestamp: "2025-02-28T10:22:00",
        report_type: "Leads",
        format: "XLSX",
        status: "Scheduled",
      },
      {
        report_id: "RPT-2314",
        report_title: "Heatmap Activity Overview",
        description: "Visual heatmap of visitor density around the booth.",
        timestamp: "2025-02-12T16:05:00",
        report_type: "Heatmap",
        format: "PDF",
        status: "Completed",
      },
      {
        report_id: "RPT-2315",
        report_title: "Peak Hour Forecast",
        description: "Predicts expected visitor surges for the next day.",
        timestamp: "2025-01-29T11:18:00",
        report_type: "Forecast",
        format: "PDF",
        status: "Completed",
      },
      {
        report_id: "RPT-2316",
        report_title: "Dwell Time Analysis",
        description: "Calculates average and max dwell time per visitor group.",
        timestamp: "2025-01-17T18:45:00",
        report_type: "Behavior",
        format: "PDF",
        status: "Completed",
      },
      {
        report_id: "RPT-2317",
        report_title: "Competitor Analysis",
        description: "Quick view of how your booth traffic compares to neighbors.",
        timestamp: "2025-01-10T08:45:00",
        report_type: "Benchmark",
        format: "PDF",
        status: "Completed",
      },
      {
        report_id: "RPT-2318",
        report_title: "Visitor Type Breakdown",
        description: "Categorizes visitors by buying intent and interest level.",
        timestamp: "2025-01-03T09:32:00",
        report_type: "Insights",
        format: "XLSX",
        status: "Completed",
      },
      {
        report_id: "RPT-2319",
        report_title: "Weekly Performance Summary",
        description: "Consolidated KPIs, traffic, engagement, leads, and dwell time.",
        timestamp: "2025-02-04T08:12:00",
        report_type: "Summary",
        format: "PDF",
        status: "Completed",
      },
    ],
    []
  );

  const filteredRows = useMemo(() => {
    let next = [...rows];

    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      next = next.filter((r) =>
        [r.report_id, r.report_title, r.description, r.report_type, r.format, r.status]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle))
      );
    }

        if (reportTypes.length) next = next.filter((r) => reportTypes.includes(r.report_type));
    if (format) next = next.filter((r) => r.format === format);
    if (statuses.length) next = next.filter((r) => statuses.includes(r.status));

    if (dateFilter) {
      const now = new Date();
      next = next.filter((r) => {
        const ts = new Date(r.timestamp);
        if (dateFilter === "last_7_days") return now - ts <= 7 * 24 * 60 * 60 * 1000;
        if (dateFilter === "last_30_days") return now - ts <= 30 * 24 * 60 * 60 * 1000;
        if (dateFilter === "this_year") return ts.getFullYear() === now.getFullYear();
        return true;
      });
    }

    if (sort === "timestamp_desc") {
      next.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else if (sort === "timestamp_asc") {
      next.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else if (sort === "title_asc") {
      next.sort((a, b) => a.report_title.localeCompare(b.report_title));
    } else if (sort === "title_desc") {
      next.sort((a, b) => b.report_title.localeCompare(a.report_title));
    }

    return next;
  }, [rows, q, reportTypes, dateFilter, format, statuses, sort]);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const handleCreateReport = (e) => {
    e.preventDefault();
    setShowNewReport(false);
    setNewReport({
      title: "",
      type: "Summary",
      format: "PDF",
      description: "",
    });
  };

  return (
    <div className={`reportsPage ${themeClass}`}>
      <div className="pageInner">
        <div className="reportsHeaderRow">
          <div className="reportsTitleWrap" />
          <div className="reportsHeaderRight">
            <div className="reportsCountTop">{total} reports</div>
          </div>
        </div>

        <div className="reportsControlsCard">
          <div className="reportsFiltersRow">
            <div className="filterPill pillSearch" role="search">
              <span className="pillLeftIcon" aria-hidden>
                <IconSearch />
              </span>
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search here"
                className="pillInput"
              />
            </div>

            <MultiSelectPill
              label="Report Type"
              icon={<IconReportType />}
              options={["Traffic", "Engagement", "Leads", "Heatmap", "Forecast", "Behavior", "Benchmark", "Insights", "Summary"]}
              value={reportTypes}
              onChange={(next) => {
                setReportTypes(next);
                setPage(1);
              }}
            />

            <div className="filterPill pillSelectWrap">
              <span className="pillLeftIcon" aria-hidden>
                <IconDate />
              </span>
              <select
                value={dateFilter}
                className="pillSelect"
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Date</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="this_year">This Year</option>
              </select>
              <span className="pillRightCaret" aria-hidden />
            </div>

            <div className="filterPill pillSelectWrap">
              <span className="pillLeftIcon" aria-hidden>
                <IconFormat />
              </span>
              <select
                value={format}
                className="pillSelect"
                onChange={(e) => {
                  setFormat(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Format</option>
                <option value="PDF">PDF</option>
                <option value="XLSX">CSV</option>
              </select>
              <span className="pillRightCaret" aria-hidden />
            </div>

            <MultiSelectPill
              label="Status"
              icon={<IconStatus />}
              options={["Scheduled", "Completed", "Processing"]}
              value={statuses}
              onChange={(next) => {
                setStatuses(next);
                setPage(1);
              }}
            />

            <div className="filterPill pillSelectWrap pillSort">
              <span className="pillLeftIcon" aria-hidden>
                <IconSort />
              </span>
              <select
                value={sort}
                className="pillSelect"
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
              >
                <option value="timestamp_desc">Sort by</option>
                <option value="timestamp_desc">Newest</option>
                <option value="timestamp_asc">Oldest</option>
                <option value="title_asc">Title A-Z</option>
                <option value="title_desc">Title Z-A</option>
              </select>
              <span className="pillRightCaret" aria-hidden />
            </div>

            <button
              type="button"
              className="newReportBtn"
              onClick={() => setShowNewReport(true)}
            >
              + New Report
            </button>
          </div>
        </div>

        <div className="reportsTableCard">
          <div className="reportsTableScroll">
            <table className="reportsTable">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Report Title</th>
                  <th>Description</th>
                  <th>Timestamp</th>
                  <th>Report Type</th>
                  <th>Format</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="reportsTableEmpty">
                      No reports found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.report_id}>
                      <td className="tdStrong">{r.report_id}</td>
                      <td>{r.report_title}</td>
                      <td className="reportsDesc">{r.description}</td>
                      <td>{formatDateTime(r.timestamp)}</td>
                      <td>{r.report_type}</td>
                      <td>{r.format}</td>
                      <td>
                        <span style={statusPill(r.status)}>{r.status}</span>
                      </td>
                      <td>
                        <div className="reportsActionBtns">
                          <button type="button" className="actionIconBtn isPrimary" title="Download">
                            <IconDownload />
                          </button>
                          <button type="button" className="actionIconBtn" title="Preview">
                            <IconPreview />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="reportsPager">
            <div className="reportsPagerNums">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`reportsPageBtn${page === n ? " isActive" : ""}`}
                  onClick={() => setPage(Math.min(n, totalPages))}
                >
                  {n}
                </button>
              ))}
              <span className="reportsDots">…</span>
              <button
                type="button"
                className="reportsPageBtn"
                onClick={() => setPage(totalPages)}
              >
                {totalPages}
              </button>
            </div>

            <button
              type="button"
              className="reportsNextBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showNewReport ? (
        <div className="reportModalBackdrop" onClick={() => setShowNewReport(false)}>
          <div className="reportModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="reportModalHeader">
              <h3>New Report</h3>
              <button type="button" className="reportModalClose" onClick={() => setShowNewReport(false)}>
                ×
              </button>
            </div>

            <form className="reportModalForm" onSubmit={handleCreateReport}>
              <div className="reportModalField">
                <label>Report Title</label>
                <input
                  value={newReport.title}
                  onChange={(e) => setNewReport((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter report title"
                />
              </div>

              <div className="reportModalGrid">
                <div className="reportModalField">
                  <label>Report Type</label>
                  <select
                    value={newReport.type}
                    onChange={(e) => setNewReport((prev) => ({ ...prev, type: e.target.value }))}
                  >
                    {["Summary", "Traffic", "Engagement", "Leads", "Heatmap", "Forecast", "Behavior", "Benchmark", "Insights"].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="reportModalField">
                  <label>Format</label>
                  <select
                    value={newReport.format}
                    onChange={(e) => setNewReport((prev) => ({ ...prev, format: e.target.value }))}
                  >
                    <option value="PDF">PDF</option>
                    <option value="XLSX">CSV</option>
                  </select>
                </div>
              </div>

              <div className="reportModalField">
                <label>Description</label>
                <textarea
                  rows={4}
                  value={newReport.description}
                  onChange={(e) => setNewReport((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this report should contain"
                />
              </div>

              <div className="reportModalActions">
                <button type="button" className="reportModalSecondary" onClick={() => setShowNewReport(false)}>
                  Cancel
                </button>
                <button type="submit" className="reportModalPrimary">
                  Create Report
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}