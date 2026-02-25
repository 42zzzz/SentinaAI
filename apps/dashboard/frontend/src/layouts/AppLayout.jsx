import { NavLink, Outlet, useLocation } from "react-router-dom";

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
  const map = {
    "/": "Dashboard",
    "/devices": "Devices",
    "/events": "Events",
    "/exhibitors": "Exhibitors",
    "/booths": "Booths & Assignments",
    "/alerts": "Alerts",
  };
  return map[pathname] || "SentinaAI";
}

export default function AppLayout() {
  return (
    <div style={styles.shell}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>SentinaAI</div>

        <div style={styles.sectionLabel}>MAIN</div>
        <NavLink to="/" end style={navItemStyle}>
          <span style={iconStyle}>🏠</span> Dashboard
        </NavLink>
        <NavLink to="/devices" style={navItemStyle}>
          <span style={iconStyle}>📟</span> Devices
        </NavLink>
        <NavLink to="/alerts" style={navItemStyle}>
          <span style={iconStyle}>⚠️</span> Alerts
        </NavLink>
        <NavLink to="/events" style={navItemStyle}>
          <span style={iconStyle}>🗓️</span> Events
        </NavLink>
        <NavLink to="/exhibitors" style={navItemStyle}>
          <span style={iconStyle}>🏢</span> Exhibitors
        </NavLink>
        <NavLink to="/booths" style={navItemStyle}>
          <span style={iconStyle}>🧭</span> Booths
        </NavLink>

        <div style={{ flex: 1 }} />

        <div style={styles.sectionLabel}>SETTINGS</div>
        <NavLink to="/settings" style={navItemStyle}>
          <span style={iconStyle}>⚙️</span> Settings
        </NavLink>
        <NavLink to="/help" style={navItemStyle}>
          <span style={iconStyle}>❔</span> Help
        </NavLink>

        <button style={styles.logoutBtn}>Logout</button>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        {/* Top header */}
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
                <div style={{ fontWeight: 800, fontSize: 13 }}>Tracy Miller</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Role: Operation Manager</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Employee ID: ED-360</div>
              </div>
              <div style={styles.avatar}>TM</div>
            </div>
          </div>
        </header>

        {/* Page content */}
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
    background: "transparent",
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