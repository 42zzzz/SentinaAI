import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./BoothsPage.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export default function BoothsPage() {
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState(null);

  const [eventId, setEventId] = useState("");
  const [q, setQ] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [hallId, setHallId] = useState("");
  const [sizeType, setSizeType] = useState("");
  const [assigned, setAssigned] = useState("");
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

  useEffect(() => {
    axios
      .get(`${API_BASE}/events`, {
        params: { page: 1, pageSize: 50, sort: "start_desc" },
      })
      .then((res) => {
        setEvents(res.data.rows || []);
        if (res.data.rows?.length) {
          setEventId(res.data.rows[0].event_id);
        }
      })
      .catch((e) =>
        setError(e?.response?.data?.error || e.message || "Failed to load events")
      );
  }, []);

  useEffect(() => {
    if (!eventId) return;

    axios
      .get(`${API_BASE}/booths/filters`, { params: { event_id: eventId } })
      .then((res) => setFilters(res.data))
      .catch((e) =>
        setError(
          e?.response?.data?.error ||
            e.message ||
            "Failed to load booth filters"
        )
      );
  }, [eventId]);

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
        setError(
          e?.response?.data?.error || e.message || "Failed to load booths"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchBooths();
  }, [eventId, qLive, zoneId, hallId, sizeType, assigned, sort, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [eventId, zoneId, hallId, sizeType, assigned, sort, pageSize]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  return (
    <div className="boothsPage">
      <div className="pageInner">

        <div className="boothsHeaderRow">
          <h1>Booths & Assignments</h1>

          <div className="boothsHeaderRight">
            <div className="boothsCountTop">
              {loading ? "Loading…" : `${total} booths`}
            </div>
          </div>
        </div>

        <div className="boothsControlsCard">

          <div className="boothsFiltersRow">

            <div className="filterPill pillEvent pillSelectWrap">
              <select
                className="pillSelect"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                {events.map((ev) => (
                  <option key={ev.event_id} value={ev.event_id}>
                    {ev.event_id} — {ev.event_name}
                  </option>
                ))}
              </select>
              <div className="pillRightCaret"></div>
            </div>

            <div className="filterPill pillSearch">
              <input
                className="pillInput"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search booth/exhibitor..."
              />
            </div>

            <div className="filterPill pillZone pillSelectWrap">
              <select
                className="pillSelect"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
              >
                <option value="">All Zones</option>
                {filters?.zones?.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <div className="pillRightCaret"></div>
            </div>

            <div className="filterPill pillHall pillSelectWrap">
              <select
                className="pillSelect"
                value={hallId}
                onChange={(e) => setHallId(e.target.value)}
              >
                <option value="">All Halls</option>
                {filters?.halls?.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <div className="pillRightCaret"></div>
            </div>

            <div className="filterPill pillSize pillSelectWrap">
              <select
                className="pillSelect"
                value={sizeType}
                onChange={(e) => setSizeType(e.target.value)}
              >
                <option value="">All Sizes</option>
                {filters?.boothSizeTypes?.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <div className="pillRightCaret"></div>
            </div>

            <div className="filterPill pillAssigned pillSelectWrap">
              <select
                className="pillSelect"
                value={assigned}
                onChange={(e) => setAssigned(e.target.value)}
              >
                <option value="">Assigned + Unassigned</option>
                <option value="true">Assigned only</option>
                <option value="false">Unassigned only</option>
              </select>
              <div className="pillRightCaret"></div>
            </div>

          </div>

          <div className="boothsControlsBottomRow">

            <div className="filterPill pillSelectWrap" style={{ width: 220 }}>
              <select
                className="pillSelect"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                {filters?.sortOptions?.map((s) => (
                  <option key={s} value={s}>
                    Sort: {s}
                  </option>
                ))}
              </select>
              <div className="pillRightCaret"></div>
            </div>

            <div className="rowsControl">
              <div className="rowsLabel">Rows:</div>

              <div className="filterPill pillSelectWrap" style={{ width: 70 }}>
                <select
                  className="pillSelect"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <div className="pillRightCaret"></div>
              </div>
            </div>

          </div>

        </div>

        {error ? (
          <div className="boothsError">
            <div className="boothsErrorTitle">Error</div>
            <div className="boothsErrorBody">{error}</div>
          </div>
        ) : null}

        <div className="boothsTableCard">
          <div className="boothsTableScroll">

            <table className="boothsTable">

              <thead>
                <tr>
                  <th>Booth</th>
                  <th>Zone</th>
                  <th>Hall</th>
                  <th>Hall Name</th>
                  <th>Size</th>
                  <th>Area (sqm)</th>
                  <th>Assigned?</th>
                  <th>Exhibitor</th>
                  <th>Assigned At</th>
                  <th>Assignment Status</th>
                </tr>
              </thead>

              <tbody>

                {loading ? (
                  <tr>
                    <td colSpan="10">Loading…</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan="10">No booths found.</td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.booth_id} className="boothsRow">

                      <td>
                        <div className="boothCode">{r.booth_code}</div>
                        <div className="boothId">{r.booth_id}</div>
                      </td>

                      <td>{r.zone_id}</td>
                      <td>{r.hall_id}</td>
                      <td>{r.hall_name || "-"}</td>
                      <td>{r.booth_size_type}</td>
                      <td>{r.booth_area_sqm ?? "-"}</td>

                      <td>
                        <span
                          className={`statusPill ${
                            r.is_assigned ? "assigned" : "unassigned"
                          }`}
                        >
                          {r.is_assigned ? "Assigned" : "Unassigned"}
                        </span>
                      </td>

                      <td>
                        {r.exhibitor_name ? (
                          <>
                            <div>{r.exhibitor_name}</div>
                            <div className="exhibitorId">{r.exhibitor_id}</div>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td>
                        {r.assigned_at
                          ? new Date(r.assigned_at).toLocaleString()
                          : "-"}
                      </td>

                      <td>{r.assignment_status || "-"}</td>

                    </tr>
                  ))
                )}

              </tbody>

            </table>

          </div>
        </div>

        <div className="boothsPager">

          <div className="boothsPagerLeft">
            Page {page} of {totalPages}
          </div>

          <div className="boothsPagerRight">

            <button
              className="pagerBtn"
              disabled={page <= 1}
              onClick={() => setPage(1)}
            >
              {"<<"}
            </button>

            <button
              className="pagerBtn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>

            <button
              className="pagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>

            <button
              className="pagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
            >
              {">>"}
            </button>

          </div>

        </div>

      </div>
    </div>
  );
}