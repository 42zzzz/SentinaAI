import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function formatAED(n) {
  if (n === null || n === undefined) return "-";
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return `AED ${num.toLocaleString()}`;
}

export default function ExhibitorsPage() {
  const [filters, setFilters] = useState(null);
  const [events, setEvents] = useState([]);

  // Query state
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("");
  const [hqCountry, setHqCountry] = useState("");
  const [status, setStatus] = useState("");
  const [eventId, setEventId] = useState("");       // optional: event mode
  const [packageTier, setPackageTier] = useState(""); // optional: requires eventId for best UX
  const [sort, setSort] = useState("name_asc");
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

  // Load filters + events list for the event selector
  useEffect(() => {
    const load = async () => {
      try {
        const [f, ev] = await Promise.all([
          axios.get(`${API_BASE}/exhibitors/filters`),
          axios.get(`${API_BASE}/events`, { params: { page: 1, pageSize: 50, sort: "start_desc" } }),
        ]);
        setFilters(f.data);
        setEvents(ev.data.rows || []);
      } catch (e) {
        setError(e?.response?.data?.error || e.message || "Failed to load filters");
      }
    };
    load();
  }, []);

  // Fetch exhibitors
  useEffect(() => {
    const fetchExhibitors = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_BASE}/exhibitors`, {
          params: {
            q: qLive || undefined,
            industry: industry || undefined,
            hq_country: hqCountry || undefined,
            status: status || undefined,
            event_id: eventId || undefined,
            package_tier: packageTier || undefined,
            sort,
            page,
            pageSize,
          },
        });
        setRows(res.data.rows || []);
        setTotal(res.data.total || 0);
      } catch (e) {
        setError(e?.response?.data?.error || e.message || "Failed to load exhibitors");
      } finally {
        setLoading(false);
      }
    };

    fetchExhibitors();
  }, [qLive, industry, hqCountry, status, eventId, packageTier, sort, page, pageSize]);

  // Reset page when filters change
  useEffect(() => setPage(1), [industry, hqCountry, status, eventId, packageTier, sort, pageSize]);

  // If event changes, clear package tier if it no longer makes sense
  useEffect(() => {
    if (!eventId) setPackageTier("");
  }, [eventId]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const clearFilters = () => {
    setQ("");
    setIndustry("");
    setHqCountry("");
    setStatus("");
    setEventId("");
    setPackageTier("");
    setSort("name_asc");
    setPage(1);
    setPageSize(10);
  };

  return (
    <div style={{ padding: 20, maxWidth: 1300 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>Exhibitors</h1>
        <div style={{ fontSize: 13, opacity: 0.75 }}>{loading ? "Loading…" : `${total} exhibitors`}</div>
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
          placeholder="Search (Exhibitor ID / Name)…"
          style={inputStyle}
        />

        <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={selectStyle}>
          <option value="">All Events (Global)</option>
          {events.map((ev) => (
            <option key={ev.event_id} value={ev.event_id}>
              {ev.event_id} — {ev.event_name}
            </option>
          ))}
        </select>

        <select
          value={packageTier}
          onChange={(e) => setPackageTier(e.target.value)}
          style={selectStyle}
          disabled={!eventId}
          title={!eventId ? "Select an event first" : ""}
        >
          <option value="">{eventId ? "All Tiers (in this event)" : "Select event first"}</option>
          {filters?.packageTiers?.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={selectStyle}>
          <option value="">All Industries</option>
          {filters?.industries?.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>

        <select value={hqCountry} onChange={(e) => setHqCountry(e.target.value)} style={selectStyle}>
          <option value="">All HQ Countries</option>
          {filters?.hqCountries?.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          {filters?.statuses?.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", gap: 10 }}>
          <button onClick={clearFilters} style={btnSecondary}>
            Clear filters
          </button>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={selectStyle}>
              {filters?.sortOptions?.map((s) => (
                <option key={s} value={s}>
                  Sort: {s}
                </option>
              ))}
            </select>

            <label style={{ fontSize: 13, opacity: 0.8 }}>Rows:</label>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={selectStyle}>
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

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
              <th style={th}>Exhibitor</th>
              <th style={th}>Industry</th>
              <th style={th}>HQ</th>
              <th style={th}>Status</th>
              <th style={th}>Contact</th>
              <th style={th}>Events</th>
              <th style={th}>Total Paid</th>
              <th style={th}>Tier (context)</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 14, opacity: 0.75 }}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 14, opacity: 0.75 }}>
                  No exhibitors found.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.exhibitor_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={tdStrong}>
                    <div style={{ fontWeight: 800 }}>{r.exhibitor_name}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.75 }}>{r.exhibitor_id}</div>
                  </td>
                  <td style={td}>{r.industry || "-"}</td>
                  <td style={td}>{r.hq_country || "-"}</td>
                  <td style={td}>
                    <span style={pill(r.status)}>{r.status}</span>
                  </td>
                  <td style={td}>
                    <div>{r.contact_name || "-"}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{r.contact_email || ""}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{r.contact_phone || ""}</div>
                  </td>
                  <td style={td}>{Number(r.events_count || 0).toLocaleString()}</td>
                  <td style={td}>{formatAED(r.total_paid_aed)}</td>
                  <td style={td}>{r.any_package_tier || "-"}</td>
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