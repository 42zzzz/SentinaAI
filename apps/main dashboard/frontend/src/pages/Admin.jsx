import { Fragment, useEffect, useMemo, useState } from "react";
import AdminLayout from "../layouts/AdminLayout";

const rule = (valid) => ({
  color: valid ? "#16a34a" : "#94a3b8",
  fontWeight: valid ? 600 : 400,
});

const formatRole = (role = "") =>
  String(role)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatDate = (date) =>
  date ? new Date(date).toLocaleString() : "—";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function prettyLabel(value) {
  return String(value || "guided_action")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusPillStyle(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "SUCCESS") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }
  if (normalized === "ERROR" || normalized === "FAILED") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      border: "1px solid #fecaca",
    };
  }
  return {
    background: "#e2e8f0",
    color: "#334155",
    border: "1px solid #cbd5e1",
  };
}

function rolePillStyle(role) {
  const normalized = String(role || "").toUpperCase();

  if (normalized.includes("SUPER_ADMIN") || normalized.includes("SOC") || normalized.includes("SECURITY")) {
    return {
      background: "rgba(30, 58, 93, 0.10)",
      color: "#1e3a5d",
      border: "1px solid rgba(30, 58, 93, 0.22)",
    };
  }

  if (normalized.includes("OPERATIONS")) {
    return {
      background: "rgba(233, 69, 111, 0.10)",
      color: "#e9456f",
      border: "1px solid rgba(233, 69, 111, 0.22)",
    };
  }

  if (normalized.includes("SUSTAINABILITY")) {
    return {
      background: "rgba(23, 128, 50, 0.10)",
      color: "#178032",
      border: "1px solid rgba(23, 128, 50, 0.22)",
    };
  }

  if (normalized.includes("EXHIBITOR")) {
    return {
      background: "rgba(55, 0, 94, 0.10)",
      color: "#37005e",
      border: "1px solid rgba(55, 0, 94, 0.22)",
    };
  }

  return {
    background: "rgba(30, 58, 93, 0.08)",
    color: "#1e3a5d",
    border: "1px solid rgba(30, 58, 93, 0.16)",
  };
}

function userStatusPillStyle(status) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "ACTIVE") {
    return {
      background: "rgba(22, 163, 74, 0.10)",
      color: "#166534",
      border: "1px solid rgba(22, 163, 74, 0.18)",
    };
  }

  if (normalized === "INACTIVE") {
    return {
      background: "rgba(148, 163, 184, 0.14)",
      color: "#475569",
      border: "1px solid rgba(148, 163, 184, 0.22)",
    };
  }

  return {
    background: "rgba(245, 158, 11, 0.10)",
    color: "#b45309",
    border: "1px solid rgba(245, 158, 11, 0.18)",
  };
}

