export const REPORT_DOMAIN_CONFIG = {
  operations: {
    title: "Generate Report",
    themeClass: "opsTheme",
    accent: "#E8486F",
    listPath: "/operations/reports",
    sections: [
      { value: "hall_utilization", label: "Hall Utilization Ranking" },
      { value: "event_impact", label: "Event Impact Analysis" },
      { value: "peak_congestion", label: "Peak Congestion Windows" },
      { value: "stress_index", label: "Operational Stress Index" },
    ],
    defaultSections: ["hall_utilization", "event_impact", "peak_congestion", "stress_index"],
    frequencyOptions: ["Hourly", "Daily", "Weekly", "Monthly"],
    requiresExhibitorScope: false,
  },
  sustainability: {
    title: "Generate Report",
    themeClass: "sustTheme",
    accent: "#00802B",
    listPath: "/sustainability/reports",
    sections: [
      { value: "energy", label: "Energy Consumption" },
      { value: "environment", label: "Environmental Conditions" },
      { value: "occupancy", label: "Occupancy Overview" },
    ],
    defaultSections: ["energy", "environment", "occupancy"],
    frequencyOptions: ["Hourly", "Daily", "Weekly", "Monthly"],
    requiresExhibitorScope: false,
  },
  exhibitors: {
    title: "Generate Report",
    themeClass: "exhTheme",
    accent: "#35005C",
    listPath: "/exhibitor/reports",
    sections: [
      { value: "booth_profile", label: "Exhibitor Profile" },
      { value: "traffic_overview", label: "Booth Traffic Overview" },
      { value: "engagement_analysis", label: "Visitor Engagement Analysis" },
      { value: "time_analysis", label: "Operating Environment Analysis" },
      { value: "performance_breakdown", label: "Performance Breakdown" },
    ],
    defaultSections: ["booth_profile", "traffic_overview", "engagement_analysis", "time_analysis", "performance_breakdown"],
    frequencyOptions: ["Hourly", "Daily", "Weekly", "Monthly"],
    requiresExhibitorScope: true,
  },
};

export function getDomainFromPath(pathname = "") {
  if (pathname.startsWith("/sustainability")) return "sustainability";
  if (pathname.startsWith("/operations")) return "operations";
  if (pathname.startsWith("/exhibitor")) return "exhibitors";
  return "operations";
}

export function formatReportStatus(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "GENERATED") return "Generated";
  if (normalized === "DRAFT") return "Draft";
  return normalized || "Unknown";
}
