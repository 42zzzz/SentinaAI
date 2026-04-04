import pandas as pd

def apply_date_zone_facility_filters(df: pd.DataFrame, filters) -> pd.DataFrame:
    out = df.copy()

    start = pd.to_datetime(getattr(filters, "date_from"))
    end = pd.to_datetime(getattr(filters, "date_to")) + pd.Timedelta(days=1)
    out = out[(out["timestamp"] >= start) & (out["timestamp"] < end)]

    zones = getattr(filters, "zones", None) or []
    facilities = getattr(filters, "facilities", None) or []

    if isinstance(zones, str):
        zones = [zones]
    if isinstance(facilities, str):
        facilities = [facilities]

    if zones and "zoneId" in out.columns:
        out = out[out["zoneId"].isin(zones)]

    if facilities and "hallName" in out.columns:
        out = out[out["hallName"].isin(facilities)]

    return out

def apply_bucketing(df: pd.DataFrame, filters) -> pd.DataFrame:
    out = df.copy()
    freq = (getattr(filters, "frequency", "Hourly") or "Hourly").lower()

    if freq == "daily":
        out["bucket"] = out["timestamp"].dt.date.astype(str)
    elif freq == "weekly":
        out["bucket"] = out["timestamp"].dt.to_period("W").astype(str)
    elif freq == "monthly":
        out["bucket"] = out["timestamp"].dt.to_period("M").astype(str)
    else:
        out["bucket"] = out["timestamp"].dt.floor("h").astype(str)

    return out