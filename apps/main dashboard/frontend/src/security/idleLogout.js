const DEFAULT_IDLE_MS = 20 * 60 * 1000; // 20 mins
//const DEFAULT_IDLE_MS = 10 * 1000; // 10 secs for testing

let timer = null;
let idleMs = DEFAULT_IDLE_MS;

const SESSION_KEYS = ["token", "role", "full_name", "employee_id", "email", "last_login"];

function isAuthenticated() {
  return !!sessionStorage.getItem("token");
}

function clearSession() {
  SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
}

function doLogout() {
  clearSession();
  sessionStorage.setItem("loginFlash", "Logged out due to inactivity.");
  window.location.assign("/");
}

export function markActivity() {
  if (!isAuthenticated()) return;

  if (timer) clearTimeout(timer);
  timer = setTimeout(doLogout, idleMs);
}

export function setIdleTimeoutMs(ms) {
  idleMs = ms;
  markActivity();
}

export function initIdleLogout() {
  const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
  events.forEach((e) => window.addEventListener(e, markActivity, { passive: true }));
  window.addEventListener("focus", markActivity);

  window.addEventListener("storage", (e) => {
    if (e.key === "token" && e.newValue) {
      markActivity(); // start the timer once right after login
    }
  });

  window.addEventListener("sentina:login", markActivity);

  if (isAuthenticated()) markActivity();
}
