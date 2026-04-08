import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function fmtTs(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function normalize(value) {
  return String(value || "").toLowerCase();
}

export default function SOCLogsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE}/dashboard/soc-logs`);
        if (!alive) return;
        setRows(res.data?.rows || []);
        setError("");
      } catch (e) {
        if (!alive) return;
        setError(e?.response?.data?.error || e.message || "Failed to load SOC logs");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    const t = setInterval(load, 15000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const eventOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((row) => row.event_type).filter(Boolean)));
    return ["all", ...values];
  }, [rows]);

  const outcomeOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((row) => row.outcome).filter(Boolean)));
    return ["all", ...values];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = normalize(search).trim();
    return rows.filter((row) => {
      if (eventFilter !== "all" && row.event_type !== eventFilter) return false;
      if (outcomeFilter !== "all" && row.outcome !== outcomeFilter) return false;
      if (!q) return true;

      const haystack = [
        row.event_type,
        row.outcome,
        row.full_name,
        row.user_id,
        row.email,
        row.request_path,
        row.http_method,
        row.http_status,
        row.ip_address,
        row.reason,
      ]
        .map((value) => normalize(value))
        .join(" ");

      return haystack.includes(q);
    });
  }, [rows, search, eventFilter, outcomeFilter]);

  return (
    <div style={wrap}>
      <div style={headerBar}>
        <div style={{ color: "#123150", fontSize: 22, fontWeight: 900 }}>Security Logs</div>
        <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 700 }}>
          {loading ? "Refreshing..." : `${filteredRows.length} of ${rows.length} records`}
        </div>
      </div>

      <div style={controlsWrap}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search logs"
          style={searchInput}
        />

        <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} style={selectInput}>
          {eventOptions.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "All events" : option}
            </option>
          ))}
        </select>

        <select value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)} style={selectInput}>
          {outcomeOptions.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "All outcomes" : option}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div style={errorBox}>{error}</div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={th}>Time</th>
              <th style={th}>Event</th>
              <th style={th}>Outcome</th>
              <th style={th}>User</th>
              <th style={th}>Email</th>
              <th style={th}>Path</th>
              <th style={th}>Method</th>
              <th style={th}>Status</th>
              <th style={th}>IP</th>
              <th style={th}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length ? (
              filteredRows.map((row) => (
                <tr key={row.log_id} style={{ borderTop: "1px solid #eef2f7" }}>
                  <td style={td}>{fmtTs(row.created_at)}</td>
                  <td style={tdStrong}>{row.event_type || "-"}</td>
                  <td style={td}>
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "4px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        background: row.outcome === "SUCCESS" ? "#dbeafe" : "#fee2e2",
                        color: row.outcome === "SUCCESS" ? "#1d4ed8" : "#b91c1c",
                      }}
                    >
                      {row.outcome || "-"}
                    </span>
                  </td>
                  <td style={td}>{row.full_name || row.user_id || "-"}</td>
                  <td style={td}>{row.email || "-"}</td>
                  <td style={tdMono}>{row.request_path || "-"}</td>
                  <td style={td}>{row.http_method || "-"}</td>
                  <td style={td}>{row.http_status ?? "-"}</td>
                  <td style={tdMono}>{row.ip_address || "-"}</td>
                  <td style={td}>{row.reason || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" style={{ padding: 22, color: "#6b7280", textAlign: "center" }}>
                  No audit logs available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const wrap = {
  background: "#ffffff",
  border: "1px solid #dbeafe",
  borderRadius: 18,
  overflow: "hidden",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
};

const headerBar = {
  padding: "18px 20px 12px",
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const controlsWrap = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  padding: "14px 20px 16px",
  borderBottom: "1px solid #e5e7eb",
  background: "#f8fbff",
};

const searchInput = {
  minWidth: 240,
  flex: "1 1 280px",
  height: 38,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  padding: "0 12px",
  fontSize: 14,
};

const selectInput = {
  minWidth: 180,
  height: 38,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  padding: "0 12px",
  fontSize: 14,
  background: "#ffffff",
};

const errorBox = {
  margin: 16,
  padding: 12,
  borderRadius: 12,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 700,
};

const th = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 900,
  color: "#123150",
};

const td = {
  padding: "12px 14px",
  fontSize: 13,
  color: "#334155",
  verticalAlign: "top",
};

const tdStrong = {
  ...td,
  fontWeight: 800,
  color: "#0f172a",
};

const tdMono = {
  ...td,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
};
