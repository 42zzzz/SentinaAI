import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export default function BoothsPage() {
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState(null);

  const [eventId, setEventId] = useState("");
  const [q, setQ] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [hallId, setHallId] = useState("");
  const [sizeType, setSizeType] = useState("");
  const [assigned, setAssigned] = useState(""); // "" | "true" | "false"
  const [sort, setSort] = useState("booth_code_asc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  const [qLive, setQLive] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQLive(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Load events for selector
  useEffect(() => {
    axios
      .get(`${API_BASE}/events`, { params: { page: 1, pageSize: 50, sort: "start_desc" } })
      .then((res) => {
        setEvents(res.data.rows || []);
        if (res.data.rows?.length) setEventId(res.data.rows[0].event_id);
      })
      .catch((e) => setError(e?.response?.data?.error || e.message || "Failed to load events"));
  }, []);

  // Load booth filters once event selected
  useEffect(() => {
    if (!eventId) return;
    axios
      .get(`${API_BASE}/booths/filters`, { params: { event_id: eventId } })
      .then((res) => setFilters(res.data))
      .catch((e) => setError(e?.response?.data?.error || e.message || "Failed to load booth filters"));
  }, [eventId]);

  // Fetch booths
  useEffect(() => {
    if (!eventId) return;

    const fetchBooths = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_BASE}/booths`, {
          params: {
            event_id: eventId,
            q: qLive || undefined,
            zone_id: zoneId || undefined,
            hall_id: hallId || undefined,
            booth_size_type: sizeType || undefined,
            assigned: assigned || undefined,
            sort,
            page,
            pageSize,
          },
        });

        setRows(res.data.rows || []);
        setTotal(res.data.total || 0);
      } catch (e) {
        setError(e?.response?.data?.error || e.message || "Failed to load booths");
      } finally {
        setLoading(false);
      }
    };

    fetchBooths();
  }, [eventId, qLive, zoneId, hallId, sizeType, assigned, sort, page, pageSize]);

  useEffect(() => setPage(1), [eventId, zoneId, hallId, sizeType, assigned, sort, pageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  return (
    <div style={{ padding: 20, maxWidth: 1300 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Booths & Assignments</h1>
        <div style={{ fontSize: 13, opacity: 0.75 }}>{loading ? "Loading…" : `${total} booths`}</div>
      </div>

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
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={selectStyle}>
          {events.map((ev) => (
            <option key={ev.event_id} value={ev.event_id}>
              {ev.event_id} — {ev.event_name}
            </option>
          ))}
        </select>

        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search booth/exhibitor…" style={inputStyle} />

        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} style={selectStyle}>
          <option value="">All Zones</option>
          {filters?.zones?.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>

        <select value={hallId} onChange={(e) => setHallId(e.target.value)} style={selectStyle}>
          <option value="">All Halls</option>
          {filters?.halls?.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        <select value={sizeType} onChange={(e) => setSizeType(e.target.value)} style={selectStyle}>
          <option value="">All Sizes</option>
          {filters?.boothSizeTypes?.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select value={assigned} onChange={(e) => setAssigned(e.target.value)} style={selectStyle}>
          <option value="">Assigned + Unassigned</option>
          <option value="true">Assigned only</option>
          <option value="false">Unassigned only</option>
        </select>

        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={selectStyle}>
            {filters?.sortOptions?.map((s) => (
              <option key={s} value={s}>
                Sort: {s}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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

      <div style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
              <th style={th}>Booth</th>
              <th style={th}>Zone</th>
              <th style={th}>Hall</th>
              <th style={th}>Hall Name</th>
              <th style={th}>Size</th>
              <th style={th}>Area (sqm)</th>
              <th style={th}>Assigned?</th>
              <th style={th}>Exhibitor</th>
              <th style={th}>Assigned At</th>
              <th style={th}>Assignment Status</th>
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
                  No booths found.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.booth_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={tdStrong}>
                    <div style={{ fontWeight: 800 }}>{r.booth_code}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.75 }}>{r.booth_id}</div>
                  </td>
                  <td style={td}>{r.zone_id}</td>
                  <td style={td}>{r.hall_id}</td>
                  <td style={td}>{r.hall_name || "-"}</td>
                  <td style={td}>{r.booth_size_type}</td>
                  <td style={td}>{r.booth_area_sqm ?? "-"}</td>
                  <td style={td}>
                    <span style={pill(r.is_assigned ? "assigned" : "unassigned")}>
                      {r.is_assigned ? "Assigned" : "Unassigned"}
                    </span>
                  </td>
                  <td style={td}>
                    {r.exhibitor_name ? (
                      <>
                        <div>{r.exhibitor_name}</div>
                        <div style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.75 }}>{r.exhibitor_id}</div>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={td}>{r.assigned_at ? new Date(r.assigned_at).toLocaleString() : "-"}</td>
                  <td style={td}>{r.assignment_status || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
          <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={btnSecondary}>
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
const tdStrong = { ...td, fontWeight: 700, minWidth: 240 };

const btnSecondary = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
  cursor: "pointer",
};

function pill(status) {
  const s = String(status || "").toLowerCase();
  const bg = s === "assigned" ? "#dcfce7" : "#f3f4f6";
  return { padding: "4px 10px", borderRadius: 999, background: bg, fontSize: 12, fontWeight: 700 };
}