import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import homeIcon from "../assets/icons/home.svg";
import devicesIcon from "../assets/icons/devices.svg";
// import alertsIcon from "../assets/icons/alerts.svg";


const rolePrefixMap = {
  operations_manager: "/operations",
  sustainability_manager: "/sustainability",
  soc_analyst: "/soc",
  exhibitor: "/exhibitor",
};


const IconSize = 20;

const navItemStyle = ({ isActive }) => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  textDecoration: "none",
  color: isActive ? "#E8486F" : "#111827",
  background: isActive ? "rgba(232,72,111,0.08)" : "transparent",
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
  const role = localStorage.getItem("role");

  if (role === "sustainability_manager") {
    if (pathname === "/sustainability" || pathname === "/sustainability/") return "Dashboard";
    if (pathname.startsWith("/sustainability/devices")) return "Devices";
    if (pathname.startsWith("/sustainability/alerts")) return "Alerts";
    if (pathname.startsWith("/sustainability/energy")) return "Energy";
    if (pathname.startsWith("/sustainability/environment")) return "Environmental";
    if (pathname.startsWith("/sustainability/map")) return "Map";
    if (pathname.startsWith("/sustainability/reports")) return "Reports";
  }

  if (pathname === "/operations" || pathname === "/operations/") return "Dashboard";
  if (pathname.startsWith("/operations/devices")) return "Devices";
  if (pathname.startsWith("/operations/events")) return "Events";
  if (pathname.startsWith("/operations/exhibitors")) return "Exhibitors";
  if (pathname.startsWith("/operations/booths")) return "Booths & Assignments";
  if (pathname.startsWith("/operations/alerts")) return "Alerts";
  if (pathname.startsWith("/operations/navigation")) return "Navigation";

  return "SentinaAI";
}

function SvgIcon({ children }) {
  return <span style={iconStyle}>{children}</span>;
}

