import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function fmtTs(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export default function SOCLogsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #dbeafe",
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div
        style={{
          padding: "18px 20px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <div style={{ color: "#2563eb", fontSize: 22, fontWeight: 900 }}>Security Logs</div>
          <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
            Latest authentication and access audit activity
          </div>
        </div>

        <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 700 }}>
          {loading ? "Refreshing..." : `${rows.length} records`}
        </div>
      </div>

      {error ? (
        <div
          style={{
            margin: 16,
            padding: 12,
            borderRadius: 12,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1d4ed8",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
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
            {rows.length ? (
              rows.map((row) => (
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

const th = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
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
