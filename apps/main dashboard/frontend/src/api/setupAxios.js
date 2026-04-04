import axios from "axios";

const SESSION_KEYS = ["token", "role", "full_name", "employee_id", "email", "last_login"];

function clearSession() {
  SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
}

//Request interceptor: attach token + count API calls as activity
axios.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle session expiry
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const code = err?.response?.data?.error;

    if (status === 401 && code === "SESSION_EXPIRED") {
      clearSession();
      sessionStorage.setItem("loginFlash", "Logged out due to inactivity.");
      window.location.assign("/");
    }

    return Promise.reject(err);
  }
);
