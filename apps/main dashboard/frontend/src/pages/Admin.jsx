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
        <h2>User Management</h2>
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
              <th>Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th>Last Active</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr key={user.user_id}>
                <td>{user.employee_id}</td>
                <td>{user.full_name}</td>
                <td>{user.email}</td>
                <td>{formatRole(user.role_name)}</td>
                <td>{user.status}</td>
                <td>{formatDate(user.created_at)}</td>
                <td>{formatDate(user.last_active_at)}</td>
                <td>
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
                <th>Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Query</th>
                <th>Status</th>
                <th>Summary</th>
                <th>Session</th>
                <th></th>
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
                      <td style={styles.logsCellTop}>{formatRole(row.role)}</td>
                      <td style={styles.logsCellTop}>
                        <div style={styles.userCellPrimary}>{prettyLabel(row.analysis_type || row.raw_query)}</div>
                        <div style={styles.userCellSecondary}>{row.date_range || "—"}</div>
                      </td>
                      <td style={styles.logsCellTop}>
                        <span style={{ ...styles.statusPill, ...statusPillStyle(row.response_status) }}>
                          {prettyLabel(row.response_status)}
                        </span>
                      </td>
                      <td style={styles.logsCellTop}>
                        <div style={styles.summaryClamp}>{row.summary || "—"}</div>
                      </td>
                      <td style={styles.logsCellTop}>{row.session_id || "—"}</td>
                      <td style={styles.logsCellTop}>
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
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) => handleChange("full_name", e.target.value)}
            />
            {errors.full_name && (
              <div style={styles.errorText}>{errors.full_name}</div>
            )}

            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
            {errors.email && (
              <div style={styles.errorText}>{errors.email}</div>
            )}

            <div style={styles.passwordWrap}>
              <input
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
              value={selectedUser.full_name}
              onChange={(e) =>
                setSelectedUser({
                  ...selectedUser,
                  full_name: e.target.value,
                })
              }
            />

            <input
              value={selectedUser.email}
              onChange={(e) =>
                setSelectedUser({
                  ...selectedUser,
                  email: e.target.value,
                })
              }
            />

            <select
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
    marginBottom: 20,
  },
  addBtn: {
    background: "#111827",
    color: "white",
    border: "none",
    padding: "10px 18px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  },
  editBtn: {
    background: "#2563eb",
    color: "white",
    border: "none",
    padding: "6px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  logsSection: {
    marginTop: 32,
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 22,
    background: "#fafcff",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
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
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
  },
  logsSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
  },
  logsCountBadge: {
    background: "#e0f2fe",
    color: "#075985",
    border: "1px solid #bae6fd",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
  },
  logsFiltersRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  logsSearchInput: {
    flex: "1 1 320px",
    minWidth: 260,
    height: 42,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: "0 14px",
    background: "#fff",
  },
  logsSelect: {
    minWidth: 180,
    height: 42,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: "0 12px",
    background: "#fff",
  },
  logsTableWrap: {
    width: "100%",
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#fff",
  },
  logsTable: {
    width: "100%",
    minWidth: 1040,
    borderCollapse: "collapse",
  },
  logsCellTop: {
    verticalAlign: "top",
  },
  userCellPrimary: {
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
  },
  userCellSecondary: {
    fontSize: 12,
    color: "#64748b",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  summaryClamp: {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    color: "#334155",
    lineHeight: 1.45,
    maxWidth: 260,
  },
  detailsBtn: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: "6px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
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
    padding: 40,
    borderRadius: 16,
    width: 600,
    display: "flex",
    flexDirection: "column",
    gap: 15,
  },
  passwordWrap: {
    display: "flex",
    gap: 10,
  },
  showBtn: {
    background: "#e5e7eb",
    border: "none",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },
  passwordRulesBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: 16,
    borderRadius: 12,
    fontSize: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalActionsBetween: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 20,
  },
  cancelBtn: {
    background: "#e5e7eb",
    border: "none",
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
  },
  saveBtn: {
    background: "#16a34a",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
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
};
