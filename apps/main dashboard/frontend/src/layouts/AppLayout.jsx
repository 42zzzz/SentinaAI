import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

const navItemStyle = ({ isActive }) => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  textDecoration: "none",
  color: isActive ? "#e11d48" : "#111827",
  background: isActive ? "rgba(225,29,72,0.08)" : "transparent",
  fontWeight: isActive ? 700 : 600,
  marginBottom: 6,
});

const iconStyle = {
  width: 18,
  height: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 6,
  background: "#f3f4f6",
  fontSize: 12,
};

function PageTitle() {
  const { pathname } = useLocation();

  if (pathname === "/operations" || pathname === "/operations/") {
    return "Dashboard";
  }

  if (pathname.startsWith("/operations/devices")) return "Devices";
  if (pathname.startsWith("/operations/events")) return "Events";
  if (pathname.startsWith("/operations/exhibitors")) return "Exhibitors";
  if (pathname.startsWith("/operations/booths")) return "Booths & Assignments";
  if (pathname.startsWith("/operations/alerts")) return "Alerts";
  if (pathname.startsWith("/operations/navigation")) return "Navigation";

  return "SentinaAI";
}

export default function AppLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/", { replace: true });
  };

  return (
    <div style={styles.shell}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>SentinaAI</div>

        <div style={styles.sectionLabel}>MAIN</div>

        <NavLink to="/operations" end style={navItemStyle}>
          <span style={iconStyle}>🏠</span> Dashboard
        </NavLink>

        <NavLink to="/operations/devices" style={navItemStyle}>
          <span style={iconStyle}>📟</span> Devices
        </NavLink>

        <NavLink to="/operations/alerts" style={navItemStyle}>
          <span style={iconStyle}>⚠️</span> Alerts
        </NavLink>

        <NavLink to="/operations/events" style={navItemStyle}>
          <span style={iconStyle}>🗓️</span> Events
        </NavLink>

        <NavLink to="/operations/exhibitors" style={navItemStyle}>
          <span style={iconStyle}>🏢</span> Exhibitors
        </NavLink>

        <NavLink to="/operations/booths" style={navItemStyle}>
          <span style={iconStyle}>🧭</span> Booths
        </NavLink>

        <NavLink to="/operations/navigation" style={navItemStyle}>
          <span style={iconStyle}>🗺️</span> Navigation
        </NavLink>

        <div style={{ flex: 1 }} />

        <div style={styles.sectionLabel}>SETTINGS</div>

        <NavLink to="/operations/settings" style={navItemStyle}>
          <span style={iconStyle}>⚙️</span> Settings
        </NavLink>

        <NavLink to="/operations/help" style={navItemStyle}>
          <span style={iconStyle}>❔</span> Help
        </NavLink>

        <button style={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <div style={styles.pageTitle}>{PageTitle()}</div>
            <div style={styles.subTitle}>
              Operations Dashboard • {new Date().toLocaleString()}
            </div>
          </div>

          <div style={styles.headerRight}>
            <div style={styles.searchWrap}>
              <input placeholder="Search here" style={styles.searchInput} />
              <span style={styles.searchIcon}>🔎</span>
            </div>

            <div style={styles.userCard}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13 }}>
                  {localStorage.getItem("full_name") || "User"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Role: {localStorage.getItem("role")}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Employee ID: {localStorage.getItem("employee_id")}
                </div>
              </div>
              <div style={styles.avatar}>
                {(localStorage.getItem("full_name") || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <div style={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const styles = {
  shell: {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    height: "100vh",
    background: "#f6f7fb",
    color: "#111827",
  },
  sidebar: {
    padding: 18,
    background: "#ffffff",
    borderRight: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  brand: {
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: "-0.5px",
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.55,
    marginTop: 6,
    marginBottom: 8,
  },
  logoutBtn: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #fee2e2",
    background: "#fff1f2",
    color: "#e11d48",
    fontWeight: 800,
    cursor: "pointer",
  },
  main: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    padding: "18px 22px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 900,
  },
  subTitle: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.65,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  searchWrap: {
    position: "relative",
    width: 320,
  },
  searchInput: {
    width: "100%",
    padding: "10px 36px 10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    background: "#ffffff",
  },
  searchIcon: {
    position: "absolute",
    right: 10,
    top: 8,
    opacity: 0.6,
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 10px",
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    background: "#111827",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  },
  content: {
    padding: "0 22px 22px 22px",
    overflow: "auto",
  },
};