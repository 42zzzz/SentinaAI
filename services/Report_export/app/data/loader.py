from __future__ import annotations

from typing import Any, Iterable, Optional

import pandas as pd

DATA_PATH = "app/data/sample/sentina_sust_full_15min_with_events_mapped (1).csv"


def _normalize_timestamp(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if "timestamp" in out.columns:
        out["timestamp"] = pd.to_datetime(out["timestamp"], errors="coerce", utc=True)
    elif "time" in out.columns:
        out["timestamp"] = pd.to_datetime(out["time"], errors="coerce", utc=True)
    elif "datetime" in out.columns:
        out["timestamp"] = pd.to_datetime(out["datetime"], errors="coerce", utc=True)
    else:
        raise ValueError("Dataset must contain a timestamp/time/datetime column.")
    return out


def load_sentina_df(preloaded_rows: Optional[Iterable[dict[str, Any]]] = None) -> pd.DataFrame:
    if preloaded_rows is not None:
        df = pd.DataFrame(list(preloaded_rows))
        if df.empty:
            return pd.DataFrame(columns=["timestamp"])
        return _normalize_timestamp(df)

    df = pd.read_csv(DATA_PATH)
    return _normalize_timestamp(df)
