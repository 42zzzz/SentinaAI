const analyticsDb = require("../dbs/analytics.db");

const AI_BASE = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

// In-memory overlay for simulated surges (hall_id -> override fields)
const SIM_OVERRIDES = new Map();
const SIM_TTL_MS = 5 * 60 * 1000; // keep surge visible for 5 minutes

async function readJsonSafe(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function getLatestTs({ eventId = null, zoneId = null }) {
  const r = await analyticsDb.query(
    `
    SELECT MAX(ts) AS max_ts
    FROM interval_metrics
    WHERE ($1::text IS NULL OR event_id = $1)
      AND ($2::text IS NULL OR zone_id = $2)
    `,
    [eventId, zoneId]
  );
  return r.rows[0]?.max_ts;
}

// OPTIONAL: keep your existing proxy endpoints too (if you still use them)
exports.getVenueStatusProxy = async (req, res) => {
  try {
    const resp = await fetch(`${AI_BASE}/api/venue-status`, { method: "GET" });
    const data = await readJsonSafe(resp);
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: data?.detail || "AI error", data });
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

exports.simulatePredictionProxy = async (req, res) => {
  try {
    const resp = await fetch(`${AI_BASE}/api/simulate-prediction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    });

    const data = await readJsonSafe(resp);

    if (!resp.ok) {
      return res.status(resp.status).json({ ok: false, error: data?.detail || "AI error", data });
    }

    // ✅ Save updates as overlays so /ai/ops-live reflects them
    const updates = data?.updates || [];
    const now = Date.now();

    for (const u of updates) {
      if (!u?.hall_id) continue;

      SIM_OVERRIDES.set(String(u.hall_id), {
        occupancyRatio: Number(u.occupancyRatio),
        co2: Number(u.co2),
        aiAction: u.aiAction,
        isAnomaly: !!u.isAnomaly,
        expiresAt: now + SIM_TTL_MS,
      });
    }

    return res.json(data);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

/**
 * ✅ This is the main endpoint for Option A:
 * Reads telemetry-derived metrics (interval_metrics latest snapshot),
 * derives CO2 proxy, calls AI /infer-action, returns rows for the dashboard.
 */
exports.getOpsLive = async (req, res) => {
  try {
    const eventId = req.query.event_id || null;
    const zoneId = req.query.zone_id || null;

    const ts = await getLatestTs({ eventId, zoneId });
    if (!ts) return res.json({ ok: true, ts: null, rows: [] });

    const r = await analyticsDb.query(
      `
      SELECT
        zone_id,
        hall_id,
        hall_name,
        hall_capacity,
        current_occupancy,
        occupancy_ratio,
        flow_congestion_index
      FROM interval_metrics
      WHERE ts = $1
        AND ($2::text IS NULL OR event_id = $2)
        AND ($3::text IS NULL OR zone_id = $3)
        AND hall_id IS NOT NULL
      `,
      [ts, eventId, zoneId]
    );

    // Build per-hall feature payloads
    const baseRows = r.rows.map((x) => {
      const occRatio = Number(x.occupancy_ratio || 0);

      // CO2 proxy since interval_metrics doesn't store CO2:
      // 400 + occRatio*600 (+ small noise optional)
      const co2 = 400 + occRatio * 600;

      return {
        zone_id: x.zone_id,
        hall_id: x.hall_id,
        hall_name: x.hall_name,
        hall_capacity: Number(x.hall_capacity || 0),
        current_occupancy: Number(x.current_occupancy || 0),
        occupancyRatio: occRatio,
        flowCongestionIndex: Number(x.flow_congestion_index || 0),
        co2,
      };
    });

    // Call AI service per hall (simple + safe for MVP)
    const inferred = await Promise.all(
      baseRows.map(async (h) => {
        const payload = {
          hall_id: String(h.hall_id),
          occupancyRatio: Number(h.occupancyRatio),
          co2: Number(h.co2),
          flowCongestionIndex: Number(h.flowCongestionIndex),
        };

    

        const resp = await fetch(`${AI_BASE}/api/infer-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await readJsonSafe(resp);

        if (!resp.ok || data?.status !== "success") {
          return {
            ...h,
            aiAction: "ai_error",
            isAnomaly: false,
            aiRaw: data,
          };
        }

        return {
          ...h,
          aiAction: data.aiAction,
          isAnomaly: !!data.isAnomaly,
        };
      })
    );
    // ✅ Apply simulation overlays (if any) on top of telemetry-driven rows
const now = Date.now();


const merged = inferred.map((h) => {
  const ov = SIM_OVERRIDES.get(String(h.hall_id));
  if (!ov) return h;

  // expire old overrides
  if (ov.expiresAt && ov.expiresAt < now) {
    SIM_OVERRIDES.delete(String(h.hall_id));
    return h;
  }

  // use simulated occupancy if available
  const occ = Number.isFinite(ov.occupancyRatio) ? ov.occupancyRatio : Number(h.occupancyRatio || 0);

  // ✅ derive congestion from occupancy (demo-friendly)
  const simulatedCongestion =
    occ >= 0.9 ? 0.95 :
    occ >= 0.8 ? 0.85 :
    occ >= 0.65 ? 0.70 :
    occ >= 0.4 ? 0.55 :
    0.35;

  return {
    ...h,
    occupancyRatio: occ,
    co2: Number.isFinite(ov.co2) ? ov.co2 : h.co2,
    flowCongestionIndex: simulatedCongestion, // ✅ this is the key
    aiAction: ov.aiAction ?? h.aiAction,
    isAnomaly: typeof ov.isAnomaly === "boolean" ? ov.isAnomaly : h.isAnomaly,
  };
});

return res.json({ ok: true, ts, rows: merged });
    return res.json({ ok: true, ts, rows: inferred });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

exports.getOccupancyForecast = async (req, res) => {
  try {
    const hallId = req.query.hall_id;
    if (!hallId) return res.status(400).json({ ok: false, error: "hall_id is required" });

    // Latest snapshot timestamp
    const rTs = await analyticsDb.query(`SELECT MAX(ts) AS max_ts FROM interval_metrics`);
    const ts = rTs.rows[0]?.max_ts;
    if (!ts) return res.json({ ok: true, ts: null, hall_id: hallId, points: [] });

    // Pull hall metadata + baseline occupancy info
    const rHall = await analyticsDb.query(
      `
      SELECT hall_id, hall_name, venue_role, hall_capacity, current_occupancy, occupancy_ratio
      FROM interval_metrics
      WHERE ts = $1 AND hall_id = $2
      LIMIT 1
      `,
      [ts, hallId]
    );

    if (!rHall.rows.length) {
      return res.status(404).json({ ok: false, error: `No interval_metrics row found for hall_id=${hallId}` });
    }

    const row = rHall.rows[0];

    // Day + hour derived from ts
    const dt = new Date(ts);
    const hourOfDay = dt.getHours();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayOfWeek = dayNames[dt.getDay()];

    // Call AI forecaster (baseline forecast)
    const payload = {
      hall_id: String(row.hall_id),
      venueRole: String(row.venue_role || "default"),
      hourOfDay,
      dayOfWeek,
    };

    const resp = await fetch(`${AI_BASE}/api/occupancy-forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await readJsonSafe(resp);
    if (!resp.ok || data?.status !== "success") {
      return res.status(502).json({ ok: false, error: "AI occupancy-forecast failed", data });
    }

    const capacity = Number(row.hall_capacity || 0);
    const baseOccRatio = Number(row.occupancy_ratio || 0);
    const baseCurrent = Number(row.current_occupancy || 0);

    // ✅ Apply simulation override (if exists) by scaling forecast
    const ov = SIM_OVERRIDES.get(String(row.hall_id));
    let scale = 1;

    if (ov && (!ov.expiresAt || ov.expiresAt >= Date.now())) {
      const simOccRatio = Number(ov.occupancyRatio);
      const simCurrent = capacity > 0 ? simOccRatio * capacity : baseCurrent;

      // If baseline is tiny (like 10 ppl), scaling can explode. Guard it.
      // Use ratio scaling when baseline ratio is non-trivial; else use delta shift.
      if (baseOccRatio >= 0.05) {
        scale = simOccRatio / baseOccRatio;
      } else if (baseCurrent > 0) {
        scale = simCurrent / baseCurrent;
      } else {
        scale = 1;
      }
    }

    const points = (data.points || []).map((p) => {
      const rawPred = Number(p.predictedOccupancy || 0);
      let adjusted = Math.round(rawPred * scale);

      // Clamp to [0, capacity] if capacity is known
      if (capacity > 0) adjusted = Math.max(0, Math.min(capacity, adjusted));
      return { ...p, predictedOccupancy: adjusted };
    });

    return res.json({
      ok: true,
      ts,
      hall_id: row.hall_id,
      hall_name: row.hall_name,
      venue_role: row.venue_role,
      scaleApplied: scale,
      points,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};