// controllers/ai.controller.js
const AI_BASE = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

// Helper to safely parse JSON responses
async function readJsonSafe(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

exports.getVenueStatus = async (req, res) => {
  try {
    const resp = await fetch(`${AI_BASE}/api/venue-status`, { method: "GET" });
    const raw = await readJsonSafe(resp);

    if (!resp.ok) {
      return res.status(resp.status).json({
        ok: false,
        error: raw?.detail || raw?.error || "AI service error",
        data: raw,
      });
    }

    // FastAPI returns: { status: "success", data: [...] }
    const rows = Array.isArray(raw?.data) ? raw.data : [];

    // Normalize to what React expects (hall_id + aiAction)
    const normalized = rows.map((h) => ({
      hall_id: h.id || (h.hallName ? h.hallName.replace(/\s+/g, "_").toLowerCase() : ""),
      hallName: h.hallName,
      capacity: h.capacity,
      currentOccupancy: h.currentOccupancy,
      occupancyRatio: h.occupancyRatio,
      co2: h.co2,
      predictedOccupancyNextHour: h.predictedOccupancyNextHour,
      aiAction: h.aiRecommendedAction,   // normalize name
      isAnomaly: !!h.isAnomaly,
    }));

    return res.json(normalized);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

exports.simulatePrediction = async (req, res) => {
  try {
    // Expecting: { hall_id, occupancy, co2 }
    const payload = req.body || {};

    const resp = await fetch(`${AI_BASE}/api/simulate-prediction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await readJsonSafe(resp);

    if (!resp.ok) {
      return res.status(resp.status).json({
        ok: false,
        error: data?.detail || data?.error || "AI service error",
        data,
      });
    }

    return res.json(data);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};