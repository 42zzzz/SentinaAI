import pandas as pd
from typing import Dict


EVENTS_PATH = "app/data/sample/events.csv"
EXHIBITORS_PATH = "app/data/sample/exhibitors.csv"
ASSIGNMENTS_PATH = "app/data/sample/event_exhibitor_booth_assignments.csv"
METRICS_PATH = "app/data/sample/syn_zone_metrics_15mins.csv"


def _rename_if_exists(df: pd.DataFrame, rename_map: Dict[str, str]) -> pd.DataFrame:
    applicable = {old: new for old, new in rename_map.items() if old in df.columns}
    return df.rename(columns=applicable)


def _normalize_events(events: pd.DataFrame) -> pd.DataFrame:
    events = _rename_if_exists(
        events,
        {
            "eventId": "event_id",
            "eventName": "event_name",
            "venueId": "venue_id",
            "venueName": "venue_name",
            "startDateTimeUtc": "start_datetime_utc",
            "endDateTimeUtc": "end_datetime_utc",
            "expectedAttendanceTotal": "expected_attendance_total",
            "expectedExhibitors": "expected_exhibitors",
            "personInChargeName": "person_in_charge_name",
            "personInChargeEmail": "person_in_charge_email",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        },
    )

    for col in ["start_datetime_utc", "end_datetime_utc", "created_at", "updated_at"]:
        if col in events.columns:
            events[col] = pd.to_datetime(events[col], errors="coerce")

    return events


def _normalize_exhibitors(exhibitors: pd.DataFrame) -> pd.DataFrame:
    exhibitors = _rename_if_exists(
        exhibitors,
        {
            "exhibitorId": "exhibitor_id",
            "exhibitorName": "exhibitor_name",
            "hqCountry": "hq_country",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        },
    )

    for col in ["created_at", "updated_at"]:
        if col in exhibitors.columns:
            exhibitors[col] = pd.to_datetime(exhibitors[col], errors="coerce")

    return exhibitors


def _normalize_assignments(assignments: pd.DataFrame) -> pd.DataFrame:
    assignments = _rename_if_exists(
        assignments,
        {
            "eventId": "event_id",
            "exhibitorId": "exhibitor_id",
            "boothId": "booth_id",
            "boothCode": "booth_code",
            "zoneId": "zone_id",
            "hallId": "hall_id",
            "hallName": "hall_name",
            "boothSizeType": "booth_size_type",
            "boothAreaSqm": "booth_area_sqm",
            "packageTier": "package_tier",
            "discountPct": "discount_pct",
            "amountPaidAed": "amount_paid_aed",
            "assignedAt": "assigned_at",
        },
    )

    if "assigned_at" in assignments.columns:
        assignments["assigned_at"] = pd.to_datetime(assignments["assigned_at"], errors="coerce")

    return assignments


def _normalize_metrics(metrics: pd.DataFrame) -> pd.DataFrame:
    metrics = _rename_if_exists(
        metrics,
        {
            "ts": "bucket_ts",
            "eventId": "event_id",
            "zoneId": "zone_id",
            "hallId": "hall_id",
            "hallName": "hall_name",
            "isEvent": "is_event",
            "hallCapacity": "hall_capacity",
            "currentOccupancy": "current_occupancy",
            "isOvercrowded": "is_overcrowded",
            "occupancyRatio": "occupancy_ratio",
            "crowdDensityClass": "crowd_density_class",
            "inflowCount": "inflow_count",
            "outflowCount": "outflow_count",
            "flowCongestionIndex": "flow_congestion_index",
            "isQueue": "is_queue",
            "queueLengthClass": "queue_length_class",
            "recommendedAction": "recommended_action",
            "hourOfDay": "hour_of_day",
            "dayOfYear": "day_of_year",
            "outdoorTempC": "outdoor_temp_c",
            "humidityPct": "humidity_pct",
            "indoorTempC": "indoor_temp_c",
            "tempComfortScore": "temp_comfort_score",
            "humidityComfortScore": "humidity_comfort_score",
            "crowdComfortPenalty": "crowd_comfort_penalty",
            "comfortIndex": "comfort_index",
            "comfortStatus": "comfort_status",
            "hvacEnergyKwh": "hvac_energy_kwh",
            "carbonKgCo2": "carbon_kg_co2",
            "energyEfficiencyScore": "energy_efficiency_score",
            "sustainabilityStatus": "sustainability_status",
            "venueRole": "venue_role",
            "xCoord": "x_coord",
            "yCoord": "y_coord",
            "engagementTruth": "engagement_truth",
            "densityScore": "density_score",
        },
    )

    if "bucket_ts" not in metrics.columns:
        raise ValueError("syn_zone_metrics_15mins.csv must contain 'bucket_ts' or 'ts'.")

    metrics["bucket_ts"] = pd.to_datetime(metrics["bucket_ts"], errors="coerce")

    return metrics


def load_exhibitor_tables() -> Dict[str, pd.DataFrame]:
    events = pd.read_csv(EVENTS_PATH)
    exhibitors = pd.read_csv(EXHIBITORS_PATH)
    assignments = pd.read_csv(ASSIGNMENTS_PATH)
    metrics = pd.read_csv(METRICS_PATH)

    events = _normalize_events(events)
    exhibitors = _normalize_exhibitors(exhibitors)
    assignments = _normalize_assignments(assignments)
    metrics = _normalize_metrics(metrics)

    return {
        "events": events,
        "exhibitors": exhibitors,
        "assignments": assignments,
        "metrics": metrics,
    }