export default function AppLayout() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role") || "operations_manager";
  const rolePrefix = rolePrefixMap[role] || "/operations";

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

        <NavLink to={rolePrefix} end style={navItemStyle}>
          <SvgIcon>
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 21"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7 19.3333V10.1667H13V19.3333M1 7.41667L10 1L19 7.41667V17.5C19 17.9862 18.7893 18.4525 18.4142 18.7964C18.0391 19.1402 17.5304 19.3333 17 19.3333H3C2.46957 19.3333 1.96086 19.1402 1.58579 18.7964C1.21071 18.4525 1 17.9862 1 17.5V7.41667Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </SvgIcon>
          Dashboard
        </NavLink>

        <NavLink to={`${rolePrefix}/devices`} style={navItemStyle}>
          <SvgIcon>
            <svg
              width={IconSize}
              height={IconSize}
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M27.0347 17.3792H23.1726V13.5171H21.2415V22.2068H5.79314V6.75845L14.4829 6.75758V4.82741H10.6208V0.965332H8.68971V4.82741H5.79314C5.28115 4.82792 4.79028 5.03153 4.42825 5.39356C4.06622 5.75559 3.8626 6.24646 3.86209 6.75845V9.655H0V11.586H3.86209V17.3792H0V19.3102H3.86209V22.2068C3.86268 22.7187 4.06632 23.2095 4.42833 23.5716C4.79035 23.9336 5.28118 24.1372 5.79314 24.1378H8.68971V27.9999H10.6208V24.1378H16.4139V27.9999H18.3449V24.1378H21.2415C21.7534 24.1371 22.2442 23.9334 22.6062 23.5714C22.9682 23.2094 23.1719 22.7187 23.1726 22.2068V19.3102H27.0347V17.3792Z"
                fill="currentColor"
              />
              <path
                d="M18.3447 19.3105H8.68945V9.65527H18.3447V19.3105ZM10.6205 17.3794H16.4136V11.5863H10.6205V17.3794Z"
                fill="currentColor"
              />
              <path
                d="M28.0003 11.5862H26.0693C26.0663 9.02643 25.0481 6.57233 23.238 4.76228C21.428 2.95223 18.9739 1.93403 16.4141 1.93104V0C19.4859 0.00334794 22.431 1.22511 24.6031 3.39723C26.7752 5.56934 27.997 8.5144 28.0003 11.5862Z"
                fill="currentColor"
              />
              <path
                d="M23.1727 11.5863H21.2417C21.2402 10.3064 20.7311 9.07933 19.826 8.17431C18.921 7.26929 17.694 6.76018 16.4141 6.75867V4.82764C18.2059 4.82981 19.9237 5.54257 21.1908 6.80959C22.4578 8.07661 23.1706 9.79444 23.1727 11.5863Z"
                fill="currentColor"
              />
            </svg>
          </SvgIcon>
          Devices
        </NavLink>

        <NavLink to={`${rolePrefix}/alerts`} style={navItemStyle}>
          <SvgIcon>
            <svg
              width={IconSize}
              height={IconSize}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M11.9998 8.99999V13M11.9998 17H12.0098M10.6151 3.89171L2.39019 18.0983C1.93398 18.8863 1.70588 19.2803 1.73959 19.6037C1.769 19.8857 1.91677 20.142 2.14613 20.3088C2.40908 20.5 2.86435 20.5 3.77487 20.5H20.2246C21.1352 20.5 21.5904 20.5 21.8534 20.3088C22.0827 20.142 22.2305 19.8857 22.2599 19.6037C22.2936 19.2803 22.0655 18.8863 21.6093 18.0983L13.3844 3.89171C12.9299 3.10654 12.7026 2.71396 12.4061 2.58211C12.1474 2.4671 11.8521 2.4671 11.5935 2.58211C11.2969 2.71396 11.0696 3.10655 10.6151 3.89171Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </SvgIcon>
          Alerts
        </NavLink>

        {role === "operations_manager" && (
          <>
            <NavLink to={`${rolePrefix}/events`} style={navItemStyle}>
              <SvgIcon>
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 25 19"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M0.5 0.5H2V17.375H24.5V18.5H0.5V0.5ZM22.7255 4.00212C22.8018 4.04893 22.865 4.10656 22.9116 4.17171C22.9581 4.23686 22.9871 4.30825 22.9969 4.3818C23.0066 4.45536 22.9969 4.52963 22.9684 4.60038C22.9398 4.67113 22.893 4.73697 22.8305 4.79413L16.0805 10.9816C16.0142 11.0424 15.9316 11.092 15.8381 11.1274C15.7447 11.1627 15.6424 11.183 15.5378 11.1869C15.4332 11.1909 15.3288 11.1783 15.231 11.1501C15.1333 11.1219 15.0446 11.0787 14.9705 11.0233L11.09 8.11287L5.606 13.7682C5.48603 13.8827 5.31161 13.9577 5.11938 13.9777C4.92714 13.9977 4.73207 13.961 4.57516 13.8753C4.41824 13.7897 4.3117 13.6618 4.27792 13.5184C4.24413 13.3751 4.28574 13.2276 4.394 13.1068L10.394 6.91925C10.4577 6.85345 10.5396 6.79879 10.6342 6.75904C10.7288 6.71928 10.8337 6.69537 10.9418 6.68895C11.0498 6.68254 11.1585 6.69377 11.2602 6.72187C11.3619 6.74998 11.4543 6.79429 11.531 6.85175L15.4445 9.788L21.6695 4.08087C21.7319 4.02367 21.8087 3.97625 21.8956 3.94133C21.9825 3.9064 22.0777 3.88467 22.1757 3.87735C22.2738 3.87004 22.3728 3.87729 22.4672 3.8987C22.5615 3.92011 22.6493 3.95526 22.7255 4.00212Z"
                    fill="currentColor"
                    stroke="currentColor"
                  />
                </svg>
              </SvgIcon>
              Events
            </NavLink>

            <NavLink to={`${rolePrefix}/exhibitors`} style={navItemStyle}>
              <SvgIcon>
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 32 22"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M7.61909 8C8.88226 8 9.90481 6.6579 9.90481 5C9.90481 3.3421 8.88226 2 7.61909 2C6.35593 2 5.33338 3.3421 5.33338 5C5.33338 6.6579 6.35593 8 7.61909 8ZM7.61909 10C9.72386 10 11.4286 7.7625 11.4286 5C11.4286 2.2375 9.72386 0 7.61909 0C5.51433 0 3.80957 2.2375 3.80957 5C3.80957 7.7625 5.51433 10 7.61909 10Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M1.99734 15.7886C1.62706 16.2779 1.52381 16.6725 1.52381 17V20H15.2381V17C15.2381 16.6725 15.1349 16.2779 14.7646 15.7886C14.3803 15.2809 13.7821 14.7792 13.0101 14.3364C11.4581 13.4461 9.57067 13 8.38095 13C7.19124 13 5.30389 13.4461 3.75176 14.3364C2.97979 14.7792 2.38153 15.2809 1.99734 15.7886ZM8.38095 11C5.58377 11 0 13.01 0 17V22H16.7619V17C16.7619 13.01 11.1781 11 8.38095 11Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M24.3808 8C25.644 8 26.6665 6.6579 26.6665 5C26.6665 3.3421 25.644 2 24.3808 2C23.1177 2 22.0951 3.3421 22.0951 5C22.0951 6.6579 23.1177 8 24.3808 8ZM24.3808 10C26.4856 10 28.1903 7.7625 28.1903 5C28.1903 2.2375 26.4856 0 24.3808 0C22.2761 0 20.5713 2.2375 20.5713 5C20.5713 7.7625 22.2761 10 24.3808 10Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M15.9998 6C16.842 6 17.5236 5.1054 17.5236 4C17.5236 2.8946 16.842 2 15.9998 2C15.1576 2 14.476 2.8946 14.476 4C14.476 5.1054 15.1576 6 15.9998 6ZM15.9998 8C17.6836 8 19.0474 6.21 19.0474 4C19.0474 1.79 17.6836 0 15.9998 0C14.316 0 12.9521 1.79 12.9521 4C12.9521 6.21 14.316 8 15.9998 8Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M17.2356 15.7886C16.8653 16.2779 16.7621 16.6725 16.7621 17V20H30.4764V17C30.4764 16.6725 30.3731 16.2779 30.0029 15.7886C29.6186 15.2809 29.0204 14.7792 28.2484 14.3364C26.6963 13.4461 24.8089 13 23.6192 13C22.4295 13 20.5421 13.4461 18.9901 14.3364C18.2181 14.7792 17.6198 15.2809 17.2356 15.7886ZM23.6192 11C20.8221 11 15.2383 13.01 15.2383 17V22H32.0002V17C32.0002 13.01 26.4164 11 23.6192 11Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M16 11C13.4786 11 11.7119 12.5425 11.2054 13.2071L10.1279 11.7929C10.8914 10.7909 13.0357 9 16 9C18.9643 9 21.1087 10.7909 21.8721 11.7929L20.7946 13.2071C20.2882 12.5425 18.5214 11 16 11Z"
                    fill="currentColor"
                  />
                </svg>
              </SvgIcon>
              Exhibitors
            </NavLink>

            <NavLink to={`${rolePrefix}/booths`} style={navItemStyle}>
              <SvgIcon>
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 35 33"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M17.0471 2.0552L17.1449 2.05482C19.4789 2.04581 21.2968 2.0388 22.7526 2.14867C24.2316 2.2603 25.432 2.49747 26.504 3.02884C28.0229 3.78167 29.2734 4.91893 30.1065 6.30515C30.6945 7.28358 30.9626 8.38186 31.0958 9.73651C31.227 11.07 31.2334 12.7361 31.2417 14.8754L31.2523 17.6286C31.2605 19.7679 31.267 21.434 31.1461 22.7685C31.0233 24.1241 30.7637 25.2244 30.1833 26.2074C29.3609 27.6 28.1192 28.7468 26.6062 29.5114C25.5383 30.051 24.3398 30.2974 22.8617 30.4205C21.4067 30.5416 19.5888 30.5486 17.2547 30.5576L17.1572 30.5579C14.8231 30.5669 13.0052 30.574 11.5493 30.4641C10.0703 30.3525 8.86996 30.1153 7.79791 29.5839C6.27904 28.8311 5.02857 27.6938 4.19544 26.3076C3.6074 25.3292 3.33934 24.2309 3.2061 22.8762C3.07494 21.5428 3.06852 19.8767 3.06028 17.7374L3.04966 14.9841C3.0414 12.8448 3.03497 11.1787 3.15583 9.84427C3.27862 8.48864 3.5382 7.38832 4.11868 6.40538C4.94109 5.01278 6.18275 3.86591 7.69577 3.10138C8.76369 2.56176 9.96217 2.31534 11.4403 2.19231C12.8952 2.0712 14.7131 2.06419 17.0471 2.0552ZM11.6229 4.04934C10.2789 4.16122 9.39617 4.37085 8.6771 4.7342C7.50573 5.32609 6.54444 6.21399 5.90774 7.29214C5.51688 7.95398 5.295 8.76462 5.18335 9.9973C5.07062 11.2419 5.07584 12.8275 5.0843 15.021L5.09458 17.6848C5.10304 19.8783 5.11004 21.4639 5.23237 22.7076C5.35352 23.9394 5.58166 24.7483 5.97761 25.4071C6.62261 26.4803 7.59072 27.3607 8.76662 27.9436C9.48847 28.3014 10.3728 28.5042 11.7176 28.6057C13.0755 28.7082 14.8055 28.7023 17.1987 28.6931C19.592 28.6839 21.322 28.6764 22.679 28.5634C24.0231 28.4515 24.9058 28.2419 25.6248 27.8786C26.7962 27.2867 27.7575 26.3988 28.3942 25.3206C28.7851 24.6588 29.0069 23.8481 29.1186 22.6155C29.2313 21.3709 29.2261 19.7852 29.2176 17.5918L29.2074 14.928C29.1989 12.7345 29.1919 11.1489 29.0696 9.90517C28.9484 8.67339 28.7203 7.86449 28.3243 7.20568C27.6793 6.13247 26.7112 5.25201 25.5353 4.66918C24.8135 4.31139 23.9292 4.10857 22.5843 4.00707C21.2264 3.90458 19.4964 3.91044 17.1032 3.91967C14.71 3.9289 12.98 3.93639 11.6229 4.04934Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M22.9881 22.5442C22.9901 23.0591 22.5363 23.4783 21.9745 23.4805L10.9302 23.5231C10.3684 23.5253 9.91132 23.1096 9.90934 22.5947C9.90735 22.0798 10.3612 21.6606 10.923 21.6584L21.9673 21.6158C22.5291 21.6137 22.9861 22.0293 22.9881 22.5442Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M22.9671 17.2161C22.9691 17.731 22.5153 18.1502 21.9535 18.1524L10.9092 18.195C10.3474 18.1971 9.89033 17.7815 9.88834 17.2666C9.88636 16.7516 10.3402 16.3325 10.902 16.3303L21.9463 16.2877C22.5081 16.2855 22.9651 16.7012 22.9671 17.2161Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M17.1341 11.9114C17.1361 12.4263 16.6823 12.8455 16.1205 12.8477L10.889 12.8679C10.3271 12.87 9.8701 12.4544 9.86812 11.9394C9.86613 11.4245 10.32 11.0054 10.8818 11.0032L16.1133 10.983C16.6751 10.9808 17.1321 11.3965 17.1341 11.9114Z"
                    fill="currentColor"
                  />
                </svg>
              </SvgIcon>
              Booths
            </NavLink>

            <NavLink to={`${rolePrefix}/navigation`} style={navItemStyle}>
              <SvgIcon>
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 34 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M11.3332 18L1.4165 22V6L11.3332 2M11.3332 18L22.6665 22M11.3332 18V2M22.6665 22L32.5832 18V2L22.6665 6M22.6665 22V6M22.6665 6L11.3332 2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </SvgIcon>
              Navigation
            </NavLink>
          </>
        )}

        {role === "sustainability_manager" && (
          <>
            <NavLink to={`${rolePrefix}/energy`} style={navItemStyle}>
              <SvgIcon>⚡</SvgIcon>
              Energy
            </NavLink>

            <NavLink to={`${rolePrefix}/environment`} style={navItemStyle}>
              <SvgIcon>🌱</SvgIcon>
              Environmental
            </NavLink>

            <NavLink to={`${rolePrefix}/map`} style={navItemStyle}>
              <SvgIcon>🗺️</SvgIcon>
              Map
            </NavLink>

            <NavLink to={`${rolePrefix}/reports`} style={navItemStyle}>
              <SvgIcon>📊</SvgIcon>
              Reports
            </NavLink>
          </>
        )}

        <div style={{ flex: 1 }} />

        <div style={styles.sectionLabel}>SETTINGS</div>

        <NavLink to={`${rolePrefix}/settings`} style={navItemStyle}>
          <SvgIcon>
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g clipPath="url(#clip0)">
                <path
                  d="M13.9998 17.5003C15.9328 17.5003 17.4998 15.9333 17.4998 14.0003C17.4998 12.0673 15.9328 10.5003 13.9998 10.5003C12.0668 10.5003 10.4998 12.0673 10.4998 14.0003C10.4998 15.9333 12.0668 17.5003 13.9998 17.5003Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M22.6332 17.5003C22.4779 17.8522 22.4315 18.2426 22.5002 18.621C22.5688 18.9995 22.7492 19.3487 23.0182 19.6237L23.0882 19.6937C23.3051 19.9104 23.4772 20.1677 23.5946 20.451C23.7121 20.7342 23.7725 21.0379 23.7725 21.3445C23.7725 21.6511 23.7121 21.9548 23.5946 22.238C23.4772 22.5213 23.3051 22.7786 23.0882 22.9953C22.8715 23.2123 22.6141 23.3844 22.3309 23.5018C22.0476 23.6192 21.744 23.6797 21.4373 23.6797C21.1307 23.6797 20.8271 23.6192 20.5438 23.5018C20.2605 23.3844 20.0032 23.2123 19.7865 22.9953L19.7165 22.9253C19.4415 22.6564 19.0923 22.4759 18.7139 22.4073C18.3354 22.3387 17.9451 22.385 17.5932 22.5403C17.2481 22.6882 16.9538 22.9338 16.7465 23.2468C16.5392 23.5598 16.428 23.9266 16.4265 24.302V24.5003C16.4265 25.1192 16.1807 25.7127 15.7431 26.1502C15.3055 26.5878 14.712 26.8337 14.0932 26.8337C13.4743 26.8337 12.8808 26.5878 12.4433 26.1502C12.0057 25.7127 11.7598 25.1192 11.7598 24.5003V24.3953C11.7508 24.0092 11.6258 23.6347 11.4011 23.3205C11.1764 23.0063 10.8624 22.767 10.4998 22.6337C10.148 22.4784 9.75761 22.432 9.37915 22.5007C9.00069 22.5693 8.65146 22.7497 8.3765 23.0187L8.3065 23.0887C8.0898 23.3056 7.83246 23.4777 7.5492 23.5951C7.26594 23.7126 6.96231 23.773 6.65567 23.773C6.34903 23.773 6.04541 23.7126 5.76214 23.5951C5.47888 23.4777 5.22154 23.3056 5.00484 23.0887C4.78789 22.872 4.61579 22.6146 4.49836 22.3314C4.38094 22.0481 4.3205 21.7445 4.3205 21.4378C4.3205 21.1312 4.38094 20.8276 4.49836 20.5443C4.61579 20.261 4.78789 20.0037 5.00484 19.787L5.07484 19.717C5.3438 19.442 5.52422 19.0928 5.59284 18.7143C5.66146 18.3359 5.61514 17.9455 5.45984 17.5937C5.31195 17.2486 5.06639 16.9543 4.75338 16.747C4.44038 16.5397 4.07359 16.4285 3.69817 16.427H3.49984C2.881 16.427 2.28751 16.1812 1.84992 15.7436C1.41234 15.306 1.1665 14.7125 1.1665 14.0937C1.1665 13.4748 1.41234 12.8813 1.84992 12.4437C2.28751 12.0062 2.881 11.7603 3.49984 11.7603H3.60484C3.991 11.7513 4.36551 11.6263 4.67969 11.4016C4.99386 11.1769 5.23317 10.8629 5.3665 10.5003C5.52181 10.1484 5.56813 9.7581 5.49951 9.37964C5.43089 9.00118 5.25046 8.65195 4.9815 8.37699L4.9115 8.30699C4.69456 8.09029 4.52245 7.83295 4.40503 7.54969C4.28761 7.26642 4.22717 6.9628 4.22717 6.65616C4.22717 6.34952 4.28761 6.04589 4.40503 5.76263C4.52245 5.47937 4.69456 5.22203 4.9115 5.00533C5.12821 4.78838 5.38555 4.61628 5.66881 4.49885C5.95207 4.38143 6.2557 4.32099 6.56234 4.32099C6.86897 4.32099 7.1726 4.38143 7.45587 4.49885C7.73913 4.61628 7.99647 4.78838 8.21317 5.00533L8.28317 5.07533C8.55813 5.34429 8.90736 5.52471 9.28582 5.59333C9.66428 5.66195 10.0546 5.61563 10.4065 5.46033H10.4998C10.8449 5.31244 11.1392 5.06687 11.3465 4.75387C11.5538 4.44086 11.665 4.07408 11.6665 3.69866V3.50033C11.6665 2.88149 11.9123 2.28799 12.3499 1.85041C12.7875 1.41282 13.381 1.16699 13.9998 1.16699C14.6187 1.16699 15.2122 1.41282 15.6498 1.85041C16.0873 2.28799 16.3332 2.88149 16.3332 3.50033V3.60533C16.3347 3.98074 16.4459 4.34753 16.6532 4.66054C16.8605 4.97354 17.1548 5.2191 17.4998 5.36699C17.8517 5.52229 18.2421 5.56862 18.6205 5.5C18.999 5.43138 19.3482 5.25095 19.6232 4.98199L19.6932 4.91199C19.9099 4.69505 20.1672 4.52294 20.4505 4.40552C20.7337 4.2881 21.0374 4.22766 21.344 4.22766C21.6506 4.22766 21.9543 4.2881 22.2375 4.40552C22.5208 4.52294 22.7781 4.69505 22.9948 4.91199C23.2118 5.1287 23.3839 5.38604 23.5013 5.6693C23.6187 5.95256 23.6792 6.25619 23.6792 6.56283C23.6792 6.86946 23.6187 7.17309 23.5013 7.45635C23.3839 7.73962 23.2118 7.99696 22.9948 8.21366L22.9248 8.28366C22.6559 8.55862 22.4755 8.90784 22.4068 9.28631C22.3382 9.66477 22.3845 10.0551 22.5398 10.407V10.5003C22.6877 10.8454 22.9333 11.1397 23.2463 11.347C23.5593 11.5543 23.9261 11.6655 24.3015 11.667H24.4998C25.1187 11.667 25.7122 11.9128 26.1498 12.3504C26.5873 12.788 26.8332 13.3815 26.8332 14.0003C26.8332 14.6192 26.5873 15.2127 26.1498 15.6502C25.7122 16.0878 25.1187 16.3337 24.4998 16.3337H24.3948C24.0194 16.3352 23.6526 16.4464 23.3396 16.6537C23.0266 16.861 22.7811 17.1553 22.6332 17.5003Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
              <defs>
                <clipPath id="clip0">
                  <rect width="28" height="28" fill="white" />
                </clipPath>
              </defs>
            </svg>
          </SvgIcon>
          Settings
        </NavLink>

        <NavLink to={`${rolePrefix}/help`} style={navItemStyle}>
          <SvgIcon>
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 28 26"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10.6052 9.75033C10.8795 9.0263 11.4208 8.41577 12.1334 8.02689C12.846 7.638 13.6839 7.49584 14.4985 7.6256C15.3132 7.75535 16.0521 8.14864 16.5844 8.73581C17.1167 9.32299 17.4081 10.0661 17.4068 10.8337C17.4068 13.0003 13.9068 14.0837 13.9068 14.0837M14.0002 18.417H14.0118M25.6668 13.0003C25.6668 18.9834 20.4435 23.8337 14.0002 23.8337C7.55684 23.8337 2.3335 18.9834 2.3335 13.0003C2.3335 7.01724 7.55684 2.16699 14.0002 2.16699C20.4435 2.16699 25.6668 7.01724 25.6668 13.0003Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </SvgIcon>
          Help
        </NavLink>

        <button style={styles.logoutBtn} onClick={handleLogout}>
          <span style={iconStyle}>
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 27 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10.125 21H5.625C5.02826 21 4.45597 20.7893 4.03401 20.4142C3.61205 20.0391 3.375 19.5304 3.375 19V5C3.375 4.46957 3.61205 3.96086 4.03401 3.58579C4.45597 3.21071 5.02826 3 5.625 3H10.125M18 17L23.625 12M23.625 12L18 7M23.625 12H10.125"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Logout
        </button>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <div style={styles.pageTitle}>{PageTitle()}</div>
            <div style={styles.subTitle}>
              {
                role === "sustainability_manager"
                  ? "Sustainability Dashboard"
                  : role === "soc_analyst"
                    ? "SOC Dashboard"
                    : role === "exhibitor"
                      ? "Exhibitor Portal"
                      : "Operations Dashboard"
              }
            </div>
          </div>

          <div style={styles.headerRight}>
            <div style={styles.searchWrap}>
              <input placeholder="Search here" style={styles.searchInput} />
              <span style={styles.searchIcon}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 15 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 11C8.76142 11 11 8.76142 11 6C11 3.23858 8.76142 1 6 1C3.23858 1 1 3.23858 1 6C1 8.76142 3.23858 11 6 11Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 15L9 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
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
    color: "#D55F5A",
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 10,
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