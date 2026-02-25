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

ops_df['co2'] = 400 + (ops_df['occupancyRatio'] * 600) + np.random.randint(-50, 50, size=len(ops_df))
le_venue = LabelEncoder()
ops_df['venueRole_encoded'] = le_venue.fit_transform(ops_df['venueRole'])
le_action = LabelEncoder()
ops_df['action_encoded'] = le_action.fit_transform(ops_df['recommendedAction'])
day_map = {'Monday':0, 'Tuesday':1, 'Wednesday':2, 'Thursday':3, 'Friday':4, 'Saturday':5, 'Sunday':6}
ops_df['day_code'] = ops_df['dayOfWeek'].map(day_map)

# Global Models
forecaster = RandomForestRegressor(n_estimators=50)
safety = RandomForestClassifier(n_estimators=50)

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
        # Re-run the training function to simulate continuous learning
        train_models()
        print("✅ Models successfully retrained and redeployed!")
    except Exception as e:
        print(f"❌ Retraining Error: {e}")

# --- 3. LIVE VENUE STATUS ENDPOINT ---
@app.get("/api/venue-status")
def get_venue_status():
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
        
        halls_data.append({
            "id": hall['hallName'].replace(" ", "_").lower(), 
            "hallName": hall['hallName'],
            "capacity": int(hall['hallCapacity']),
            "currentOccupancy": int(current_people),
            "occupancyRatio": float(occ_ratio),
            "co2": float(live_co2),
            "predictedOccupancyNextHour": int(pred_occ),
            "aiRecommendedAction": rec_action,
            "isAnomaly": str(rec_action).lower() != 'none'
        })
    return {"status": "success", "data": halls_data}

# --- 4. THE "ACTUAL SIMULATION" ENGINE ---
class SimulationRequest(BaseModel):
    hall_id: str
    occupancy: int
    co2: int

ADJACENCY_MAP = {
    "hall1": ["hall2", "northhall4", "southhall1", "easthall1"],
    "hall2": ["hall1", "hall3"],
    "hall3": ["hall2", "hall4"],
    "northhall1": ["northhall2"],
    "northhall2": ["northhall1", "northhall3"],
    "northhall3": ["northhall2", "northhall4"], 
    "northhall4": ["northhall3", "northhall5", "hall1"],
    "northhall5": ["northhall4", "northhall6"],
    "northhall6": ["northhall5"],
    "southhall1": ["southhall2", "hall1"],
    "southhall2": ["southhall1", "southhall3"],
    "southhall3": ["southhall2", "southhall4"],
    "easthall1": ["easthall2", "hall1"],
    "easthall2": ["easthall1", "easthall3"],
    "easthall3": ["easthall2", "easthall4"]
}

def run_ai_pipeline(occ_percent, co2_level):
    occ_ratio = occ_percent / 100.0
    congestion = 0.8 if occ_ratio >= 0.8 else 0.5 
    safety_input = [[occ_ratio, co2_level, congestion]]
    
    try:
        action_code = safety.predict(safety_input)[0]
        rec_action = le_action.inverse_transform([action_code])[0]
        is_anomaly = str(rec_action).lower() != 'none'
    except Exception as e:
        rec_action = "pipeline_error"
        is_anomaly = False
        
    return occ_ratio, rec_action, is_anomaly

@app.post("/api/simulate-prediction")
def simulate_prediction(data: SimulationRequest):
    print(f"\n🌊 CROWD SURGE INJECTED AT: {data.hall_id} | Occ: {data.occupancy}%")
    updates = []
    
    # Process Ground Zero
    occ_ratio, ai_action, is_anomaly = run_ai_pipeline(data.occupancy, data.co2)
    updates.append({
        "hall_id": data.hall_id,
        "occupancyRatio": occ_ratio,
        "co2": data.co2,
        "aiAction": ai_action,
        "isAnomaly": is_anomaly
    })

    # TRIGGER AUTOMATIC RETRAINING IF ANOMALY DETECTED
    if is_anomaly:
        auto_retrain_pipeline()

    # Calculate Crowd Spillover
    if data.occupancy > 75:
        neighbors = ADJACENCY_MAP.get(data.hall_id, [])
        for neighbor in neighbors:
            spill_occ = int(data.occupancy * random.uniform(0.30, 0.55))
            spill_co2 = int(400 + (spill_occ * 6) + random.randint(-20, 50))
            
            n_occ_ratio, n_ai_action, n_is_anomaly = run_ai_pipeline(spill_occ, spill_co2)
            updates.append({
                "hall_id": neighbor,
                "occupancyRatio": n_occ_ratio,
                "co2": spill_co2,
                "aiAction": n_ai_action,
                "isAnomaly": n_is_anomaly
            })

    return {
        "status": "success",
        "updates": updates
    }