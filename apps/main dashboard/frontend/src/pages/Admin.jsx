import { useEffect, useState } from "react";
import AdminLayout from "../layouts/AdminLayout";

const rule = (valid) => ({
    color: valid ? "#16a34a" : "#94a3b8",
    fontWeight: valid ? 600 : 400,
});

const formatRole = (role) =>
    role
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

const formatDate = (date) =>
    date ? new Date(date).toLocaleString() : "—";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export default function Admin() {
    const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");

    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
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

    useEffect(() => {
        fetchUsers();
        fetchRoles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const passwordRules = {
        length: form.password.length >= 12,
        upper: /[A-Z]/.test(form.password),
        lower: /[a-z]/.test(form.password),
        number: /\d/.test(form.password),
        special: /[^A-Za-z0-9]/.test(form.password),
    };

    const isPasswordValid = Object.values(passwordRules).every(Boolean);

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
                    : (data.error || "Failed to create user");

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
            const res = await fetch(
                `${API_BASE}/users/${selectedUser.user_id}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

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
                            <div style={rule(passwordRules.special)}>
                                1 special character (., @, $, etc.)
                            </div>
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
                            <button
                                onClick={handleCreateUser}
                                style={styles.saveBtn}
                            >
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
        marginBottom: 20,
    },
    addBtn: {
        background: "#111827",
        color: "white",
        border: "none",
        padding: "10px 18px",
        borderRadius: 10,
        cursor: "pointer",
    },
    editBtn: {
        background: "#2563eb",
        color: "white",
        border: "none",
        padding: "6px 14px",
        borderRadius: 8,
        cursor: "pointer",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
    },
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
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
    },
    saveBtn: {
        background: "#16a34a",
        color: "white",
        border: "none",
        padding: "8px 16px",
        borderRadius: 8,
    },
    deleteBtn: {
        background: "#dc2626",
        color: "white",
        border: "none",
        padding: "8px 16px",
        borderRadius: 8,
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