const IDLE_TIMEOUT_MINUTES = 15;
const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000;

function idleTimeout(req, res, next) {
  // Only enforce for authenticated users (token cookie exists)
  const token = req.cookies?.token || req.cookies?.access_token;
  if (!token) return next();

  const now = Date.now();
  const last = Number(req.cookies?.last_activity || 0);

  // If we have a last activity timestamp and it's too old -> logout
  if (last && now - last > IDLE_TIMEOUT_MS) {
    // Clear cookies (adjust names to match your project)
    res.clearCookie("access_token");
    res.clearCookie("token");
    res.clearCookie("last_activity");

    return res.status(401).json({ error: "SESSION_EXPIRED" });
  }

  // Update activity timestamp cookie
  res.cookie("last_activity", String(now), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Cookie should live a bit longer than idle window (so it doesn't vanish too soon)
    maxAge: IDLE_TIMEOUT_MS + 5 * 60 * 1000
  });

  next();
}

module.exports = idleTimeout;