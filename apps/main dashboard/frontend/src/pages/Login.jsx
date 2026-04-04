import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Login.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [flash, setFlash] = useState("");

  useEffect(() => {
    const msg = sessionStorage.getItem("loginFlash");
    if (msg) {
      setFlash(msg);
      sessionStorage.removeItem("loginFlash");
    }
  }, []);

  const validateEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Password cannot be empty.");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        email,
        password,
      });

      const { token, role, full_name, employee_id, email: accountEmail, last_active_at } = res.data;

      sessionStorage.setItem("token", token);
      window.dispatchEvent(new Event("sentina:login"));
      sessionStorage.setItem("role", role);
      sessionStorage.setItem("full_name", full_name);
      sessionStorage.setItem("employee_id", employee_id);
      sessionStorage.setItem("email", accountEmail || email);
      if (last_active_at) {
        sessionStorage.setItem("last_login", last_active_at);
      }

      switch (role) {
        case "super_admin":
          navigate("/admin");
          break;

        case "operations_manager":
          navigate("/operations");
          break;

        case "soc_analyst":
          navigate("/soc");
          break;

        case "sustainability_manager":
          navigate("/sustainability");
          break;

        case "exhibitor":
          navigate("/exhibitor");
          break;

        default:
          navigate("/");
      }
    } catch (err) {
      const backendMessage =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Invalid email or password.";

      if (Array.isArray(backendMessage)) {
        setError(backendMessage.join(" "));
      } else {
        setError(backendMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (error) setError("");
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (error) setError("");
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-title">SentinaAI</div>

        {flash && (
          <div
            style={{
              padding: "10px",
              marginBottom: "12px",
              borderRadius: "10px",
              background: "#fff7ed",
              border: "1px solid #fdba74",
              fontWeight: 700,
            }}
          >
            {flash}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            className="login-input"
            value={email}
            onChange={handleEmailChange}
          />

          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="login-input"
              value={password}
              onChange={handlePasswordChange}
            />

            <span
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </span>
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  );
}
