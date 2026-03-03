import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function fmtTs(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function safeJson(v) {
  if (!v) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return null; }
}

export default function AlertsPage() {
  const [filters, setFilters] = useState(null);

  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [ruleKey, setRuleKey] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [hallId, setHallId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [sort, setSort] = useState("detected_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  const [expandedId, setExpandedId] = useState(null);

  const [qLive, setQLive] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQLive(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    axios
      .get(`${API_BASE}/alerts/filters`)
      .then((res) => setFilters(res.data))
      .catch((e) => setError(e?.response?.data?.error || e.message || "Failed to load alert filters"));
  }, []);

  useEffect(() => {
    let alive = true;

    const fetchAlerts = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_BASE}/alerts`, {
          params: {
            q: qLive || undefined,
            severity: severity || undefined,
            status: status || undefined,
            rule_key: ruleKey || undefined,
            zone_id: zoneId || undefined,
            hall_id: hallId || undefined,
            device_id: deviceId || undefined,
            sort,
            page,
            pageSize,
          },
        });

        if (!alive) return;
        setRows(res.data.rows || []);
        setTotal(res.data.total || 0);
      } catch (e) {
        if (!alive) return;
        setError(e?.response?.data?.error || e.message || "Failed to load alerts");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchAlerts();
    const t = setInterval(fetchAlerts, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [qLive, severity, status, ruleKey, zoneId, hallId, deviceId, sort, page, pageSize]);

  useEffect(() => setPage(1), [severity, status, ruleKey, zoneId, hallId, deviceId, sort, pageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const clearFilters = () => {
    setQ("");
    setSeverity("");
    setStatus("");
    setRuleKey("");
    setZoneId("");
    setHallId("");
    setDeviceId("");
    setSort("detected_desc");
    setPage(1);
    setPageSize(10);
  };

const ack = async (alertId) => {
  try {
    const res = await axios.patch(`${API_BASE}/alerts/${alertId}/ack`, {
      user_id: localStorage.getItem("user_id") || null,
    });

    const updated = res.data?.alert;
    if (updated) {
      setRows((prev) =>
        prev.map((r) =>
          r.alert_id === alertId
            ? { ...r, status: updated.status, acknowledged_by: updated.acknowledged_by, acknowledged_at: updated.acknowledged_at }
            : r
        )
      );
    }
  } catch (e) {
    setError(e?.response?.data?.error || e.message || "Failed to acknowledge alert");
  }
};

const resolve = async (alertId) => {
  try {
    const res = await axios.patch(`${API_BASE}/alerts/${alertId}/resolve`);
    const updated = res.data?.alert;

    if (updated) {
      setRows((prev) =>
        prev.map((r) =>
          r.alert_id === alertId
            ? { ...r, status: updated.status, resolved_at: updated.resolved_at }
            : r
        )
      );
    }
  } catch (e) {
    setError(e?.response?.data?.error || e.message || "Failed to resolve alert");
  }
};

  return (
    <div style={{ padding: 20, maxWidth: 1400 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Operations Alerts</h1>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
            Domain locked to <b>OPERATIONS</b>
          </div>
        </div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>{loading ? "Loading…" : `${total} alerts`}</div>
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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search (message, rule, zone/hall/device)…" style={inputStyle} />

        <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={selectStyle}>
          <option value="">All Severities</option>
          {filters?.severities?.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          {filters?.statuses?.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} style={selectStyle}>
          <option value="">All Zones</option>
          {filters?.zones?.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>

        <select value={hallId} onChange={(e) => setHallId(e.target.value)} style={selectStyle}>
          <option value="">All Halls</option>
          {filters?.halls?.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>

        <input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="Device ID (optional)" style={inputStyle} />

        <select value={ruleKey} onChange={(e) => setRuleKey(e.target.value)} style={selectStyle}>
          <option value="">All Rules</option>
          {filters?.rules?.map((r) => (
            <option key={r.rule_key} value={r.rule_key}>
              {r.rule_key} — {r.rule_name}
            </option>
          ))}
        </select>

        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", gap: 10 }}>
          <button onClick={clearFilters} style={btnSecondary}>Clear filters</button>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={selectStyle}>
              {filters?.sortOptions?.map((s) => <option key={s} value={s}>Sort: {s}</option>)}
            </select>

            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={selectStyle}>
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
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
              <th style={th}>Detected</th>
              <th style={th}>Severity</th>
              <th style={th}>Status</th>
              <th style={th}>Rule</th>
              <th style={th}>Location</th>
              <th style={th}>Trigger</th>
              <th style={th}>Message</th>
              <th style={th}>Recommended Action</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 14, opacity: 0.75 }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 14, opacity: 0.75 }}>No alerts found.</td></tr>
            ) : (
              rows.flatMap((r) => {
                const isOpen = expandedId === r.alert_id;
                const meta = safeJson(r.metadata);
                const triggerStr =
                  r.trigger_value === null || r.trigger_value === undefined
                    ? "-"
                    : `${Number(r.trigger_value).toFixed(3)} / ${Number(r.threshold_value ?? 0).toFixed(3)}`;

                return [
                  (
                    <tr
                      key={r.alert_id}
                      style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                      onClick={() => setExpandedId((cur) => (cur === r.alert_id ? null : r.alert_id))}
                    >
                      <td style={td}>{fmtTs(r.detected_at)}</td>
                      <td style={td}><span style={pillSeverity(r.severity)}>{r.severity}</span></td>
                      <td style={td}><span style={pillStatus(r.status)}>{r.status}</span></td>
                      <td style={tdStrong}>{r.rule_name || r.rule_key}</td>
                      <td style={tdMono}>{[r.zone_id, r.hall_id, r.device_id].filter(Boolean).join(" · ") || "-"}</td>
                      <td style={tdMono}>{triggerStr}</td>
                      <td style={td}>{r.message || "-"}</td>
                      <td style={td}>{r.recommended_action || r.response_action || "-"}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            disabled={r.status !== "NEW"}
                            onClick={() => ack(r.alert_id)}
                            style={{ ...btnTiny, opacity: r.status !== "NEW" ? 0.5 : 1 }}
                          >
                            Ack
                          </button>
                          <button
                            disabled={r.status === "RESOLVED" || r.status === "CLOSED"}
                            onClick={() => resolve(r.alert_id)}
                            style={{ ...btnTiny, opacity: r.status === "RESOLVED" || r.status === "CLOSED" ? 0.5 : 1 }}
                          >
                            Resolve
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                  isOpen ? (
                    <tr key={`${r.alert_id}-details`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td colSpan={9} style={{ padding: 14, background: "#fafafa" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 800, marginBottom: 6 }}>Details</div>
                            <div style={kv}><span style={k}>Alert ID</span><span style={v}>{r.alert_id}</span></div>
                            <div style={kv}><span style={k}>Rule Key</span><span style={v}>{r.rule_key}</span></div>
                            <div style={kv}><span style={k}>Event Timestamp</span><span style={v}>{fmtTs(r.event_timestamp)}</span></div>
                            <div style={kv}><span style={k}>Action Status</span><span style={v}>{r.action_status || "-"}</span></div>

                            {/* ✅ These now stay "-" for NEW alerts */}
                            <div style={kv}><span style={k}>Acknowledged At</span><span style={v}>{fmtTs(r.acknowledged_at)}</span></div>
                            <div style={kv}><span style={k}>Resolved At</span><span style={v}>{fmtTs(r.resolved_at)}</span></div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, marginBottom: 6 }}>Metadata</div>
                            <pre style={{ margin: 0, padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", background: "white", overflowX: "auto", fontSize: 12 }}>
{JSON.stringify(meta || {}, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ].filter(Boolean);
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, opacity: 0.75 }}>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={page <= 1} onClick={() => setPage(1)} style={btnSecondary}>{"<<"}</button>
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={btnSecondary}>Prev</button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={btnSecondary}>Next</button>
          <button disabled={page >= totalPages} onClick={() => setPage(totalPages)} style={btnSecondary}>{">>"}</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = { padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", background: "white" };
const selectStyle = { padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", background: "white" };

const th = { padding: "10px 10px", fontSize: 13, opacity: 0.85, whiteSpace: "nowrap" };
const td = { padding: "10px 10px", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "top" };
const tdStrong = { ...td, fontWeight: 700 };
const tdMono = { ...td, fontFamily: "monospace", fontSize: 12 };

const btnSecondary = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
  cursor: "pointer",
};

const btnTiny = {
  padding: "6px 8px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
};

function pillSeverity(sev) {
  const s = String(sev || "").toUpperCase();
  const bg =
    s === "CRITICAL" ? "#fee2e2" :
    s === "HIGH" ? "#ffedd5" :
    s === "MEDIUM" ? "#fef9c3" :
    s === "LOW" ? "#dcfce7" :
    "#e5e7eb";
  return { padding: "4px 10px", borderRadius: 999, background: bg, fontSize: 12, fontWeight: 900 };
}

function pillStatus(st) {
  const s = String(st || "").toUpperCase();
  const bg =
    s === "NEW" ? "#e0e7ff" :
    s === "ACKNOWLEDGED" ? "#fef9c3" :
    s === "RESOLVED" ? "#dcfce7" :
    s === "CLOSED" ? "#f3f4f6" :
    "#e5e7eb";
  return { padding: "4px 10px", borderRadius: 999, background: bg, fontSize: 12, fontWeight: 800 };
}

const kv = { display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6 };
const k = { fontSize: 12, opacity: 0.7 };
const v = { fontFamily: "monospace", fontSize: 12 };