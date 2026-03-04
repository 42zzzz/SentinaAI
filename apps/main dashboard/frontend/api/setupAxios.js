import axios from "axios";

// (Optional) You can set this, but your code already uses API_BASE everywhere.
// axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

axios.defaults.withCredentials = true;

// ✅ Attach token automatically to EVERY request
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Catch SESSION_EXPIRED and force logout + redirect
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const data = err?.response?.data;

    if (status === 401 && data?.error === "SESSION_EXPIRED") {
      // wipe auth info
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("full_name");
      localStorage.removeItem("employee_id");

      // save one-time message for login screen
      sessionStorage.setItem("loginFlash", "Logged out due to inactivity.");

      // redirect to login route (your login is "/")
      window.location.href = "/";
      return;
    }

    return Promise.reject(err);
  }
);