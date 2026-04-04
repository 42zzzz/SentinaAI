from datetime import date
from typing import List, Optional, Literal

from pydantic import BaseModel, Field


# =========================================================
# TYPES
# =========================================================

ModuleName = Literal["sustainability", "operations", "exhibitors", "soc"]
ExportFormat = Literal["pdf", "xlsx"]


# =========================================================
# MAIN FILTER SCHEMA
# =========================================================

class ReportFilters(BaseModel):
    module: ModuleName = "sustainability"

    report_title: str = Field(
        min_length=5,
        max_length=150,
    )

    date_from: date
    date_to: date

    zones: List[str] = Field(default_factory=list)
    facilities: List[str] = Field(default_factory=list)
    device_groups: List[str] = Field(default_factory=list)

    custom_notes: Optional[str] = None
    sections: List[str] = Field(default_factory=list)
    frequency: str = "Hourly"

    event_id: Optional[str] = None
    exhibitor_id: Optional[str] = None
    booth_ids: List[str] = Field(default_factory=list)


class ExportRequest(BaseModel):
    filters: ReportFilters
    format: ExportFormat

# =========================================================
# ReportActionRequest
# =========================================================

class ReportActionRequest(BaseModel):
    filters: ReportFilters
    format: ExportFormat