export default function Admin() {
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [assistantLogs, setAssistantLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState("");
  const [logsSearch, setLogsSearch] = useState("");
  const [logsRoleFilter, setLogsRoleFilter] = useState("ALL");
  const [logsStatusFilter, setLogsStatusFilter] = useState("ALL");
  const [openLogKeys, setOpenLogKeys] = useState({});

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role_id: "",
  });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    setErrors((prevErrors) => {
      const updatedErrors = { ...prevErrors };

      if (field === "full_name" && value.trim()) {
        delete updatedErrors.full_name;
      }

      if (field === "email") {
        if (value.trim() && emailRegex.test(value)) {
          delete updatedErrors.email;
        }
      }

      if (field === "password") {
        const tempPasswordRules = {
          length: value.length >= 12,
          upper: /[A-Z]/.test(value),
          lower: /[a-z]/.test(value),
          number: /\d/.test(value),
          special: /[^A-Za-z0-9]/.test(value),
        };

        const valid = Object.values(tempPasswordRules).every(Boolean);
        if (value && valid) {
          delete updatedErrors.password;
        }
      }

      if (field === "role_id" && value) {
        delete updatedErrors.role_id;
      }

      delete updatedErrors.api;

      return updatedErrors;
    });
  };

  const fetchUsers = async () => {
    try {
      if (!token) {
        setUsers([]);
        setErrors((prev) => ({
          ...prev,
          api: "No auth token found. Please log in again.",
        }));
        return;
      }

      const res = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Failed to fetch users:", data);
        setUsers([]);
        setErrors((prev) => ({
          ...prev,
          api: data?.error || "Failed to load users",
        }));
        return;
      }

      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setUsers([]);
      setErrors((prev) => ({
        ...prev,
        api: "Failed to load users",
      }));
    }
  };

  const fetchRoles = async () => {
    try {
      if (!token) {
        setRoles([]);
        setErrors((prev) => ({
          ...prev,
          api: "No auth token found. Please log in again.",
        }));
        return;
      }

      const res = await fetch(`${API_BASE}/users/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Failed to fetch roles:", data);
        setRoles([]);
        setErrors((prev) => ({
          ...prev,
          api: data?.error || "Failed to load roles",
        }));
        return;
      }

      setRoles(Array.isArray(data) ? data : []);

      if (Array.isArray(data) && data.length === 0) {
        setErrors((prev) => ({
          ...prev,
          api: "No assignable roles were returned by the backend.",
        }));
      }
    } catch (err) {
      console.error("Failed to fetch roles:", err);
      setRoles([]);
      setErrors((prev) => ({
        ...prev,
        api: "Failed to load roles",
      }));
    }
  };

  const fetchAssistantLogs = async () => {
    try {
      if (!token) {
        setAssistantLogs([]);
        setLogsError("No auth token found. Please log in again.");
        setLogsLoading(false);
        return;
      }

      setLogsLoading(true);
      const res = await fetch(`${API_BASE}/users/assistant-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setAssistantLogs([]);
        setLogsError(data?.error || "Failed to load assistant logs");
        return;
      }

      setAssistantLogs(Array.isArray(data?.rows) ? data.rows : []);
      setLogsError("");
    } catch (err) {
      console.error("Failed to fetch assistant logs:", err);
      setAssistantLogs([]);
      setLogsError("Failed to load assistant logs");
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchAssistantLogs();
    const logsTimer = setInterval(fetchAssistantLogs, 15000);
    return () => clearInterval(logsTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passwordRules = {
    length: form.password.length >= 12,
    upper: /[A-Z]/.test(form.password),
    lower: /[a-z]/.test(form.password),
    number: /\d/.test(form.password),
    special: /[^A-Za-z0-9]/.test(form.password),
  };

  const isPasswordValid = Object.values(passwordRules).every(Boolean);

  const logsRoleOptions = useMemo(() => {
    const values = Array.from(
      new Set(assistantLogs.map((row) => String(row.role || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    return ["ALL", ...values];
  }, [assistantLogs]);

  const logsStatusOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        assistantLogs
          .map((row) => String(row.response_status || "").trim().toUpperCase())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
    return ["ALL", ...values];
  }, [assistantLogs]);

  const filteredAssistantLogs = useMemo(() => {
    const q = logsSearch.trim().toLowerCase();

    return assistantLogs.filter((row) => {
      const roleOk = logsRoleFilter === "ALL" || String(row.role || "") === logsRoleFilter;
      const statusOk =
        logsStatusFilter === "ALL" ||
        String(row.response_status || "").toUpperCase() === logsStatusFilter;

      if (!roleOk || !statusOk) return false;

      if (!q) return true;

      const haystack = [
        row.display_user,
        row.user_name,
        row.user_id,
        row.role,
        row.raw_query,
        row.analysis_type,
        row.intent,
        row.summary,
        row.session_id,
        row.date_range,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [assistantLogs, logsRoleFilter, logsSearch, logsStatusFilter]);

  const toggleLogOpen = (logKey) => {
    setOpenLogKeys((prev) => ({
      ...prev,
      [logKey]: !prev[logKey],
    }));
  };

  const handleCreateUser = async () => {
    const newErrors = {};

    if (!form.full_name.trim()) {
      newErrors.full_name = "Full name is required";
    }

    if (!form.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(form.email)) {
      newErrors.email = "Enter a valid email address";
    }

    if (!form.password) {
      newErrors.password = "Password is required";
    } else if (!isPasswordValid) {
      newErrors.password = "Password does not meet requirements";
    }

    if (!form.role_id) {
      newErrors.role_id = "Please select a role";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        const apiMsg = Array.isArray(data.error)
          ? data.error.join(" | ")
          : data.error || "Failed to create user";

        setErrors({ api: apiMsg });
        return;
      }

      setShowAddModal(false);
      setForm({ full_name: "", email: "", password: "", role_id: "" });
      setShowPassword(false);
      setErrors({});
      fetchUsers();
    } catch (err) {
      console.error("Failed to create user:", err);
      setErrors({ api: "Failed to create user" });
    }
  };

  const handleUpdateUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/${selectedUser.user_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: selectedUser.full_name,
          email: selectedUser.email,
          role_id: selectedUser.role_id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors((prev) => ({
          ...prev,
          api: data?.error || "Failed to update user",
        }));
        return;
      }

      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      console.error("Failed to update user:", err);
      setErrors((prev) => ({
        ...prev,
        api: "Failed to update user",
      }));
    }
  };

  const handleDeleteUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/${selectedUser.user_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors((prev) => ({
          ...prev,
          api: data?.error || "Failed to delete user",
        }));
        return;
      }

      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      console.error("Failed to delete user:", err);
      setErrors((prev) => ({
        ...prev,
        api: "Failed to delete user",
      }));
    }
  };

  return (
    <AdminLayout>
      <div style={styles.headerRow}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
            User Management
          </h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
            Manage platform users, access roles, and account activity.
          </p>
        </div>
        <button style={styles.addBtn} onClick={() => setShowAddModal(true)}>
          + Add User
        </button>
      </div>

      {errors.api && !showAddModal && !showEditModal && (
        <div style={styles.errorBanner}>{errors.api}</div>
      )}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, minWidth: 220 }}>Name</th>
              <th style={{ ...styles.th, minWidth: 280 }}>Email</th>
              <th style={{ ...styles.th, minWidth: 200 }}>Role</th>
              <th style={{ ...styles.th, minWidth: 140 }}>Status</th>
              <th style={{ ...styles.th, minWidth: 190 }}>Created</th>
              <th style={{ ...styles.th, minWidth: 190 }}>Last Active</th>
              <th style={{ ...styles.th, minWidth: 120, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user, index) => (
              <tr
                key={user.user_id}
                style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}
              >
                <td style={styles.td}>
                  <div style={styles.primaryText}>{user.full_name}</div>
                  <div style={styles.userMetaText}>{user.employee_id || "—"}</div>
                </td>

                <td style={styles.td}>
                  <div style={styles.secondaryTextStrong}>{user.email}</div>
                </td>

                <td style={styles.td}>
                  <span style={{ ...styles.softPill, ...rolePillStyle(user.role_name) }}>
                    {formatRole(user.role_name)}
                  </span>
                </td>

                <td style={styles.td}>
                  <span style={{ ...styles.softPill, ...userStatusPillStyle(user.status) }}>
                    {user.status}
                  </span>
                </td>

                <td style={{ ...styles.td, ...styles.cellDate }}>
                  {formatDate(user.created_at)}
                </td>

                <td style={{ ...styles.td, ...styles.cellDate }}>
                  {formatDate(user.last_active_at)}
                </td>

                <td style={{ ...styles.td, ...styles.actionsCell }}>
                  {user.role_name !== "super_admin" && (
                    <button
                      style={styles.editBtn}
                      onClick={() => {
                        setSelectedUser(user);
                        setShowEditModal(true);
                        setErrors({});
                      }}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section style={styles.logsSection}>
        <div style={styles.logsHeaderRow}>
          <div>
            <h2 style={styles.logsTitle}>Rule-Based Assistant Chat Logs</h2>
            <p style={styles.logsSubtitle}>
              All assistant interactions across operations, sustainability, SOC, and exhibitor users.
            </p>
          </div>
          <div style={styles.logsCountBadge}>{assistantLogs.length} total</div>
        </div>

        <div style={styles.logsFiltersRow}>
          <input
            style={styles.logsSearchInput}
            placeholder="Search by user, query, summary, role, or session"
            value={logsSearch}
            onChange={(e) => setLogsSearch(e.target.value)}
          />

          <select
            style={styles.logsSelect}
            value={logsRoleFilter}
            onChange={(e) => setLogsRoleFilter(e.target.value)}
          >
            {logsRoleOptions.map((option) => (
              <option key={option} value={option}>
                {option === "ALL" ? "All roles" : formatRole(option)}
              </option>
            ))}
          </select>

          <select
            style={styles.logsSelect}
            value={logsStatusFilter}
            onChange={(e) => setLogsStatusFilter(e.target.value)}
          >
            {logsStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option === "ALL" ? "All statuses" : prettyLabel(option)}
              </option>
            ))}
          </select>
        </div>

        {logsError ? <div style={styles.errorBanner}>{logsError}</div> : null}

        <div style={styles.logsTableWrap}>
          <table style={styles.logsTable}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 180 }}>Time</th>
                <th style={{ ...styles.th, width: 240 }}>User</th>
                <th style={{ ...styles.th, width: 160 }}>Role</th>
                <th style={{ ...styles.th, width: 260 }}>Query</th>
                <th style={{ ...styles.th, width: 140 }}>Status</th>
                <th style={{ ...styles.th, minWidth: 420 }}>Summary</th>
                <th style={{ ...styles.th, width: 200 }}>Session</th>
                <th style={{ ...styles.th, width: 120, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logsLoading ? (
                <tr>
                  <td colSpan={8} style={styles.logsEmptyCell}>Loading assistant logs…</td>
                </tr>
              ) : filteredAssistantLogs.length ? (
                filteredAssistantLogs.map((row) => (
                  <Fragment key={row.log_key}>
                    <tr key={row.log_key}>
                      <td style={styles.logsCellTop}>{formatDate(row.timestamp)}</td>
                      <td style={styles.logsCellTop}>
                        <div style={styles.userCellPrimary}>{row.user_name || row.user_id || "Unknown user"}</div>
                        <div style={styles.userCellSecondary}>{row.user_id || "—"}</div>
                      </td>
                      <td style={{ ...styles.logsCellTop, ...styles.logsCenterCell }}>
                        <span style={{ ...styles.softPill, ...rolePillStyle(row.role) }}>
                          {formatRole(row.role)}
                        </span>
                      </td>
                      <td style={styles.logsCellTop}>
                        <div style={styles.logQueryTitle}>{prettyLabel(row.analysis_type || row.raw_query)}</div>
                        <div style={styles.logQueryRange}>{row.date_range || "—"}</div>
                      </td>
                      <td style={{ ...styles.logsCellTop, ...styles.logsCenterCell }}>
                        <span style={{ ...styles.statusPill, ...statusPillStyle(row.response_status) }}>
                          {prettyLabel(row.response_status)}
                        </span>
                      </td>
                      <td style={styles.logsCellTop}>
                        <div style={styles.summaryClamp}>{row.summary || "—"}</div>
                      </td>
                      <td style={{ ...styles.logsCellTop, ...styles.logsSessionCell }}>
                        <div style={styles.sessionText}>{row.session_id || "—"}</div>
                      </td>
                      <td style={{ ...styles.logsCellTop, ...styles.logsActionCell }}>
                        <button
                          type="button"
                          style={styles.detailsBtn}
                          onClick={() => toggleLogOpen(row.log_key)}
                        >
                          {openLogKeys[row.log_key] ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>
                    {openLogKeys[row.log_key] ? (
                      <tr key={`${row.log_key}-details`}>
                        <td colSpan={8} style={styles.logDetailsCell}>
                          <div style={styles.logDetailGrid}>
                            <div>
                              <div style={styles.logDetailLabel}>Intent</div>
                              <div style={styles.logDetailValue}>{row.intent || "—"}</div>
                            </div>
                            <div>
                              <div style={styles.logDetailLabel}>Response type</div>
                              <div style={styles.logDetailValue}>{row.response_type || "—"}</div>
                            </div>
                            <div>
                              <div style={styles.logDetailLabel}>Scope</div>
                              <div style={styles.logDetailValue}>{row.scope_type || "—"}</div>
                            </div>
                            <div>
                              <div style={styles.logDetailLabel}>Latency</div>
                              <div style={styles.logDetailValue}>
                                {row.latency_ms !== null && row.latency_ms !== undefined
                                  ? `${row.latency_ms} ms`
                                  : "—"}
                              </div>
                            </div>
                          </div>
                          <div style={styles.logJsonWrap}>
                            <div style={styles.logDetailLabel}>Payload</div>
                            <pre style={styles.logJson}>{JSON.stringify(row.entities || {}, null, 2)}</pre>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={styles.logsEmptyCell}>No assistant logs found for the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showAddModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2>Create New User</h2>

            <input
              style={styles.modalInput}
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) => handleChange("full_name", e.target.value)}
            />
            {errors.full_name && (
              <div style={styles.errorText}>{errors.full_name}</div>
            )}

            <input
              style={styles.modalInput}
              placeholder="Email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
            {errors.email && (
              <div style={styles.errorText}>{errors.email}</div>
            )}

            <div style={styles.passwordWrap}>
              <input
                style={styles.modalInputFlex}
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
              />
              <button
                type="button"
                style={styles.showBtn}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && (
              <div style={styles.errorText}>{errors.password}</div>
            )}

            {roles.length === 0 && (
              <div style={styles.errorText}>
                No roles loaded from backend. Check /users/roles response.
              </div>
            )}

            <select
              style={styles.modalInput}
              value={form.role_id}
              onChange={(e) => handleChange("role_id", e.target.value)}
            >
              <option value="">Select Role</option>
              {roles.map((role) => (
                <option key={role.role_id} value={role.role_id}>
                  {formatRole(role.role_name)}
                </option>
              ))}
            </select>
            {errors.role_id && (
              <div style={styles.errorText}>{errors.role_id}</div>
            )}

            {errors.api && (
              <div style={styles.errorText}>{errors.api}</div>
            )}

            <div style={styles.passwordRulesBox}>
              <div style={rule(passwordRules.length)}>Minimum 12 characters</div>
              <div style={rule(passwordRules.upper)}>1 uppercase letter</div>
              <div style={rule(passwordRules.lower)}>1 lowercase letter</div>
              <div style={rule(passwordRules.number)}>1 number</div>
              <div style={rule(passwordRules.special)}>1 special character (., @, $, etc.)</div>
            </div>

            <div style={styles.modalActions}>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setErrors({});
                }}
                style={styles.cancelBtn}
              >
                Cancel
              </button>
              <button onClick={handleCreateUser} style={styles.saveBtn}>
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedUser && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2>Edit User</h2>

            <input
              style={styles.modalInput}
              value={selectedUser.full_name}
              onChange={(e) =>
                setSelectedUser({
                  ...selectedUser,
                  full_name: e.target.value,
                })
              }
            />

            <input
              style={styles.modalInput}
              value={selectedUser.email}
              onChange={(e) =>
                setSelectedUser({
                  ...selectedUser,
                  email: e.target.value,
                })
              }
            />

            <select
              style={styles.modalInput}
              value={selectedUser.role_id}
              onChange={(e) =>
                setSelectedUser({
                  ...selectedUser,
                  role_id: e.target.value,
                })
              }
            >
              {roles.map((role) => (
                <option key={role.role_id} value={role.role_id}>
                  {formatRole(role.role_name)}
                </option>
              ))}
            </select>

            {errors.api && (
              <div style={styles.errorText}>{errors.api}</div>
            )}

            <div style={styles.modalActionsBetween}>
              <button style={styles.deleteBtn} onClick={handleDeleteUser}>
                Delete
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedUser(null);
                    setErrors({});
                  }}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button onClick={handleUpdateUser} style={styles.saveBtn}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

const styles = {
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    gap: 16,
    flexWrap: "wrap",
  },
  addBtn: {
    background: "#1e3a5d",
    color: "white",
    border: "none",
    padding: "12px 20px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 15,
    boxShadow: "0 10px 24px rgba(30, 58, 93, 0.20)",
  },
  editBtn: {
    background: "#1e3a5d",
    color: "white",
    border: "none",
    padding: "9px 16px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    boxShadow: "0 8px 18px rgba(30, 58, 93, 0.18)",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
    border: "1px solid #dbe4ee",
    borderRadius: 20,
    background: "#ffffff",
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
  },
  table: {
    width: "100%",
    minWidth: 1120,
    borderCollapse: "separate",
    borderSpacing: 0,
  },
  th: {
    textAlign: "left",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    padding: "18px 22px",
    background: "#f8fbff",
    borderBottom: "1px solid #e5edf5",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "18px 22px",
    borderBottom: "1px solid #eef3f8",
    verticalAlign: "middle",
  },
  tableRowEven: {
    background: "#ffffff",
  },
  tableRowOdd: {
    background: "#fbfdff",
  },
  primaryText: {
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.35,
    fontSize: 16,
  },
  userMetaText: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 6,
    lineHeight: 1.4,
  },
  secondaryTextStrong: {
    color: "#334155",
    fontWeight: 600,
    lineHeight: 1.45,
    wordBreak: "break-word",
    fontSize: 15,
  },
  softPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "0 14px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
    letterSpacing: 0.2,
  },
  cellDate: {
    whiteSpace: "normal",
    color: "#334155",
    fontWeight: 500,
    lineHeight: 1.55,
    minWidth: 160,
  },
  actionsCell: {
    textAlign: "right",
    whiteSpace: "nowrap",
    minWidth: 110,
  },
  logsSection: {
    marginTop: 32,
    border: "1px solid #dbe4ee",
    borderRadius: 24,
    padding: 26,
    background: "linear-gradient(180deg, #fbfdff 0%, #f8fbff 100%)",
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)",
  },
  logsHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  logsTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 900,
    color: "#0f172a",
  },
  logsSubtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.5,
  },
  logsCountBadge: {
    background: "rgba(30, 58, 93, 0.08)",
    color: "#1e3a5d",
    border: "1px solid rgba(30, 58, 93, 0.16)",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 800,
  },
  logsFiltersRow: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 2fr) minmax(180px, 0.9fr) minmax(180px, 0.9fr)",
    gap: 14,
    marginBottom: 20,
  },
  logsSearchInput: {
    height: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "0 16px",
    background: "#fff",
    fontSize: 15,
    color: "#0f172a",
    outline: "none",
    boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
  },
  logsSelect: {
    minWidth: 180,
    height: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "0 14px",
    background: "#fff",
    fontSize: 15,
    color: "#0f172a",
    outline: "none",
  },
  logsTableWrap: {
    width: "100%",
    overflowX: "auto",
    border: "1px solid #dbe4ee",
    borderRadius: 20,
    background: "#fff",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  },
  logsTable: {
    width: "100%",
    minWidth: 1320,
    borderCollapse: "separate",
    borderSpacing: 0,
  },
  logsCellTop: {
    verticalAlign: "top",
    padding: "18px 20px",
    borderBottom: "1px solid #eef3f8",
  },
  logsActionCell: {
    textAlign: "right",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },

  logsSessionCell: {
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },

  logsCenterCell: {
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },

  logQueryTitle: {
    fontWeight: 800,
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.35,
    marginBottom: 8,
  },

  logQueryRange: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.45,
  },
  userCellPrimary: {
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
    lineHeight: 1.35,
    fontSize: 15,
  },
  userCellSecondary: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.4,
    marginTop: 6,
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    padding: "0 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  sessionText: {
    fontSize: 12,
    color: "#475569",
    fontFamily: "monospace",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "8px 12px",
    display: "inline-flex",
    alignItems: "center",
    minHeight: 36,
    maxWidth: 190,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  detailsBtn: {
    background: "#1e3a5d",
    color: "#ffffff",
    border: "none",
    padding: "8px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
    boxShadow: "0 8px 18px rgba(30, 58, 93, 0.16)",
  },
  logsEmptyCell: {
    textAlign: "center",
    padding: 22,
    color: "#64748b",
  },
  logDetailsCell: {
    background: "#f8fafc",
    padding: 18,
    borderTop: "1px solid #e2e8f0",
  },
  logDetailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 14,
  },
  logDetailLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  logDetailValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: 600,
  },
  logJsonWrap: {
    marginTop: 8,
  },
  logJson: {
    margin: 0,
    background: "#0f172a",
    color: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    fontSize: 12,
    lineHeight: 1.5,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
  },
  modal: {
    background: "white",
    padding: 30,
    borderRadius: 22,
    width: "min(720px, 100%)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.20)",
    border: "1px solid #e5edf5",
  },
  passwordWrap: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 110px",
    gap: 12,
    alignItems: "center",
  },
  showBtn: {
    height: 48,
    background: "#eef2f7",
    border: "1px solid #dbe3ee",
    padding: "0 16px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700,
    color: "#334155",
  },
  passwordRulesBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: 18,
    borderRadius: 16,
    fontSize: 14,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    lineHeight: 1.5,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  modalActionsBetween: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 20,
  },
  cancelBtn: {
    background: "#e5e7eb",
    border: "none",
    padding: "10px 18px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700,
    color: "#334155",
  },
  saveBtn: {
    background: "#4da851",
    color: "white",
    border: "none",
    padding: "10px 18px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 800,
  },
  deleteBtn: {
    background: "#dc2626",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    marginTop: 4,
  },
  errorBanner: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: "10px 14px",
    borderRadius: 10,
    marginBottom: 16,
  },
  modalInput: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "0 14px",
    fontSize: 15,
    color: "#0f172a",
    background: "#ffffff",
    outline: "none",
    boxSizing: "border-box",
  },

  modalInputFlex: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "0 14px",
    fontSize: 15,
    color: "#0f172a",
    background: "#ffffff",
    outline: "none",
    boxSizing: "border-box",
  },
};
