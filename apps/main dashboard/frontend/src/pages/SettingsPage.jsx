import { useEffect, useMemo, useState } from "react";
import "./SettingsPage.css";

const SETTINGS_KEYS = {
  operations: "sentina.settings.operations",
  sustainability: "sentina.settings.sustainability",
  exhibitor: "sentina.settings.exhibitor",
};

const SECTION_META = {
  operations: {
    themeClass: "settingsOps",
    accentLabel: "Operations",
    title: "Dashboard Settings",
    subtitle:
      "Control how live venue operations and reporting preferences are shown for day-to-day monitoring.",
    roleLabel: "Operations Manager",
    landingOptions: [
      { value: "dashboard", label: "Dashboard" },
      { value: "alerts", label: "Alerts" },
      { value: "devices", label: "Devices" },
      { value: "events", label: "Events" },
      { value: "navigation", label: "Navigation" },
    ],
    dateRangeOptions: [
      { value: "live", label: "Live Today" },
      { value: "24h", label: "Last 24 hours" },
      { value: "7d", label: "Last 7 days" },
    ],
  },
  sustainability: {
    themeClass: "settingsSust",
    accentLabel: "Sustainability",
    title: "Dashboard Settings",
    subtitle:
      "Tailor the sustainability view around energy, comfort, emissions, and reporting preferences.",
    roleLabel: "Sustainability Manager",
    landingOptions: [
      { value: "dashboard", label: "Dashboard" },
      { value: "energy", label: "Energy" },
      { value: "environment", label: "Environmental" },
      { value: "alerts", label: "Alerts" },
      { value: "reports", label: "Reports" },
    ],
    dateRangeOptions: [
      { value: "today", label: "Today" },
      { value: "7d", label: "Last 7 days" },
      { value: "30d", label: "Last 30 days" },
    ],
  },
  exhibitor: {
    themeClass: "settingsExhibitor",
    accentLabel: "Exhibitor",
    title: "Portal Settings",
    subtitle:
      "Set how booth analytics, heatmaps, exports, and account information appear in the exhibitor portal.",
    roleLabel: "Exhibitor",
    landingOptions: [
      { value: "dashboard", label: "Dashboard" },
      { value: "heatmap", label: "Heat Map" },
      { value: "analytics", label: "Analytics" },
      { value: "reports", label: "Reports" },
      { value: "navigation", label: "Navigation" },
    ],
    dateRangeOptions: [
      { value: "event", label: "Current event" },
      { value: "24h", label: "Last 24 hours" },
      { value: "7d", label: "Last 7 days" },
    ],
  },
};

function getDefaults(section) {
  if (section === "sustainability") {
    return {
      landingPage: "dashboard",
      autoRefresh: true,
      refreshInterval: "30",
      defaultDateRange: "7d",
      exportFormat: "xlsx",
    };
  }

  if (section === "exhibitor") {
    return {
      landingPage: "dashboard",
      autoRefresh: true,
      refreshInterval: "60",
      defaultDateRange: "event",
      exportFormat: "xlsx",
    };
  }

  return {
    landingPage: "dashboard",
    autoRefresh: true,
    refreshInterval: "15",
    defaultDateRange: "live",
    exportFormat: "xlsx",
  };
}

