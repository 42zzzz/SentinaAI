import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./SettingsPage.css";
import {
  getDefaultDashboardSettings,
  readDashboardSettings,
  writeDashboardSettings,
} from "../utils/dashboardSettings";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const SECTION_META = {
  operations: {
    themeClass: "settingsOps",
    accentLabel: "Operations",
    title: "Dashboard Settings",
    subtitle: "Control live refresh behaviour for the operations dashboard.",
    roleLabel: "Operations Manager",
  },
  sustainability: {
    themeClass: "settingsSust",
    accentLabel: "Sustainability",
    title: "Dashboard Settings",
    subtitle: "Control live refresh behaviour for the sustainability dashboard.",
    roleLabel: "Sustainability Manager",
  },
  exhibitor: {
    themeClass: "settingsExhibitor",
    accentLabel: "Exhibitor",
    title: "Portal Settings",
    subtitle: "Control live refresh behaviour for the exhibitor portal.",
    roleLabel: "Exhibitor",
  },
};

const getDefaults = (section) => getDefaultDashboardSettings(section);
const getStoredSettings = (section) => readDashboardSettings(section);

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
      <select
        className="settingsSelect"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
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

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  isVisible,
  onToggleVisibility,
}) {
  return (
    <label className="settingsField">
      <span className="settingsLabel">{label}</span>
      <div className="settingsPasswordInputWrap">
        <input
          type={isVisible ? "text" : "password"}
          className="settingsInput settingsInput--withAction"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="settingsPasswordToggle"
          onClick={onToggleVisibility}
          aria-label={isVisible ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={isVisible}
        >
          {isVisible ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
}

function formatRole(role) {
  if (!role) return "User";
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLastActivity(value) {
  if (!value) return "Active now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Active now";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function CloseIcon() {
  return <span className="settingsCloseGlyph" aria-hidden="true">×</span>;
}

export default function SettingsPage({ section = "operations", onClose }) {
  const resolvedSection = SECTION_META[section] ? section : "operations";
  const meta = useMemo(() => SECTION_META[resolvedSection], [resolvedSection]);

  const [settings, setSettings] = useState(() => getStoredSettings(resolvedSection));
  const [saveState, setSaveState] = useState("idle");
  const [accountState, setAccountState] = useState({
    status: "idle",
    email:
      sessionStorage.getItem("email") ||
      localStorage.getItem("email") ||
      sessionStorage.getItem("full_name") ||
      localStorage.getItem("full_name") ||
      "User",
    full_name:
      sessionStorage.getItem("full_name") ||
      localStorage.getItem("full_name") ||
      "User",
    role:
      sessionStorage.getItem("role") ||
      localStorage.getItem("role") ||
      meta.roleLabel,
    last_active_at:
      sessionStorage.getItem("last_login") || localStorage.getItem("last_login") || null,
  });
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordState, setPasswordState] = useState({
    status: "idle",
    message: "",
  });
  const [passwordVisibility, setPasswordVisibility] = useState({
    newPassword: false,
    confirmPassword: false,
  });

  useEffect(() => {
    setSettings(getStoredSettings(resolvedSection));
    setSaveState("idle");
  }, [resolvedSection]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (passwordModalOpen) {
          setPasswordModalOpen(false);
          setPasswordState({ status: "idle", message: "" });
          return;
        }
        onClose?.();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, passwordModalOpen]);

  useEffect(() => {
    let isMounted = true;

    async function loadAccount() {
      setAccountState((current) => ({ ...current, status: "loading" }));

      try {
        const { data } = await axios.get(`${API_BASE}/auth/me`);
        if (!isMounted) return;

        if (data?.email) sessionStorage.setItem("email", data.email);
        if (data?.full_name) sessionStorage.setItem("full_name", data.full_name);
        if (data?.role) sessionStorage.setItem("role", data.role);
        if (data?.last_active_at) sessionStorage.setItem("last_login", data.last_active_at);

        setAccountState({
          status: "ready",
          email: data?.email || "User",
          full_name: data?.full_name || "User",
          role: data?.role || meta.roleLabel,
          last_active_at: data?.last_active_at || null,
        });
      } catch {
        if (!isMounted) return;
        setAccountState((current) => ({
          ...current,
          status: "error",
        }));
      }
    }

    loadAccount();

    return () => {
      isMounted = false;
    };
  }, [meta.roleLabel, passwordModalOpen]);

  const updateSetting = (key, value) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
    setSaveState("dirty");
  };

  const handleSave = () => {
    try {
      writeDashboardSettings(resolvedSection, settings);
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
      writeDashboardSettings(resolvedSection, defaults);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      setSaveState("error");
    }
  };

  const handlePasswordFieldChange = (key, value) => {
    setPasswordForm((current) => ({
      ...current,
      [key]: value,
    }));

    if (passwordState.status !== "idle") {
      setPasswordState({ status: "idle", message: "" });
    }
  };

  const togglePasswordVisibility = (key) => {
    setPasswordVisibility((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const openPasswordModal = () => {
    setPasswordForm({ newPassword: "", confirmPassword: "" });
    setPasswordVisibility({ newPassword: false, confirmPassword: false });
    setPasswordState({ status: "idle", message: "" });
    setPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    if (passwordState.status === "submitting") return;
    setPasswordModalOpen(false);
    setPasswordVisibility({ newPassword: false, confirmPassword: false });
    setPasswordState({ status: "idle", message: "" });
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    const { newPassword, confirmPassword } = passwordForm;

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setPasswordState({
        status: "error",
        message: "Please complete both password fields.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordState({
        status: "error",
        message: "New password and confirm password must match.",
      });
      return;
    }

    setPasswordState({ status: "submitting", message: "Updating password..." });

    try {
      const { data } = await axios.post(`${API_BASE}/auth/change-password`, {
        newPassword,
        confirmPassword,
      });

      setPasswordState({
        status: "success",
        message: data?.message || "Password changed successfully.",
      });
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      setPasswordVisibility({ newPassword: false, confirmPassword: false });
      window.setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordState({ status: "idle", message: "" });
      }, 1200);
    } catch (error) {
      const message = error?.response?.data?.error;
      setPasswordState({
        status: "error",
        message: Array.isArray(message)
          ? message.join(" ")
          : message || "Could not update password. Please try again.",
      });
    }
  };

  const refreshSummary = `Live panels refresh every ${settings.refreshInterval} seconds`;
  const displayedEmail = accountState.email || "User";
  const displayedRole = accountState.role || meta.roleLabel;
  const displayedLastActivity = formatLastActivity(accountState.last_active_at);

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
            <CloseIcon />
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
              <button
                type="button"
                className="settingsGhostButton"
                onClick={handleReset}
              >
                Reset defaults
              </button>
              <button
                type="button"
                className="settingsPrimaryButton"
                onClick={handleSave}
              >
                Save preferences
              </button>
            </div>
          </div>

          <div className="settingsStatusBar">
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
              title="General"
              description="Control general dashboard preferences for this workspace."
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
                <SelectField
                  label="Preferred report export format"
                  value={settings.exportFormat || "xlsx"}
                  options={[
                    { value: "xlsx", label: "XLSX workbook" },
                    { value: "pdf", label: "PDF summary" },
                  ]}
                  onChange={(value) => updateSetting("exportFormat", value)}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Account & session"
              description="Cloud-linked account details for the current session."
            >
              <div className="settingsActionRow" style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  className="settingsGhostButton"
                  onClick={openPasswordModal}
                >
                  Change Password
                </button>
                {accountState.status === "loading" ? (
                  <span className="settingsInlineStatus">Loading account…</span>
                ) : null}
              </div>
              <div className="settingsFieldsGrid">
                <ReadonlyField label="Signed in as" value={displayedEmail} />
                <ReadonlyField label="Role" value={formatRole(displayedRole)} />
                <ReadonlyField label="Last activity" value={displayedLastActivity} />
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
                  <strong>{formatRole(displayedRole)}</strong>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      {passwordModalOpen ? (
        <div
          className="settingsSubModalOverlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePasswordModal();
          }}
        >
          <div className={`settingsSubModal ${meta.themeClass}`} role="dialog" aria-modal="true" aria-labelledby="change-password-title">
            <div className="settingsSubModalHeader">
              <div>
                <div className="settingsEyebrow">Account security</div>
                <h2 id="change-password-title">Change Password</h2>
                <p>Update your password for the current SentinaAI account.</p>
              </div>
              <button
                type="button"
                className="settingsModalClose"
                onClick={closePasswordModal}
                aria-label="Close change password dialog"
              >
                <CloseIcon />
              </button>
            </div>

            <form className="settingsSubModalBody" onSubmit={handlePasswordSubmit}>
              <div className="settingsFieldsGrid settingsFieldsGrid--tight">
                <PasswordField
                  label="New password"
                  value={passwordForm.newPassword}
                  onChange={(value) => handlePasswordFieldChange("newPassword", value)}
                  placeholder="Enter your new password"
                  autoComplete="new-password"
                  isVisible={passwordVisibility.newPassword}
                  onToggleVisibility={() => togglePasswordVisibility("newPassword")}
                />
                <PasswordField
                  label="Confirm password"
                  value={passwordForm.confirmPassword}
                  onChange={(value) => handlePasswordFieldChange("confirmPassword", value)}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  isVisible={passwordVisibility.confirmPassword}
                  onToggleVisibility={() => togglePasswordVisibility("confirmPassword")}
                />
              </div>

              <div className="settingsPasswordRules">
                <span className="settingsMiniLabel">Password requirements</span>
                <ul>
                  <li>At least 12 characters</li>
                  <li>Include uppercase, lowercase, number, and symbol</li>
                  <li>Must not include your name or email</li>
                </ul>
              </div>

              {passwordState.message ? (
                <div className={`settingsPasswordMessage settingsPasswordMessage--${passwordState.status}`}>
                  {passwordState.message}
                </div>
              ) : null}

              <div className="settingsSubModalActions">
                <button
                  type="button"
                  className="settingsGhostButton"
                  onClick={closePasswordModal}
                  disabled={passwordState.status === "submitting"}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="settingsPrimaryButton"
                  disabled={passwordState.status === "submitting"}
                >
                  {passwordState.status === "submitting" ? "Saving..." : "Update password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
