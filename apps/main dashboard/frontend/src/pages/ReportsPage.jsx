import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import MultiSelectPill from "../components/MultiSelectPill";
import { downloadReportFile, fetchReports, finalizeDraftReport, openReportFile } from "../api/reports";
import { formatReportStatus, getDomainFromPath } from "../utils/reportConfig";
import "./ReportsPage.css";

function IconSearch() {
  return (
    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 11C8.76142 11 11 8.76142 11 6C11 3.23858 8.76142 1 6 1C3.23858 1 1 3.23858 1 6C1 8.76142 3.23858 11 6 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
      <path d="M9.91675 13.2702H4.08341C1.51091 13.2702 0.729248 12.4885 0.729248 9.91602V4.08268C0.729248 1.51018 1.51091 0.728516 4.08341 0.728516H4.95841C5.97925 0.728516 6.30008 1.06102 6.70841 1.60352L7.58341 2.77018C7.77591 3.02685 7.80508 3.06185 8.16675 3.06185H9.91675C12.4892 3.06185 13.2709 3.84352 13.2709 6.41602V9.91602C13.2709 12.4885 12.4892 13.2702 9.91675 13.2702Z" fill="currentColor" />
    </svg>
  );
}

function IconSort() {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.16659 1.5H0.833252L4.16659 6.23V9.5L5.83325 10.5V6.23L9.16659 1.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
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
      <path d="M1.25 7.5C2.45 5.2 4.65 3.75 7.5 3.75C10.35 3.75 12.55 5.2 13.75 7.5C12.55 9.8 10.35 11.25 7.5 11.25C4.65 11.25 2.45 9.8 1.25 7.5Z" stroke="currentColor" />
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12L4.6 11.4L11.4 4.6C11.9 4.1 11.9 3.3 11.4 2.8L11.2 2.6C10.7 2.1 9.9 2.1 9.4 2.6L2.6 9.4L2 12Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8.5 3.5L10.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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
  const s = String(status || "").toUpperCase();
  if (s === "DRAFT") {
    return { background: "#facc15", color: "#5b4300" };
  }
  if (s === "GENERATED") {
    return { background: "#0a8a36", color: "#ffffff" };
  }
  return { background: "#e5e7eb", color: "#475569" };
}

function buildDateMatches(dateFilter, timestamp) {
  if (!dateFilter) return true;
  const now = new Date();
  const ts = new Date(timestamp);
  if (Number.isNaN(ts.getTime())) return true;
  if (dateFilter === "last_7_days") return now - ts <= 7 * 24 * 60 * 60 * 1000;
  if (dateFilter === "last_30_days") return now - ts <= 30 * 24 * 60 * 60 * 1000;
  if (dateFilter === "this_year") return ts.getFullYear() === now.getFullYear();
  return true;
}

