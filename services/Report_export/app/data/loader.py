import pandas as pd

DATA_PATH = "app/data/sample/sentina_sust_full_15min_with_events_mapped (1).csv"

def load_sentina_df() -> pd.DataFrame:
    df = pd.read_csv(DATA_PATH)

    # Normalize timestamp into df["timestamp"]
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"])
    elif "time" in df.columns:
        df["timestamp"] = pd.to_datetime(df["time"])
    elif "datetime" in df.columns:
        df["timestamp"] = pd.to_datetime(df["datetime"])
    else:
        raise ValueError("Dataset must contain a timestamp/time/datetime column.")

    return df