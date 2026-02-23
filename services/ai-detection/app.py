from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import random
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import warnings

warnings.filterwarnings('ignore')

# Initialize the API
app = FastAPI(title="SentinaAI Backend API")

# Allow your React app to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. GLOBALLY LOAD & TRAIN MODELS ---
print("Loading data and training SentinaAI models...")
# Loading directly from the same folder!
ops_df = pd.read_csv('Operations and Sustainability Dataset v1.csv')
venue_df = ops_df[['hallName', 'venueRole', 'hallCapacity']].drop_duplicates().reset_index(drop=True)

ops_df['co2'] = 400 + (ops_df['occupancyRatio'] * 600) + np.random.randint(-50, 50, size=len(ops_df))
le_venue = LabelEncoder()
ops_df['venueRole_encoded'] = le_venue.fit_transform(ops_df['venueRole'])
le_action = LabelEncoder()
ops_df['action_encoded'] = le_action.fit_transform(ops_df['recommendedAction'])
day_map = {'Monday':0, 'Tuesday':1, 'Wednesday':2, 'Thursday':3, 'Friday':4, 'Saturday':5, 'Sunday':6}
ops_df['day_code'] = ops_df['dayOfWeek'].map(day_map)

# Train Forecaster
X_f = ops_df[['hourOfDay', 'day_code', 'venueRole_encoded']]
y_f = ops_df['currentOccupancy']
forecaster = RandomForestRegressor(n_estimators=50)
forecaster.fit(X_f, y_f)

# Train Safety Sentinel
X_s = ops_df[['occupancyRatio', 'co2', 'flowCongestionIndex']]
y_s = ops_df['action_encoded']
safety = RandomForestClassifier(n_estimators=50)
safety.fit(X_s, y_s)
print("Models trained successfully! API is ready.")

# --- 2. THE API ENDPOINT ---
@app.get("/api/venue-status")
def get_venue_status():
    halls_data = []
    
    for _, hall in venue_df.iterrows():
        occ_factor = random.uniform(0.1, 1.05)
        current_people = int(hall['hallCapacity'] * occ_factor)
        live_co2 = 400 + (occ_factor * 600) + random.randint(-20, 50)
        
        occ_ratio = current_people / hall['hallCapacity']
        
        role_code = le_venue.transform([hall['venueRole']])[0]
        pred_occ = forecaster.predict([[15, 4, role_code]])[0]
        
        safety_input = [[occ_ratio, live_co2, 0.5]]
        action_code = safety.predict(safety_input)[0]
        rec_action = le_action.inverse_transform([action_code])[0]
        
        halls_data.append({
            "id": hall['hallName'].replace(" ", "_").lower(), # Good for React keys
            "hallName": hall['hallName'],
            "capacity": int(hall['hallCapacity']),
            "currentOccupancy": int(current_people),
            "occupancyRatio": float(occ_ratio),
            "co2": float(live_co2),
            "predictedOccupancyNextHour": int(pred_occ),
            "aiRecommendedAction": rec_action,
            "isAnomaly": rec_action != 'none'
        })
        
    return {"status": "success", "data": halls_data}