import React, { useMemo } from "react";

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

export default function ComfortGauge({
  title = "Comfort Index",
  value,
  subtitle,

  // ✅ NEW: parent can provide the outer card/header
  embedded = false,
  accent
}) {
  const ACCENT = accent || "var(--sust-accent, #E8486F)";

  const v = Number(value);
  const has = Number.isFinite(v);

  const pct = useMemo(() => (has ? clamp01(v / 100) : 0), [has, v]);
  const pctLabel = has ? `${v.toFixed(2)}` : "—";

  // thresholds
  const label = !has ? "" : v >= 75 ? "Excellent" : v >= 55 ? "Good" : v >= 40 ? "Moderate" : "Poor";

  // label colors
  const labelColor = useMemo(() => {
    if (!has) return "#6b7280";
    if (v >= 75) return "#166534"; // dark green
    if (v >= 55) return "#22c55e"; // light green
    if (v >= 40) return "#f59e0b"; // yellow
    return "#ef4444";             // red
  }, [has, v]);

  const body = (
    <div style={{ marginTop: 50, paddingTop: 6, display: "grid", placeItems: "center" }}>
      <div style={{ width: 260, height: 140, position: "relative" }}>
        <svg width="260" height="140" viewBox="0 0 260 140">
          {/* background arc */}
          <path
            d="M 20 130 A 110 110 0 0 1 240 130"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="18"
            strokeLinecap="round"
          />
          {/* value arc (pink) */}
          <path
            d="M 20 130 A 110 110 0 0 1 240 130"
            fill="none"
            stroke={ACCENT}
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={`${pct * 345} 345`}
          />
        </svg>

        <div style={{ position: "absolute", left: 0, right: 0, top: 60, textAlign: "center" }}>
          <div style={{ fontSize: 44, fontWeight: 950, lineHeight: 1 }}>{pctLabel}</div>
          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 900, color: labelColor }}>
            {label}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          width: 260,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          opacity: 0.7,
        }}
      >
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  );

  // ✅ Embedded mode: only render gauge body
  if (embedded) return body;

  // default mode (keeps backward compatibility)
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "white", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontWeight: 950, fontSize: 18 }}>{title}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{subtitle || ""}</div>
      </div>
      {body}
    </div>
  );
}