export default function ReportsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const domain = getDomainFromPath(location.pathname);
  const themeClass = domain === "sustainability" ? "sustTheme" : domain === "exhibitors" ? "exhTheme" : "opsTheme";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [reportTypes, setReportTypes] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [format, setFormat] = useState("");
  const [statuses, setStatuses] = useState([]);
  const [sort, setSort] = useState("timestamp_desc");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchReports(domain);
        if (!ignore) setRows(data);
      } catch (err) {
        if (!ignore) setError(err?.response?.data?.error || err.message || "Failed to load reports.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [domain]);

  const typeOptions = useMemo(() => [...new Set(rows.map((row) => row.report_type).filter(Boolean))], [rows]);
  const statusOptions = useMemo(() => [...new Set(rows.map((row) => formatReportStatus(row.status)).filter(Boolean))], [rows]);

  const filteredRows = useMemo(() => {
    let next = [...rows];

    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      next = next.filter((row) =>
        [row.report_code, row.report_title, row.description, row.report_type, row.format, row.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      );
    }

    if (reportTypes.length) next = next.filter((row) => reportTypes.includes(row.report_type));
    if (format) next = next.filter((row) => String(row.format).toLowerCase() === format.toLowerCase());
    if (statuses.length) next = next.filter((row) => statuses.includes(formatReportStatus(row.status)));
    if (dateFilter) next = next.filter((row) => buildDateMatches(dateFilter, row.timestamp));

    if (sort === "timestamp_desc") next.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (sort === "timestamp_asc") next.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (sort === "title_asc") next.sort((a, b) => String(a.report_title).localeCompare(String(b.report_title)));
    if (sort === "title_desc") next.sort((a, b) => String(b.report_title).localeCompare(String(a.report_title)));

    return next;
  }, [dateFilter, format, q, reportTypes, rows, sort, statuses]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [q, reportTypes, dateFilter, format, statuses, sort, domain]);

  async function handleGenerateDraft(reportId) {
    try {
      setBusyId(reportId);
      await finalizeDraftReport(reportId);
      const refreshed = await fetchReports(domain);
      setRows(refreshed);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to generate draft.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className={`reportsPage ${themeClass}`}>
      <div className="pageInner">
        <div className="reportsHeaderRow">
          <div />
          <div className="reportsCountTop">{filteredRows.length} reports</div>
        </div>

        {error ? <div className="reportsErrorBanner">{error}</div> : null}

        <div className="reportsControlsCard">
          <div className="reportsFiltersRow">
            <div className="filterPill pillSearch" role="search">
              <span className="pillLeftIcon" aria-hidden>
                <IconSearch />
              </span>
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search here" className="pillInput" />
            </div>

            <MultiSelectPill label="Report Type" icon={<IconReportType />} options={typeOptions} value={reportTypes} onChange={setReportTypes} />

            <div className="filterPill pillSelectWrap">
              <span className="pillLeftIcon" aria-hidden>
                <IconDate />
              </span>
              <select value={dateFilter} className="pillSelect" onChange={(event) => setDateFilter(event.target.value)}>
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
              <select value={format} className="pillSelect" onChange={(event) => setFormat(event.target.value)}>
                <option value="">Format</option>
                <option value="PDF">PDF</option>
                <option value="XLSX">XLSX</option>
              </select>
              <span className="pillRightCaret" aria-hidden />
            </div>

            <MultiSelectPill label="Status" icon={<IconStatus />} options={statusOptions} value={statuses} onChange={setStatuses} />

            <div className="filterPill pillSelectWrap pillSort">
              <span className="pillLeftIcon" aria-hidden>
                <IconSort />
              </span>
              <select value={sort} className="pillSelect" onChange={(event) => setSort(event.target.value)}>
                <option value="timestamp_desc">Newest</option>
                <option value="timestamp_asc">Oldest</option>
                <option value="title_asc">Title A-Z</option>
                <option value="title_desc">Title Z-A</option>
              </select>
              <span className="pillRightCaret" aria-hidden />
            </div>

            <button type="button" className="newReportBtn" onClick={() => navigate(`${location.pathname}/new`)}>
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
                {loading ? (
                  <tr>
                    <td colSpan={8} className="reportsTableEmpty">Loading reports…</td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="reportsTableEmpty">No reports found.</td>
                  </tr>
                ) : (
                  pageRows.map((row) => {
                    const statusStyle = statusPill(row.status);
                    const isDraft = String(row.status).toUpperCase() === "DRAFT";
                    return (
                      <tr key={row.report_id}>
                        <td className="tdStrong">{row.report_code}</td>
                        <td>{row.report_title}</td>
                        <td className="reportsDesc">{row.description}</td>
                        <td>{formatDateTime(row.timestamp)}</td>
                        <td>{row.report_type}</td>
                        <td>{row.format}</td>
                        <td>
                          <span className="statusTag" style={statusStyle}>{formatReportStatus(row.status)}</span>
                        </td>
                        <td>
                          <div className="reportsActionBtns">
                            {isDraft ? (
                              <>
                                <button type="button" className="actionIconBtn isPrimary" title="Edit draft" onClick={() => navigate(`${location.pathname}/${row.report_id}/edit`)}>
                                  <IconEdit />
                                </button>
                                <button type="button" className="actionIconBtn" title="Generate draft" onClick={() => handleGenerateDraft(row.report_id)} disabled={busyId === row.report_id}>
                                  <IconDownload />
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" className="actionIconBtn isPrimary" title="Download" onClick={() => downloadReportFile(row.report_id)}>
                                  <IconDownload />
                                </button>
                                <button type="button" className="actionIconBtn" title="Preview" onClick={() => openReportFile(row.report_id)}>
                                  <IconPreview />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="reportsPager">
            <div className="reportsPagerNums">
              <button type="button" className="reportsPageBtn" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                Prev
              </button>
              <span className="reportsPagerLabel">Page {currentPage} of {totalPages}</span>
            </div>
            <button type="button" className="reportsNextBtn" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