function getStoredSettings(section) {
  const defaults = getDefaults(section);
  try {
    const raw = localStorage.getItem(SETTINGS_KEYS[section]);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function Toggle({ checked, onChange, id }) {
  return (
    <button
      id={id}
      type="button"
      className={`settingsToggle${checked ? " isOn" : ""}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="settingsToggleKnob" />
    </button>
  );
}

function SectionCard({ title, description, children, aside }) {
  return (
    <section className="settingsCard">
      <div className="settingsCardHead">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {aside ? <div className="settingsCardAside">{aside}</div> : null}
      </div>
      <div className="settingsCardBody">{children}</div>
    </section>
  );
}

function SelectField({ label, value, options, onChange, hint }) {
  return (
    <label className="settingsField">
      <span className="settingsLabel">{label}</span>
      <select className="settingsSelect" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span className="settingsHint">{hint}</span> : null}
    </label>
  );
}

function ReadonlyField({ label, value, hint }) {
  return (
    <div className="settingsField">
      <span className="settingsLabel">{label}</span>
      <div className="settingsReadonly">{value}</div>
      {hint ? <span className="settingsHint">{hint}</span> : null}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="settingsToggleRow">
      <div>
        <label htmlFor={id} className="settingsToggleLabel">
          {label}
        </label>
        {description ? <p className="settingsToggleDescription">{description}</p> : null}
      </div>
      <Toggle id={id} checked={checked} onChange={onChange} />
    </div>
  );
}

function formatRole(role) {
  if (!role) return "User";
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function prettyLanding(labelMap, value) {
  return labelMap.find((item) => item.value === value)?.label || "—";
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M5 5L15 15" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M15 5L5 15" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function SettingsPage({ section = "operations", onClose }) {
  const resolvedSection = SECTION_META[section] ? section : "operations";
  const meta = useMemo(() => SECTION_META[resolvedSection], [resolvedSection]);

  const [settings, setSettings] = useState(() => getStoredSettings(resolvedSection));
  const [saveState, setSaveState] = useState("idle");

  useEffect(() => {
    setSettings(getStoredSettings(resolvedSection));
    setSaveState("idle");
  }, [resolvedSection]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const storedName =
    sessionStorage.getItem("full_name") ||
    localStorage.getItem("full_name") ||
    sessionStorage.getItem("name") ||
    localStorage.getItem("name") ||
    "User";

  const storedRole =
    sessionStorage.getItem("role") ||
    localStorage.getItem("role") ||
    meta.roleLabel;

  const lastLogin =
    sessionStorage.getItem("last_login") ||
    localStorage.getItem("last_login") ||
    "Active now";

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaveState("dirty");
  };

  const handleSave = () => {
    try {
      localStorage.setItem(SETTINGS_KEYS[resolvedSection], JSON.stringify(settings));
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      setSaveState("error");
    }
  };

  const handleReset = () => {
    const defaults = getDefaults(resolvedSection);
    setSettings(defaults);
    try {
      localStorage.setItem(SETTINGS_KEYS[resolvedSection], JSON.stringify(defaults));
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      setSaveState("error");
    }
  };

  const refreshSummary = settings.autoRefresh
    ? `Live panels refresh every ${settings.refreshInterval} seconds`
    : "Live auto-refresh is paused";

  const landingLabel = prettyLanding(meta.landingOptions, settings.landingPage);
  const dateRangeLabel = prettyLanding(meta.dateRangeOptions, settings.defaultDateRange);

  return (
    <div
      className="settingsModalOverlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className={`settingsModal ${meta.themeClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="settingsModalTopBar">
          <div className="settingsModalKicker">SentinaAI preferences</div>
          <button
            type="button"
            className="settingsModalClose"
            onClick={() => onClose?.()}
            aria-label="Close settings"
            >
            <span className="settingsModalCloseGlyph">×</span>
            </button>
        </div>

        <div className={`settingsPage ${meta.themeClass}`}>
          <div className="settingsHero settingsHero--modal">
            <div>
              <div className="settingsEyebrow">{meta.accentLabel} preferences</div>
              <h1 id="settings-modal-title">{meta.title}</h1>
              <p>{meta.subtitle}</p>
            </div>

            <div className="settingsHeroActions">
              <button type="button" className="settingsGhostButton" onClick={handleReset}>
                Reset defaults
              </button>
              <button type="button" className="settingsPrimaryButton" onClick={handleSave}>
                Save preferences
              </button>
            </div>
          </div>

          <div className="settingsStatusBar">
            <span className="settingsStatusPill">Landing page: {landingLabel}</span>
            <span className="settingsStatusPill">Default range: {dateRangeLabel}</span>
            <span className="settingsStatusPill">
              Export: {String(settings.exportFormat).toUpperCase()}
            </span>
            <span className="settingsStatusPill">{refreshSummary}</span>
            <span className={`settingsSaveState settingsSaveState--${saveState}`}>
              {saveState === "saved"
                ? "Saved on this browser"
                : saveState === "dirty"
                ? "Unsaved changes"
                : saveState === "error"
                ? "Could not save"
                : "Preferences ready"}
            </span>
          </div>

          <div className="settingsGrid settingsGrid--top">
            <SectionCard
              title="Workspace"
              description="Choose the landing view and default date range for this dashboard."
            >
              <div className="settingsFieldsGrid">
                <SelectField
                  label="Default landing page"
                  value={settings.landingPage}
                  options={meta.landingOptions}
                  onChange={(value) => updateSetting("landingPage", value)}
                />
                <SelectField
                  label="Default date range"
                  value={settings.defaultDateRange}
                  options={meta.dateRangeOptions}
                  onChange={(value) => updateSetting("defaultDateRange", value)}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Account & session"
              description="Reference-only account details for the current session."
            >
              <div className="settingsFieldsGrid">
                <ReadonlyField label="Signed in as" value={storedName} />
                <ReadonlyField label="Role" value={formatRole(storedRole)} />
                <ReadonlyField label="Last activity" value={lastLogin} />
                <ReadonlyField
                  label="Session timeout"
                  value="20 minutes of inactivity"
                  hint="After timeout, re-authentication is required."
                />
              </div>
            </SectionCard>
          </div>

          <div className="settingsGrid">
            <SectionCard
              title="Live updates & notifications"
              description="Control the refresh cadence for live dashboard data."
            >
              <div className="settingsFieldsGrid settingsFieldsGrid--tight">
                <SelectField
                  label="Live refresh cadence"
                  value={settings.refreshInterval}
                  options={[
                    { value: "5", label: "Every 5 seconds" },
                    { value: "15", label: "Every 15 seconds" },
                    { value: "30", label: "Every 30 seconds" },
                    { value: "60", label: "Every 60 seconds" },
                  ]}
                  onChange={(value) => updateSetting("refreshInterval", value)}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Reports & exports"
              description="This can be wired easily later into the report pipeline, so it is fine to keep."
            >
              <div className="settingsFieldsGrid settingsFieldsGrid--tight">
                <SelectField
                  label="Default export format"
                  value={settings.exportFormat}
                  options={[
                    { value: "xlsx", label: "XLSX workbook" },
                    { value: "pdf", label: "PDF summary" },
                  ]}
                  onChange={(value) => updateSetting("exportFormat", value)}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Security preferences"
              description="Reference-only security information for this session."
              aside={<span className="settingsCardBadge">Role based</span>}
            >
              <div className="settingsSecuritySummary">
                <div>
                  <span className="settingsMiniLabel">Authentication</span>
                  <strong>Secure dashboard session</strong>
                </div>
                <div>
                  <span className="settingsMiniLabel">Browser storage</span>
                  <strong>Preferences stored locally</strong>
                </div>
                <div>
                  <span className="settingsMiniLabel">Access model</span>
                  <strong>{formatRole(storedRole)}</strong>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}