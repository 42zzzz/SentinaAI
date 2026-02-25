import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function DevicesPage() {
  // Filters data
  const [filters, setFilters] = useState(null);

  // Query state
  const [q, setQ] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [hallId, setHallId] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("last_seen_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data state
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  // Debounce search a little
  const [qLive, setQLive] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQLive(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Load dropdown values
  useEffect(() => {
    axios
      .get(`${API_BASE}/devices/filters`)
      .then((res) => setFilters(res.data))
      .catch((e) => setError(e?.response?.data?.error || e.message || "Failed to load filters"));
  }, []);

  // Fetch devices whenever query changes
  useEffect(() => {
    const fetchDevices = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_BASE}/devices`, {
          params: {
            q: qLive || undefined,
            zone_id: zoneId || undefined,
            hall_id: hallId || undefined,
            device_type: deviceType || undefined,
            status: status || undefined,
            sort,
            page,
            pageSize,
          },
        });

        setRows(res.data.rows || []);
        setTotal(res.data.total || 0);
      } catch (e) {
        setError(e?.response?.data?.error || e.message || "Failed to load devices");
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, [qLive, zoneId, hallId, deviceType, status, sort, page, pageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const deviceTypeLabelMap = useMemo(() => {
    if (!filters?.deviceTypes) return {};
    // deviceTypes = [{device_type, metric_type}]
    const m = {};
    for (const d of filters.deviceTypes) m[d.device_type] = d.metric_type;
    return m;
  }, [filters]);

  const clearFilters = () => {
    setQ("");
    setZoneId("");
    setHallId("");
    setDeviceType("");
    setStatus("");
    setSort("last_seen_desc");
    setPage(1);
    setPageSize(10);
  };

  // If user changes a filter, go back to page 1
  useEffect(() => setPage(1), [zoneId, hallId, deviceType, status, sort, pageSize]);

  return (
    <div style={{ padding: 20, maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>Devices</h1>
        <div style={{ fontSize: 13, opacity: 0.75 }}>{loading ? "Loading…" : `${total} devices`}</div>
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
          placeholder="Search (Device ID, MAC, Edge)…"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
        />

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

        <select value={deviceType} onChange={(e) => setDeviceType(e.target.value)} style={selectStyle}>
          <option value="">All Types</option>
          {filters?.deviceTypes?.map((t) => (
            <option key={t.device_type} value={t.device_type}>
              {t.device_type}
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
              {[10, 20, 50].map((n) => (
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
              <th style={th}>Device ID</th>
              <th style={th}>Type</th>
              <th style={th}>Zone</th>
              <th style={th}>Hall</th>
              <th style={th}>Edge</th>
              <th style={th}>Status</th>
              <th style={th}>Last Communicated</th>
              <th style={th}>Metrics</th>
              <th style={th}>MAC</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: 14, opacity: 0.75 }}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 14, opacity: 0.75 }}>
                  No devices found.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.device_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={tdStrong}>{r.device_id}</td>
                  <td style={td}>{r.device_type}</td>
                  <td style={td}>{r.zone_id || "-"}</td>
                  <td style={td}>{r.hall_id || "-"}</td>
                  <td style={td}>{r.connected_edge || "-"}</td>
                  <td style={td}>
                    <span style={pill(r.status)}>{r.status}</span>
                  </td>
                  <td style={td}>{formatDate(r.last_heartbeat_at)}</td>
                  <td style={td}>{r.metric_type || deviceTypeLabelMap[r.device_type] || "-"}</td>
                  <td style={tdMono}>{r.mac_address || "-"}</td>
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

const selectStyle = { padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", background: "white" };

const th = { padding: "10px 10px", fontSize: 13, opacity: 0.85, whiteSpace: "nowrap" };
const td = { padding: "10px 10px", fontSize: 13, whiteSpace: "nowrap" };
const tdStrong = { ...td, fontWeight: 700 };
const tdMono = { ...td, fontFamily: "monospace", fontSize: 12 };

const btnSecondary = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
  cursor: "pointer",
};

function pill(status) {
  const s = String(status || "").toLowerCase();
  const bg =
    s === "quarantined" ? "#fee2e2" :
    s === "inactive" ? "#f3f4f6" :
    s === "active" ? "#dcfce7" :
    "#e5e7eb";
  return { padding: "4px 10px", borderRadius: 999, background: bg, fontSize: 12, fontWeight: 700 };
}