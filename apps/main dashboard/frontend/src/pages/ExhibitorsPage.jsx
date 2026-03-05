import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./ExhibitorsPage.css";

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
  const [selectedExhibitor, setSelectedExhibitor] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Query state
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("");
  const [hqCountry, setHqCountry] = useState("");
  const [status, setStatus] = useState("");
  const [eventId, setEventId] = useState("");
  const [packageTier, setPackageTier] = useState("");
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

  // Load filters + events list
  useEffect(() => {
    const load = async () => {
      try {
        const [f, ev] = await Promise.all([
          axios.get(`${API_BASE}/exhibitors/filters`),
          axios.get(`${API_BASE}/events`, {
            params: { page: 1, pageSize: 50, sort: "start_desc" },
          }),
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

  useEffect(() => setPage(1), [industry, hqCountry, status, eventId, packageTier, sort, pageSize]);
  useEffect(() => {
    if (!eventId) setPackageTier("");
  }, [eventId]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

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
    <div className="exhibitorsPage">
      <div className="pageInner">

        <div className="exhibitorsHeaderRow">
          <h1>Exhibitors</h1>

          <div className="exhibitorsHeaderRight">
            <div className="exhibitorsCountTop">
              {loading ? "Loading…" : `${total} exhibitors`}
            </div>
          </div>
        </div>

        <div className="exhibitorsControlsCard">

          <div className="exhibitorsFiltersRow">

            <div className="filterPill pillSearch">
              <input
                className="pillInput"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search (Exhibitor ID / Name)"
              />
            </div>

            <div className="filterPill pillEvent pillSelectWrap">
              <select
                className="pillSelect"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                <option value="">All Events (Global)</option>
                {events.map(ev => (
                  <option key={ev.event_id} value={ev.event_id}>
                    {ev.event_id} — {ev.event_name}
                  </option>
                ))}
              </select>
              <div className="pillRightCaret"></div>
            </div>

            <div className="filterPill pillTier pillSelectWrap">
              <select
                className="pillSelect"
                value={packageTier}
                onChange={(e) => setPackageTier(e.target.value)}
                disabled={!eventId}
              >
                <option value="">
                  {eventId ? "All Tiers" : "Select event first"}
                </option>
                {filters?.packageTiers?.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <div className="pillRightCaret"></div>
            </div>

            <div className="filterPill pillIndustry pillSelectWrap">
              <select
                className="pillSelect"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              >
                <option value="">All Industries</option>
                {filters?.industries?.map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
              <div className="pillRightCaret"></div>
            </div>

            <div className="filterPill pillCountry pillSelectWrap">
              <select
                className="pillSelect"
                value={hqCountry}
                onChange={(e) => setHqCountry(e.target.value)}
              >
                <option value="">All HQ Countries</option>
                {filters?.hqCountries?.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="pillRightCaret"></div>
            </div>

            <div className="filterPill pillStatus pillSelectWrap">
              <select
                className="pillSelect"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All Status</option>
                {filters?.statuses?.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <div className="pillRightCaret"></div>
            </div>

          </div>

          <div className="exhibitorsControlsBottomRow">

            <button
              className="clearFiltersBtn"
              onClick={clearFilters}
            >
              Clear filters
            </button>

          </div>

        </div>

        <div className="exhibitorsTableCard">
          <div className="exhibitorsTableScroll">

            <table className="exhibitorsTable">

              <thead>
                <tr>
                  <th>Exhibitor</th>
                  <th>Industry</th>
                  <th>HQ</th>
                  <th>Status</th>
                  <th>Contact</th>
                  <th>Events</th>
                  <th>Total Paid</th>
                  <th>Tier</th>
                </tr>
              </thead>

              <tbody>

                {rows.map(r => (
                  <tr
                    key={r.exhibitor_id}
                    className="exhibitorsRow"
                    onClick={async () => {
                      const res = await axios.get(`${API_BASE}/exhibitors/${r.exhibitor_id}`)
                      setSelectedExhibitor(res.data.exhibitor)
                      setShowModal(true)
                    }}
                  >

                    <td>
                      <div className="exhibitorName">{r.exhibitor_name}</div>
                      <div className="exhibitorId">{r.exhibitor_id}</div>
                    </td>

                    <td>{r.industry}</td>
                    <td>{r.hq_country}</td>

                    <td>
                      <span className={`statusPill ${r.status}`}>
                        {r.status}
                      </span>
                    </td>

                    <td>
                      {r.contact_name}
                      <div className="exhibitorContact">{r.contact_email}</div>
                      <div className="exhibitorContact">{r.contact_phone}</div>
                    </td>

                    <td>{r.events_count}</td>
                    <td>{formatAED(r.total_paid_aed)}</td>
                    <td>{r.any_package_tier}</td>

                  </tr>
                ))}

              </tbody>

            </table>

          </div>
        </div>

        {showModal && selectedExhibitor && (
          <div className="modalOverlay">
            <div className="modalBox">

              <h2>{selectedExhibitor.exhibitor_name}</h2>

              <div className="modalGrid">
                <Detail label="Exhibitor ID" value={selectedExhibitor.exhibitor_id} />
                <Detail label="Industry" value={selectedExhibitor.industry} />
                <Detail label="HQ Country" value={selectedExhibitor.hq_country} />
                <Detail label="Contact Name" value={selectedExhibitor.contact_name} />
                <Detail label="Contact Email" value={selectedExhibitor.contact_email} />
                <Detail label="Contact Phone" value={selectedExhibitor.contact_phone?.replace(/^'/, "")} />
                <Detail label="Status" value={selectedExhibitor.status} />
              </div>

              <div className="modalFooter">
                <button className="closeBtn" onClick={() => setShowModal(false)}>
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div className="modalLabel">{label}</div>
      <div className="modalValue">{value || "-"}</div>
    </div>
  );
}

const inputStyle = { padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" };
const selectStyle = { padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", background: "white" };
const th = { padding: 10 };
const td = { padding: 10 };
const tdStrong = { ...td, fontWeight: 700 };

const btnSecondary = { padding: 8, borderRadius: 10, border: "1px solid #e5e7eb", background: "white" };

function pill(status) {
  const bg = status === "active" ? "#dcfce7" : "#e5e7eb";
  return { padding: "4px 10px", borderRadius: 999, background: bg };
}

const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modalBox = {
  background: "white",
  padding: 30,
  borderRadius: 14,
  width: 700,
  maxHeight: "80vh",
  overflowY: "auto",
};

const modalGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginTop: 20,
};

const closeBtn = {
  marginTop: 20,
  padding: "8px 16px",
  borderRadius: 10,
  border: "none",
  background: "#133250",
  color: "white",
  cursor: "pointer",
};