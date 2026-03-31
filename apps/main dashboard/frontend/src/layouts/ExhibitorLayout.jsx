import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./../pages/ExhibitorDashboard.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const DEFAULT_EXHIBITOR_ID = "EXH0240";
const ACCENT = "#35005C";

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

function heatColor(t) {
  const x = clamp01(t);
  const r = Math.round(lerp(228, 53, x));
  const g = Math.round(lerp(233, 0, x));
  const b = Math.round(lerp(246, 92, x));
  return `rgb(${r}, ${g}, ${b})`;
}

function formatMetric(value, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function formatPercent(value, digits = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : "—";
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHeaderClock(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function average(arr) {
  const nums = arr.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function densityTone(label) {
  const v = String(label || "").toLowerCase();
  if (v === "high") return "critical";
  if (v === "medium") return "warning";
  return "good";
}

function statusTone(ok, pending = false) {
  if (pending) return "warning";
  return ok ? "good" : "critical";
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m16 16-3.2-3.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12.5h6v7H4v-7Zm10-8h6v15h-6v-15ZM4 4.5h6v5H4v-5Zm10 8h6v7h-6v-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeatMapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 4h5v5H6V4Zm7 0h5v5h-5V4ZM6 11h5v5H6v-5Zm7 0h5v5h-5v-5ZM6 18h12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 16V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 16V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 16v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A2.5 2.5 0 0 1 5 18V6a2.5 2.5 0 0 1 2-2.45Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 3.5V8h4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 12h8M8 15.5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}


function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.2 3.6h3.6l.7 2.2a6.9 6.9 0 0 1 1.6.9l2.2-.8 1.8 3.1-1.6 1.7c.1.5.2 1 .2 1.4 0 .5-.1 1-.2 1.5l1.6 1.7-1.8 3.1-2.2-.8c-.5.4-1 .7-1.6.9l-.7 2.2h-3.6l-.7-2.2c-.6-.2-1.1-.5-1.6-.9l-2.2.8-1.8-3.1 1.6-1.7a7 7 0 0 1 0-2.9L3 9.1l1.8-3.1 2.2.8c.5-.4 1-.7 1.6-.9l.6-2.3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9.75 9.2a2.75 2.75 0 1 1 4.5 2.1c-.8.6-1.25 1.1-1.25 2.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M12 17.2h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m14 16 4-4-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function ExhibitorLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [now, setNow] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [exhibitorId, setExhibitorId] = useState(DEFAULT_EXHIBITOR_ID);
  const [draftExhibitorId, setDraftExhibitorId] = useState(DEFAULT_EXHIBITOR_ID);
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [catchmentK, setCatchmentK] = useState(6);
  const [mcPasses, setMcPasses] = useState(15);

  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [heatmap, setHeatmap] = useState(null);
  const [density, setDensity] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasBootstrapped = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(t);
  }, []);

  const heatmapUrl = useMemo(() => {
    const qs = buildQuery({ intervalMinutes, catchmentK, mcPasses, agg: "mean" });
    return `${API_BASE}/api/exhibitor-ai/api/exhibitor/${encodeURIComponent(exhibitorId)}/catchment/heatmap?${qs}`;
  }, [exhibitorId, intervalMinutes, catchmentK, mcPasses]);

  const densityUrl = useMemo(() => {
    const qs = buildQuery({ intervalMinutes, catchmentK, mcPasses });
    return `${API_BASE}/api/exhibitor-ai/api/exhibitor/${encodeURIComponent(exhibitorId)}/competition/density?${qs}`;
  }, [exhibitorId, intervalMinutes, catchmentK, mcPasses]);

  const reportDownloadUrl = useMemo(() => {
    const qs = buildQuery({ intervalMinutes, catchmentK, mcPasses });
    return `${API_BASE}/api/exhibitor-ai-download/api/exhibitor/${encodeURIComponent(exhibitorId)}/report/download?${qs}`;
  }, [exhibitorId, intervalMinutes, catchmentK, mcPasses]);

  const loadAll = async (nextExhibitorId = exhibitorId) => {
    const safeId = String(nextExhibitorId || "").trim();
    if (!safeId) {
      setError("Please enter an exhibitor ID.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [profileRes, eventsRes, heatmapRes, densityRes] = await Promise.allSettled([
        axios.get(`${API_BASE}/exhibitors/${encodeURIComponent(safeId)}`),
        axios.get(`${API_BASE}/exhibitors/${encodeURIComponent(safeId)}/events`),
        axios.get(heatmapUrl.replace(encodeURIComponent(exhibitorId), encodeURIComponent(safeId))),
        axios.get(densityUrl.replace(encodeURIComponent(exhibitorId), encodeURIComponent(safeId))),
      ]);

      const firstReject = [profileRes, eventsRes, heatmapRes, densityRes].find((r) => r.status === "rejected");
      if (firstReject) {
        const reason = firstReject.reason;
        const message =
          reason?.response?.data?.detail ||
          reason?.response?.data?.error ||
          reason?.message ||
          "Failed to load exhibitor portal data.";
        throw new Error(message);
      }

      setProfile(profileRes.value?.data?.exhibitor || null);
      setEvents(safeArray(eventsRes.value?.data?.rows));
      setHeatmap(heatmapRes.value?.data || null);
      setDensity(densityRes.value?.data || null);
      setExhibitorId(safeId);
      setDraftExhibitorId(safeId);
    } catch (err) {
      setProfile(null);
      setEvents([]);
      setHeatmap(null);
      setDensity(null);
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll(DEFAULT_EXHIBITOR_ID);
    hasBootstrapped.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasBootstrapped.current) return;
    loadAll(exhibitorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMinutes, catchmentK, mcPasses]);

  const densitySeries = safeArray(density?.series);
  const densityLatest = densitySeries.length ? densitySeries[densitySeries.length - 1] : null;

  const confidenceScore = heatmap?.meta?.aiConfidence?.score;
  const confidencePct = Number.isFinite(Number(confidenceScore))
    ? Math.round(Number(confidenceScore) * 100)
    : null;

  const latestHeatRow = useMemo(() => {
    const matrix = safeArray(heatmap?.matrix);
    return matrix.length ? safeArray(matrix[matrix.length - 1]) : [];
  }, [heatmap]);

  const latestHeatValues = latestHeatRow.map(Number).filter(Number.isFinite);
  const avgCatchmentEngagement = average(latestHeatValues);

  const heatStats = useMemo(() => {
    const matrix = safeArray(heatmap?.matrix);
    const values = matrix.flat().map(Number).filter(Number.isFinite);
    if (!values.length) return null;
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    return { minV, maxV, range: Math.max(1e-9, maxV - minV) };
  }, [heatmap]);

  const engagementTrendPoints = useMemo(() => {
    const matrix = safeArray(heatmap?.matrix);
    const yLabels = safeArray(heatmap?.yLabels);
    return matrix
      .map((row, idx) => ({
        ts: yLabels[idx],
        value: average(safeArray(row)),
      }))
      .filter((point) => Number.isFinite(Number(point.value)));
  }, [heatmap]);

  const densityTrendPoints = useMemo(
    () =>
      densitySeries.map((item) => ({
        ts: item.bucket_ts,
        value: item.competitive_density_score,
      })),
    [densitySeries]
  );

  const latestHallSnapshot = useMemo(() => {
    const labels = safeArray(heatmap?.xLabels);
    return labels
      .map((hall, idx) => ({ hall, value: Number(latestHeatRow[idx]) }))
      .filter((item) => Number.isFinite(item.value))
      .filter((item) => !searchTerm || item.hall.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.value - a.value);
  }, [heatmap, latestHeatRow, searchTerm]);

  const filteredEvents = useMemo(() => {
    return safeArray(events).filter((event) => {
      if (!searchTerm) return true;
      const needle = searchTerm.toLowerCase();
      return [event.event_id, event.event_name, event.package_tier]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [events, searchTerm]);

  const reportChecklist = useMemo(
    () => [
      {
        label: "Catchment report",
        status: heatmap && density ? "Ready" : loading ? "Updating" : "Unavailable",
        tone: statusTone(Boolean(heatmap && density), loading),
      },
      {
        label: "Density summary",
        status: densityLatest ? densityLatest.competitive_density_label : loading ? "Updating" : "Pending",
        tone: densityLatest ? densityTone(densityLatest.competitive_density_label) : statusTone(false, loading),
      },
      {
        label: "Follow-up pack",
        status: profile ? "Prepared" : loading ? "Updating" : "Pending",
        tone: statusTone(Boolean(profile), loading),
      },
    ],
    [densityLatest, heatmap, loading, profile]
  );

  const quickInsights = useMemo(() => {
    const insights = [];
    if (confidencePct !== null) {
      insights.push(`AI confidence is ${confidencePct}%, indicating how stable the current predictions are.`);
    }
    if (densityLatest?.competitive_density_label) {
      insights.push(
        `Latest surrounding competition is ${densityLatest.competitive_density_label.toLowerCase()} with a score of ${formatMetric(
          densityLatest.competitive_density_score,
          3
        )}.`
      );
    }
    if (avgCatchmentEngagement !== null) {
      insights.push(`Average catchment engagement across nearby halls is ${formatMetric(avgCatchmentEngagement, 3)}.`);
    }
    if (filteredEvents.length) {
      insights.push(`${filteredEvents.length} linked event record${filteredEvents.length === 1 ? "" : "s"} are available for this exhibitor.`);
    }
    return insights;
  }, [avgCatchmentEngagement, confidencePct, densityLatest, filteredEvents.length]);

  const pageTitle = useMemo(() => {
    if (location.pathname === "/exhibitor" || location.pathname === "/exhibitor/") return "Dashboard";
    if (location.pathname.startsWith("/exhibitor/heatmap")) return "Heat Map";
    if (location.pathname.startsWith("/exhibitor/analytics")) return "Analytics";
    if (location.pathname.startsWith("/exhibitor/reports")) return "Reports";
    return "Exhibitor Portal";
  }, [location.pathname]);

  const handleRefresh = () => loadAll(draftExhibitorId);

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.clear();
    navigate("/", { replace: true });
  };

  const avatarText = (
    sessionStorage.getItem("full_name") ||
    localStorage.getItem("full_name") ||
    "U"
  )
    .charAt(0)
    .toUpperCase();

  return (
    <div className="exhibitorTheme">
      <div className="exhShell">
        <aside className="exhSidebar">
          <div className="exhBrand">SentinaAI</div>

          <div className="exhSidebarLabel">MAIN</div>
          <nav className="exhSidebarNav">
            <NavLink to="/exhibitor" end className={({ isActive }) => `exhSideLink${isActive ? " isActive" : ""}`}>
              <span className="exhSideIcon"><DashboardIcon /></span>
              <span>Dashboard</span>
            </NavLink>

            <NavLink to="/exhibitor/heatmap" className={({ isActive }) => `exhSideLink${isActive ? " isActive" : ""}`}>
              <span className="exhSideIcon"><HeatMapIcon /></span>
              <span>Heat Map</span>
            </NavLink>

            <NavLink to="/exhibitor/analytics" className={({ isActive }) => `exhSideLink${isActive ? " isActive" : ""}`}>
              <span className="exhSideIcon"><AnalyticsIcon /></span>
              <span>Analytics</span>
            </NavLink>

            <NavLink to="/exhibitor/reports" className={({ isActive }) => `exhSideLink${isActive ? " isActive" : ""}`}>
              <span className="exhSideIcon"><ReportsIcon /></span>
              <span>Reports</span>
            </NavLink>
          </nav>

          <div className="exhSidebarSpacer" />

          <div className="exhSidebarLabel">SETTINGS</div>
          <button type="button" className="exhSideLink isGhost">
            <span className="exhSideIcon"><SettingsIcon /></span>
            <span>Settings</span>
          </button>
          <button type="button" className="exhSideLink isGhost">
            <span className="exhSideIcon"><HelpIcon /></span>
            <span>Help</span>
          </button>

          <button type="button" className="exhLogoutBtn" onClick={handleLogout}>
            <span className="exhSideIcon"><LogoutIcon /></span>
            <span>Logout</span>
          </button>
        </aside>

        <main className="exhMain">
          <header className="exhHeader">
            <div>
              <div className="exhHeaderTitle">Exhibitor Portal</div>
              <div className="exhHeaderSub">{pageTitle} | {formatHeaderClock(now)}</div>
            </div>

            <div className="exhHeaderRight">
              <div className="exhSearchWrap">
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search halls or events"
                  className="exhSearchInput"
                />
                <span className="exhSearchIcon"><SearchIcon /></span>
              </div>

              <div className="exhUserCard">
                <div>
                  <div className="exhUserName">
                    {sessionStorage.getItem("full_name") || localStorage.getItem("full_name") || "User"}
                  </div>
                  <div className="exhUserMeta">
                    Role: {sessionStorage.getItem("role") || localStorage.getItem("role") || "exhibitor"}
                  </div>
                  <div className="exhUserMeta">
                    Employee ID: {sessionStorage.getItem("employee_id") || localStorage.getItem("employee_id") || "—"}
                  </div>
                </div>
                <div className="exhAvatar">{avatarText}</div>
              </div>
            </div>
          </header>

          <div className="exhContent">
            <div className="exhControlsCard">
              <div className="exhControlsRow">
                <div className="exhControl">
                  <label>Exhibitor ID</label>
                  <input
                    value={draftExhibitorId}
                    onChange={(e) => setDraftExhibitorId(e.target.value.toUpperCase())}
                    placeholder="Enter exhibitor ID"
                  />
                </div>

                <div className="exhControl isSmall">
                  <label>Interval</label>
                  <select value={intervalMinutes} onChange={(e) => setIntervalMinutes(Number(e.target.value))}>
                    {[15, 30, 60, 120].map((value) => (
                      <option key={value} value={value}>{value} min</option>
                    ))}
                  </select>
                </div>

                <div className="exhControl isSmall">
                  <label>Catchment K</label>
                  <input
                    type="number"
                    min={1}
                    max={26}
                    value={catchmentK}
                    onChange={(e) => setCatchmentK(Number(e.target.value))}
                  />
                </div>

                <div className="exhControl isSmall">
                  <label>MC passes</label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={mcPasses}
                    onChange={(e) => setMcPasses(Number(e.target.value))}
                  />
                </div>

                <div className="exhControlActions">
                  <button type="button" className="exhPrimaryBtn" onClick={handleRefresh} disabled={loading}>
                    {loading ? "Refreshing..." : "Refresh dashboard"}
                  </button>
                  <a href={reportDownloadUrl} className="exhSecondaryBtn">Download XLSX</a>
                </div>
              </div>

              {error ? <div className="exhBanner isError">{error}</div> : null}
              {!error && loading ? <div className="exhBanner">Updating exhibitor analytics…</div> : null}
            </div>

            <Outlet
              context={{
                API_BASE,
                ACCENT,
                exhibitorId,
                profile,
                events,
                heatmap,
                density,
                loading,
                error,
                searchTerm,
                setSearchTerm,
                intervalMinutes,
                catchmentK,
                mcPasses,
                densityLatest,
                confidencePct,
                latestHeatRow,
                latestHallSnapshot,
                filteredEvents,
                reportDownloadUrl,
                reportChecklist,
                quickInsights,
                avgCatchmentEngagement,
                heatStats,
                engagementTrendPoints,
                densityTrendPoints,
                heatColor,
                formatMetric,
                formatPercent,
                formatDateTime,
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}