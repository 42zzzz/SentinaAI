import { useEffect, useMemo, useState } from "react";
import "./FloatingAssistant.css";

const DEFAULT_ASSISTANT_BASE = import.meta.env.VITE_ASSISTANT_BASE_URL || "http://localhost:8002";

const ROLE_CONFIG = {
  operations: {
    role: "OPERATIONS",
    accent: "#E8486F",
    accentSoft: "rgba(232,72,111,0.14)",
    accentShadow: "rgba(232,72,111,0.30)",
    panelShadow: "rgba(15,23,42,0.18)",
    label: "Senti Operations",
  },
  sustainability: {
    role: "SUSTAINABILITY",
    accent: "#00802B",
    accentSoft: "rgba(0,128,43,0.14)",
    accentShadow: "rgba(0,128,43,0.26)",
    panelShadow: "rgba(15,23,42,0.18)",
    label: "Senti Sustainability",
  },
  exhibitor: {
    role: "EXHIBITOR",
    accent: "#35005C",
    accentSoft: "rgba(53,0,92,0.14)",
    accentShadow: "rgba(53,0,92,0.28)",
    panelShadow: "rgba(15,23,42,0.18)",
    label: "Senti Exhibitor",
  },
};

function SparklesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5 13.82 8.18 18.5 10 13.82 11.82 12 16.5 10.18 11.82 5.5 10 10.18 8.18 12 3.5Z" fill="currentColor" />
      <path d="M18.5 15.5 19.35 17.65 21.5 18.5 19.35 19.35 18.5 21.5 17.65 19.35 15.5 18.5 17.65 17.65 18.5 15.5Z" fill="currentColor" opacity="0.9" />
      <path d="M5.5 15.5 6.2 17.3 8 18 6.2 18.7 5.5 20.5 4.8 18.7 3 18 4.8 17.3 5.5 15.5Z" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

export default function FloatingAssistant({ section, userId, userName }) {
  const config = ROLE_CONFIG[section] || ROLE_CONFIG.operations;
  const [isOpen, setIsOpen] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => {
    setIsOpen(false);
  }, [section, userId]);

  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      role: config.role,
      user_id: String(userId || config.role.toLowerCase()),
      user_name: String(userName || "User"),
      embed: "1",
    });
    return `${DEFAULT_ASSISTANT_BASE}/?${params.toString()}`;
  }, [config.role, userId, userName]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleRefresh = () => {
    setFrameKey((prev) => prev + 1);
  };

  return (
    <>
      {isOpen ? (
        <div
          className="floatingAssistantBackdrop"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div
        className={`floatingAssistantRoot${isOpen ? " isOpen" : ""}`}
        style={{
          "--assistant-accent": config.accent,
          "--assistant-accent-soft": config.accentSoft,
          "--assistant-accent-shadow": config.accentShadow,
          "--assistant-panel-shadow": config.panelShadow,
        }}
      >
        {isOpen ? (
          <section
            className="floatingAssistantPanel"
            aria-label={`${config.label} panel`}
          >
            <div className="floatingAssistantPanelActions">
              <button
                type="button"
                className="floatingAssistantMiniBtn"
                onClick={handleRefresh}
                aria-label="Refresh assistant"
                title="Refresh assistant"
              >
                ↻
              </button>
              <button
                type="button"
                className="floatingAssistantMiniBtn"
                onClick={() => setIsOpen(false)}
                aria-label="Close assistant"
                title="Close assistant"
              >
                ✕
              </button>
            </div>

            <iframe
              key={frameKey}
              title={config.label}
              src={iframeSrc}
              className="floatingAssistantFrame"
            />
          </section>
        ) : null}

        <button
          type="button"
          className="floatingAssistantLauncher"
          onClick={handleToggle}
          aria-label={isOpen ? `Close ${config.label}` : `Open ${config.label}`}
          title={config.label}
        >
          <span className="floatingAssistantLauncherPulse" />
          <span className="floatingAssistantLauncherIcon">
            <SparklesIcon />
          </span>
        </button>
      </div>
    </>
  );
}
