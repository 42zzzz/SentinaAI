import { useNavigate } from "react-router-dom";

export default function AdminLayout({ children }) {
  const navigate = useNavigate();

  const fullName = localStorage.getItem("full_name");
  const role = localStorage.getItem("role");
  const employeeId = localStorage.getItem("employee_id");
  const formattedRole = role
  ? role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  : ""; 

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("full_name");
    localStorage.removeItem("employee_id");
    navigate("/login");
  };

  return (
    <div style={styles.wrapper}>
      
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.brand}>SentinaAI</div>

        <div style={styles.rightSection}>
          <div style={styles.profileInfo}>
            <div style={styles.name}>{fullName || "Super Admin"}</div>
            <div style={styles.meta}>{formattedRole}</div>
            <div style={styles.meta}>Employee ID: {employeeId}</div>
          </div>

          <div style={styles.avatar}>
            {fullName ? fullName.charAt(0).toUpperCase() : "A"}
          </div>

          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.contentWrapper}>
        <div style={styles.contentCard}>
          <h1 style={styles.title}>Super Admin Dashboard</h1>
          <div style={styles.divider} />
          {children}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    background: "#f4f6fb",
    display: "flex",
    flexDirection: "column",
  },

  topBar: {
    height: 70,
    background: "#111827",
    color: "white",
    padding: "0 40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  brand: {
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: -0.5,
  },

  rightSection: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  profileInfo: {
    textAlign: "right",
  },

  name: {
    fontWeight: 700,
    fontSize: 14,
  },

  meta: {
    fontSize: 12,
    opacity: 0.75,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "#e11d48",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 16,
  },

  logoutBtn: {
    background: "#e11d48",
    border: "none",
    color: "white",
    padding: "8px 16px",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
  },

  contentWrapper: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    padding: "60px 20px",
  },

  contentCard: {
    width: "100%",
    maxWidth: 1100,
    background: "white",
    borderRadius: 18,
    padding: 40,
    boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
  },

  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
  },

  divider: {
    height: 1,
    background: "#e5e7eb",
    margin: "20px 0 30px 0",
  },
};