import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatAED(n) {
  if (n === null || n === undefined) return "-";
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return `AED ${num.toLocaleString()}`;
}

export default function EventsPage() {
  const navigate = useNavigate();
  // Filters from backend
  const [filters, setFilters] = useState(null);

  // Query state
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [venueId, setVenueId] = useState("");
  const [sort, setSort] = useState("start_desc");
  const [from, setFrom] = useState(""); // datetime-local string
  const [to, setTo] = useState("");     // datetime-local string
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data state
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  // Debounce search
  const [qLive, setQLive] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQLive(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Load filter values
  useEffect(() => {
    axios
      .get(`${API_BASE}/events/filters`)
      .then((res) => {
        setFilters(res.data);
        // auto-select the only venue if there is one (optional)
        if (res.data?.venues?.length === 1) setVenueId(res.data.venues[0].venue_id);
      })
      .catch((e) => setError(e?.response?.data?.error || e.message || "Failed to load filters"));
  }, []);

  // Convert datetime-local -> ISO
  const fromISO = useMemo(() => (from ? new Date(from).toISOString() : undefined), [from]);
  const toISO = useMemo(() => (to ? new Date(to).toISOString() : undefined), [to]);

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_BASE}/events`, {
          params: {
            q: qLive || undefined,
            status: status || undefined,
            venue_id: venueId || undefined,
            sort,
            from: fromISO,
            to: toISO,
            page,
            pageSize,
          },
        });
        setRows(res.data.rows || []);
        setTotal(res.data.total || 0);
      } catch (e) {
        setError(e?.response?.data?.error || e.message || "Failed to load events");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [qLive, status, venueId, sort, fromISO, toISO, page, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => setPage(1), [status, venueId, sort, fromISO, toISO, pageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const clearFilters = () => {
    setQ("");
    setStatus("");
    // keep venueId if only one venue; otherwise clear it
    if (!(filters?.venues?.length === 1)) setVenueId("");
    setSort("start_desc");
    setFrom("");
    setTo("");
    setPage(1);
    setPageSize(10);
  };

  return (
    <div style={{ padding: 20, maxWidth: 1300 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>Events</h1>
        <div style={{ fontSize: 13, opacity: 0.75 }}>{loading ? "Loading…" : `${total} events`}</div>
      </div>

      {/* Controls */}
      <div
        style={{
          marginTop: 14,
          padding: 14,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
          gap: 10,
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search (Event ID / Event Name)…"
          style={inputStyle}
        />

        <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          {filters?.statuses?.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select value={venueId} onChange={(e) => setVenueId(e.target.value)} style={selectStyle}>
          <option value="">All Venues</option>
          {filters?.venues?.map((v) => (
            <option key={v.venue_id} value={v.venue_id}>
              {v.venue_name} ({v.venue_id})
            </option>
          ))}
        </select>

        <input
          type="datetime-local"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          style={inputStyle}
          title="From"
        />

        <input
          type="datetime-local"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={inputStyle}
          title="To"
        />

        <select value={sort} onChange={(e) => setSort(e.target.value)} style={selectStyle}>
          {filters?.sortOptions?.map((s) => (
            <option key={s} value={s}>
              Sort: {s}
            </option>
          ))}
        </select>

        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", gap: 10 }}>
          <button onClick={clearFilters} style={btnSecondary}>
            Clear filters
          </button>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ fontSize: 13, opacity: 0.8 }}>Rows:</label>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={selectStyle}>
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#fff1f2" }}>
          <div style={{ fontWeight: 700 }}>Error</div>
          <div style={{ fontFamily: "monospace", fontSize: 12 }}>{error}</div>
        </div>
      ) : null}

      {/* Table */}
      <div style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
              <th style={th}>Event</th>
              <th style={th}>Venue</th>
              <th style={th}>Start</th>
              <th style={th}>End</th>
              <th style={th}>Expected Attendance</th>
              <th style={th}>Expected Exhibitors</th>
              <th style={th}>Exhibitors Joined</th>
              <th style={th}>Revenue</th>
              <th style={th}>PIC</th>
              <th style={th}>Status</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ padding: 14, opacity: 0.75 }}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: 14, opacity: 0.75 }}>
                  No events found.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.event_id}
                  onClick={() => navigate(`/operations/events/${r.event_id}`)}
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                >
                  <td style={tdStrong}>
                    <div style={{ fontWeight: 800 }}>{r.event_name}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.75 }}>
                      {r.event_id}
                    </div>
                  </td>
                  <td style={td}>{r.venue_name || r.venue_id}</td>
                  <td style={td}>{formatDate(r.start_datetime_utc)}</td>
                  <td style={td}>{formatDate(r.end_datetime_utc)}</td>
                  <td style={td}>
                    {Number(r.expected_attendance_total).toLocaleString()}
                  </td>
                  <td style={td}>
                    {Number(r.expected_exhibitors).toLocaleString()}
                  </td>
                  <td style={td}>
                    {Number(r.exhibitors_joined).toLocaleString()}
                  </td>
                  <td style={td}>{formatAED(r.revenue_aed)}</td>
                  <td style={td}>
                    <div>{r.person_in_charge_name || "-"}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {r.person_in_charge_email || ""}
                    </div>
                  </td>
                  <td style={td}>
                    <span style={pill(r.status)}>{r.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Page {page} of {totalPages}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={page <= 1} onClick={() => setPage(1)} style={btnSecondary}>
            {"<<"}
          </button>
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={btnSecondary}>
            Prev
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={btnSecondary}
          >
            Next
          </button>
          <button disabled={page >= totalPages} onClick={() => setPage(totalPages)} style={btnSecondary}>
            {">>"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = { padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" };
const selectStyle = { padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", background: "white" };

const th = { padding: "10px 10px", fontSize: 13, opacity: 0.85, whiteSpace: "nowrap" };
const td = { padding: "10px 10px", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "top" };
const tdStrong = { ...td, fontWeight: 700, minWidth: 280 };

const btnSecondary = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
  cursor: "pointer",
};

function pill(status) {
  const s = String(status || "").toLowerCase();
  const bg = s === "active" ? "#dcfce7" : "#e5e7eb";
  return { padding: "4px 10px", borderRadius: 999, background: bg, fontSize: 12, fontWeight: 700 };
}