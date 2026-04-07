import { useNavigate } from "react-router-dom";

export default function SOCAnalyticsPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #dbeafe",
        borderRadius: 18,
        padding: 24,
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div style={{ color: "#2563eb", fontSize: 24, fontWeight: 900, marginBottom: 8 }}>
        SOC Analytics
      </div>
      <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
        This screen is intentionally left empty for now because the analytics dataset is not ready yet.
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => navigate("/soc")}
          style={{
            border: "none",
            background: "#2563eb",
            color: "#fff",
            borderRadius: 10,
            padding: "10px 14px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Back to Dashboard
        </button>

        <button
          type="button"
          onClick={() => navigate("/soc/alerts")}
          style={{
            border: "1px solid #dbeafe",
            background: "#fff",
            color: "#111827",
            borderRadius: 10,
            padding: "10px 14px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Open Alerts
        </button>
      </div>
    </div>
  );
}
