from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import random
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import warnings

warnings.filterwarnings('ignore')

# Initialize the API
app = FastAPI(title="SentinaAI Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. GLOBALLY LOAD & TRAIN MODELS ---
print("Loading data and training SentinaAI models...")
ops_df = pd.read_csv('Operations and Sustainability Dataset v1.csv')
venue_df = ops_df[['hallName', 'venueRole', 'hallCapacity']].drop_duplicates().reset_index(drop=True)

# Generate CO2 proxy for training
ops_df['co2'] = 400 + (ops_df['occupancyRatio'] * 600) + np.random.randint(-50, 50, size=len(ops_df))

# Encoders
le_venue = LabelEncoder()
ops_df['venueRole_encoded'] = le_venue.fit_transform(ops_df['venueRole'])

le_action = LabelEncoder()
ops_df['action_encoded'] = le_action.fit_transform(ops_df['recommendedAction'])

day_map = {'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4, 'Saturday': 5, 'Sunday': 6}
ops_df['day_code'] = ops_df['dayOfWeek'].map(day_map)

# Models
forecaster = RandomForestRegressor(n_estimators=50, random_state=42)
safety = RandomForestClassifier(n_estimators=50, random_state=42)

from datetime import datetime, timezone

class OccupancyForecastRequest(BaseModel):
    hall_id: str
    venueRole: str
    hourOfDay: int
    dayOfWeek: str  # e.g. "Monday"

@app.post("/api/occupancy-forecast")
def occupancy_forecast(req: OccupancyForecastRequest):
    """
    Predict occupancy for the next 60 minutes (4 x 15-min points) using the trained forecaster.
    We keep the model inputs aligned with training: [hourOfDay, day_code, venueRole_encoded]
    """
    day_map = {'Monday':0, 'Tuesday':1, 'Wednesday':2, 'Thursday':3, 'Friday':4, 'Saturday':5, 'Sunday':6}

    try:
        day_code = day_map.get(req.dayOfWeek, 0)
        role_code = le_venue.transform([req.venueRole])[0]
    except Exception:
        # fallback if unseen role
        day_code = day_map.get(req.dayOfWeek, 0)
        role_code = 0

    points = []
    base_hour = int(req.hourOfDay)

    # 4 points: +15, +30, +45, +60 minutes
    for i in range(1, 5):
        # keep hour input simple (model trained on int hourOfDay)
        hour_in = (base_hour + ((i * 15) // 60)) % 24
        y = float(forecaster.predict([[hour_in, day_code, role_code]])[0])

        points.append({
            "offsetMinutes": i * 15,
            "predictedOccupancy": int(round(y))
        })

    return {
        "status": "success",
        "hall_id": req.hall_id,
        "points": points
    }

def train_models():
    X_f = ops_df[['hourOfDay', 'day_code', 'venueRole_encoded']]
    y_f = ops_df['currentOccupancy']
    forecaster.fit(X_f, y_f)

    X_s = ops_df[['occupancyRatio', 'co2', 'flowCongestionIndex']]
    y_s = ops_df['action_encoded']
    safety.fit(X_s, y_s)

train_models()
print("Models trained successfully! API is ready.")

# --- 2. AUTOMATIC RETRIGGERING LOGIC ---
def auto_retrain_pipeline():
    print("\n⚙️ AUTO-RETRIGGER: Anomaly detected by Edge Node!")
    print("⚙️ Step 7: Syncing new surge data to Cloud...")
    print("⚙️ Step 8: Updating Random Forest weights...")
    try:
        train_models()
        print("✅ Models successfully retrained and redeployed!")
    except Exception as e:
        print(f"❌ Retraining Error: {e}")

# --- 3. SHARED IN-MEMORY HALL STATE (so simulate affects venue-status) ---
# This is the key fix: both endpoints read/write the same state.
HALL_STATE = {}  # hall_id -> dict

def init_hall_state_from_baseline(halls_data):
    """Initialize global state once from baseline venue-status rows."""
    global HALL_STATE
    if HALL_STATE:
        return
    for h in halls_data:
        hid = h["id"]
        HALL_STATE[hid] = {
            "hall_id": hid,
            "hallName": h.get("hallName"),
            "capacity": int(h.get("capacity", 0)),
            "currentOccupancy": int(h.get("currentOccupancy", 0)),
            "occupancyRatio": float(h.get("occupancyRatio", 0.0)),
            "co2": float(h.get("co2", 0.0)),
            "predictedOccupancyNextHour": int(h.get("predictedOccupancyNextHour", 0)),
            "aiAction": h.get("aiRecommendedAction", "none"),
            "isAnomaly": bool(h.get("isAnomaly", False)),
        }

# --- 4. LIVE VENUE STATUS ENDPOINT ---
@app.get("/api/venue-status")
def get_venue_status():
    """
    Returns live status. IMPORTANT:
    - On first call, initializes HALL_STATE from baseline (randomised) values.
    - On subsequent calls, returns HALL_STATE (so simulations persist and show on dashboard).
    """
    if HALL_STATE:
        return {"status": "success", "data": list(HALL_STATE.values())}

    halls_data = []
    for _, hall in venue_df.iterrows():
        occ_factor = random.uniform(0.1, 0.6)
        current_people = int(hall['hallCapacity'] * occ_factor)
        live_co2 = 400 + (occ_factor * 600) + random.randint(-20, 50)
        occ_ratio = current_people / hall['hallCapacity']

        role_code = le_venue.transform([hall['venueRole']])[0]
        pred_occ = forecaster.predict([[15, 4, role_code]])[0]

        safety_input = [[occ_ratio, live_co2, 0.5]]
        action_code = safety.predict(safety_input)[0]
        rec_action = le_action.inverse_transform([action_code])[0]

        # IMPORTANT: id formatting MUST match the simulation adjacency keys (e.g., "Hall 1" -> "hall1")
        hall_id = hall['hallName'].replace(" ", "").lower()

        halls_data.append({
            "id": hall_id,
            "hallName": hall['hallName'],
            "capacity": int(hall['hallCapacity']),
            "currentOccupancy": int(current_people),
            "occupancyRatio": float(occ_ratio),
            "co2": float(live_co2),
            "predictedOccupancyNextHour": int(pred_occ),
            "aiRecommendedAction": rec_action,
            "isAnomaly": str(rec_action).lower() != 'none'
        })

    # Initialize shared state ONCE from this baseline
    init_hall_state_from_baseline(halls_data)
    return {"status": "success", "data": list(HALL_STATE.values())}

# --- 5. THE "ACTUAL SIMULATION" ENGINE ---
class SimulationRequest(BaseModel):
    hall_id: str
    occupancy: int
    co2: int

ADJACENCY_MAP = {
    # Core halls (Zone C: Hall1..Hall6)
    "HZC01": ["HZC02", "HZD04", "HZA01", "HZB01"],   # Hall1 connected to Hall2, NorthHall4, SouthHall1, EastHall1
    "HZC02": ["HZC01", "HZC03"],
    "HZC03": ["HZC02", "HZC04"],
    "HZC04": ["HZC03", "HZC05"],
    "HZC05": ["HZC04", "HZC06"],
    "HZC06": ["HZC05"],

    # North halls (Zone D: NorthHall1..NorthHall6)
    "HZD01": ["HZD02"],
    "HZD02": ["HZD01", "HZD03"],
    "HZD03": ["HZD02", "HZD04"],
    "HZD04": ["HZD03", "HZD05", "HZC01"],           # NorthHall4 connected back to Hall1
    "HZD05": ["HZD04", "HZD06"],
    "HZD06": ["HZD05"],

    # South halls (Zone A: SouthHall1..SouthHall6)
    "HZA01": ["HZA02", "HZC01"],                    # SouthHall1 connected back to Hall1
    "HZA02": ["HZA01", "HZA03"],
    "HZA03": ["HZA02", "HZA04"],
    "HZA04": ["HZA03", "HZA05"],
    "HZA05": ["HZA04", "HZA06"],
    "HZA06": ["HZA05"],

    # East halls (Zone B: EastHall1..EastHall4)
    "HZB01": ["HZB02", "HZC01"],                    # EastHall1 connected back to Hall1
    "HZB02": ["HZB01", "HZB03"],
    "HZB03": ["HZB02", "HZB04"],
    "HZB04": ["HZB03"],

    # Additional halls in Zone B (Hall7..Hall10)
    "HZB05": ["HZB06"],
    "HZB06": ["HZB05", "HZB07"],
    "HZB07": ["HZB06", "HZB08"],
    "HZB08": ["HZB07"],
}

# --- 4B. TELEMETRY-DRIVEN INFERENCE ENDPOINT (Option A) ---
class InferActionRequest(BaseModel):
    hall_id: str
    occupancyRatio: float          # 0.0 to 1.0
    co2: float                     # ppm
    flowCongestionIndex: float     # 0.0 to 1.0 (or your scale)

@app.post("/api/infer-action")
def infer_action(req: InferActionRequest):
    """
    Given telemetry-derived features (from interval_metrics),
    return AI action + anomaly flag. This aligns with the model’s training features:
    [occupancyRatio, co2, flowCongestionIndex]
    """
    try:
        safety_input = [[float(req.occupancyRatio), float(req.co2), float(req.flowCongestionIndex)]]
        action_code = safety.predict(safety_input)[0]
        rec_action = le_action.inverse_transform([action_code])[0]
    except Exception:
        rec_action = "pipeline_error"

    is_anomaly = str(rec_action).lower() != "none"

    return {
        "status": "success",
        "hall_id": req.hall_id,
        "occupancyRatio": float(req.occupancyRatio),
        "co2": float(req.co2),
        "flowCongestionIndex": float(req.flowCongestionIndex),
        "aiAction": rec_action,
        "isAnomaly": bool(is_anomaly),
    }

def run_ai_pipeline(occ_percent, co2_level):
    occ_ratio = occ_percent / 100.0

    # Better congestion proxy for runtime (still simple, but more varied)
    # 0.3 low, 0.6 medium, 0.9 high
    if occ_ratio >= 0.9:
        congestion = 0.95
    elif occ_ratio >= 0.8:
        congestion = 0.85
    elif occ_ratio >= 0.65:
        congestion = 0.70
    else:
        congestion = 0.45

    safety_input = [[occ_ratio, co2_level, congestion]]

    # 1) Try ML prediction first
    try:
        action_code = safety.predict(safety_input)[0]
        rec_action = le_action.inverse_transform([action_code])[0]
    except Exception:
        rec_action = "pipeline_error"

    # 2) Rule override (demo + safety logic)
    # If ML says "none" but thresholds are clearly unsafe, override
    rec_action_norm = str(rec_action).lower()

    # CO2 thresholds (ppm) – simple indoor air quality bands for demo
    high_co2 = co2_level >= 1000
    very_high_co2 = co2_level >= 1400

    high_occ = occ_ratio >= 0.80
    very_high_occ = occ_ratio >= 0.90

    if rec_action_norm == "none":
        if very_high_occ and very_high_co2:
            rec_action = "dispatchSecurity"
        elif very_high_occ:
            rec_action = "redirectFlow"
        elif high_occ and high_co2:
            rec_action = "increaseVentilation"
        elif high_occ:
            rec_action = "redirectFlow"
        elif high_co2:
            rec_action = "increaseVentilation"

    is_anomaly = str(rec_action).lower() != "none"
    return occ_ratio, rec_action, is_anomaly

def _ensure_state_initialized():
    """If someone hits simulate before venue-status, build state once."""
    if HALL_STATE:
        return
    _ = get_venue_status()  # this will init state

def _apply_update_to_state(hall_id, occ_ratio, co2, ai_action, is_anomaly):
    """Write the simulated update into global state."""
    # Preserve existing metadata if present
    existing = HALL_STATE.get(hall_id, {})

    capacity = int(existing.get("capacity", 0)) if existing else 0
    if capacity <= 0:
        # best-effort fallback capacity
        cap_row = venue_df[venue_df["hallName"].str.replace(" ", "").str.lower() == hall_id]
        if len(cap_row) > 0:
            capacity = int(cap_row.iloc[0]["hallCapacity"])
        else:
            capacity = 1000

    current_people = int(round(occ_ratio * capacity))

    HALL_STATE[hall_id] = {
        "hall_id": hall_id,
        "hallName": existing.get("hallName", hall_id),
        "capacity": capacity,
        "currentOccupancy": current_people,
        "occupancyRatio": float(occ_ratio),
        "co2": float(co2),
        "predictedOccupancyNextHour": int(existing.get("predictedOccupancyNextHour", current_people)),
        "aiAction": ai_action,
        "isAnomaly": bool(is_anomaly),
    }

@app.post("/api/simulate-prediction")
def simulate_prediction(data: SimulationRequest):
    """
    Injects a crowd surge into a hall and updates neighbour halls (spillover).
    IMPORTANT:
    - Writes results into HALL_STATE so /api/venue-status reflects it immediately.
    """
    _ensure_state_initialized()

    print(f"\n🌊 CROWD SURGE INJECTED AT: {data.hall_id} | Occ: {data.occupancy}% | CO2: {data.co2}")

    updates = []

    # Ground zero
    occ_ratio, ai_action, is_anomaly = run_ai_pipeline(data.occupancy, data.co2)

    updates.append({
        "hall_id": data.hall_id,
        "occupancyRatio": occ_ratio,
        "co2": float(data.co2),
        "aiAction": ai_action,
        "isAnomaly": is_anomaly
    })

    # Persist ground zero into state
    _apply_update_to_state(data.hall_id, occ_ratio, data.co2, ai_action, is_anomaly)

    # Auto-retrain if anomaly detected
    if is_anomaly:
        auto_retrain_pipeline()

    # Spillover
    if data.occupancy > 75:
        neighbors = ADJACENCY_MAP.get(data.hall_id, [])
        for neighbor in neighbors:
            spill_occ = int(data.occupancy * random.uniform(0.30, 0.55))
            spill_co2 = int(400 + (spill_occ * 6) + random.randint(-20, 50))

            n_occ_ratio, n_ai_action, n_is_anomaly = run_ai_pipeline(spill_occ, spill_co2)

            updates.append({
                "hall_id": neighbor,
                "occupancyRatio": n_occ_ratio,
                "co2": float(spill_co2),
                "aiAction": n_ai_action,
                "isAnomaly": n_is_anomaly
            })

            # Persist neighbour update into state
            _apply_update_to_state(neighbor, n_occ_ratio, spill_co2, n_ai_action, n_is_anomaly)

    return {"status": "success", "updates": updates}