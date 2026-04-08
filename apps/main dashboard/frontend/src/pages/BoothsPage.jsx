import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./BoothsPage.css";
import MultiSelectPill from "../components/MultiSelectPill";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export default function BoothsPage() {
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState(null);

  const [eventIds, setEventIds] = useState([]);
  const [q, setQ] = useState("");
  const [zoneIds, setZoneIds] = useState([]);
  const [hallIds, setHallIds] = useState([]);
  const [sizeTypes, setSizeTypes] = useState([]);
  const [assignedValues, setAssignedValues] = useState([]);
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
      })
      .catch((e) =>
        setError(e?.response?.data?.error || e.message || "Failed to load events")
      );
  }, []);

  useEffect(() => {
    axios
      .get(`${API_BASE}/booths/filters`, {
        params: { event_id: eventIds.length ? eventIds.join(",") : undefined },
      })
      .then((res) => setFilters(res.data))
      .catch((e) =>
        setError(
          e?.response?.data?.error ||
            e.message ||
            "Failed to load booth filters"
        )
      );
  }, [eventIds]);

  useEffect(() => {
    const selectedAssigned = assignedValues.length === 1 ? assignedValues[0] : undefined;

    const fetchBooths = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await axios.get(`${API_BASE}/booths`, {
          params: {
            event_id: eventIds.length ? eventIds.join(",") : undefined,
            q: qLive || undefined,
            zone_id: zoneIds.length ? zoneIds.join(",") : undefined,
            hall_id: hallIds.length ? hallIds.join(",") : undefined,
            booth_size_type: sizeTypes.length ? sizeTypes.join(",") : undefined,
            assigned: selectedAssigned || undefined,
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
  }, [eventIds, qLive, zoneIds, hallIds, sizeTypes, assignedValues, sort, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [eventIds, zoneIds, hallIds, sizeTypes, assignedValues, sort, pageSize]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const hallOptions = useMemo(() => {
    const allHalls = filters?.halls || [];
    if (!zoneIds.length) return allHalls;
    return allHalls.filter((hall) => zoneIds.includes(String(hall.zone_id || "")));
  }, [filters, zoneIds]);

  useEffect(() => {
    setHallIds((prev) => prev.filter((hallId) => hallOptions.some((hall) => String(hall.hall_id) === String(hallId))));
  }, [hallOptions]);

  const assignedOptions = useMemo(
    () => [
      { value: "true", label: "Assigned" },
      { value: "false", label: "Unassigned" },
    ],
    []
  );

  return (
    <div className="boothsPage">
      <div className="pageInner">

        <div className="boothsHeaderRow">
          <div className="boothsHeaderRight">
            <div className="boothsCountTop">
              {loading ? "Loading…" : `${total} booths`}
            </div>
          </div>
        </div>

        <div className="boothsControlsCard">

          <div className="boothsFiltersRow">

            <MultiSelectPill
              className="pillEvent"
              label="Event"
              options={events}
              value={eventIds}
              onChange={setEventIds}
              getOptionValue={(option) => option.event_id}
              getOptionLabel={(option) => `${option.event_id} — ${option.event_name}`}
            />

            <div className="filterPill pillSearch">
              <input
                className="pillInput"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search booth/exhibitor..."
              />
            </div>

            <MultiSelectPill
              className="pillZone"
              label="Zone"
              options={filters?.zones || []}
              value={zoneIds}
              onChange={setZoneIds}
            />

            <MultiSelectPill
              className="pillHall"
              label="Hall"
              options={hallOptions}
              value={hallIds}
              onChange={setHallIds}
              getOptionValue={(option) => option.hall_id}
              getOptionLabel={(option) => option.hall_id}
            />

            <MultiSelectPill
              className="pillSize"
              label="Size"
              options={filters?.boothSizeTypes || []}
              value={sizeTypes}
              onChange={setSizeTypes}
            />

            <MultiSelectPill
              className="pillAssigned"
              label="Assigned"
              options={assignedOptions}
              value={assignedValues}
              onChange={setAssignedValues}
              getOptionValue={(option) => option.value}
              getOptionLabel={(option) => option.label}
            />

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