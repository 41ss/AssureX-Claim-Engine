/**
 * pages/login.js
 * Handles the login form only: client-side validation, loading/error
 * states, and role-based redirect after a successful session is
 * returned by authService. Authentication itself is the platform
 * team's responsibility.
 */
import { authService } from "../services/authService.js";
import { icon } from "../components/icons.js";
import { isRequired, isValidEmail } from "../utils/validators.js";

const form = document.getElementById("login-form");
const submitBtn = document.getElementById("login-submit");
const alertSlot = document.getElementById("form-alert");
const togglePasswordBtn = document.getElementById("toggle-password");
const passwordInput = document.getElementById("password");

// Already signed in? Skip straight to the right dashboard.
const existing = authService.getSession();
if (existing) {
  window.location.href = existing.role === "admin" ? "/admin-dashboard" : "/dashboard";
}

togglePasswordBtn.innerHTML = icon("eye", { size: 16 });
let passwordVisible = false;
togglePasswordBtn.addEventListener("click", () => {
  passwordVisible = !passwordVisible;
  passwordInput.type = passwordVisible ? "text" : "password";
  togglePasswordBtn.innerHTML = icon(passwordVisible ? "eye-off" : "eye", { size: 16 });
});

document.getElementById("forgot-link").addEventListener("click", (e) => {
  e.preventDefault();
  showAlert("info", "Password reset isn't wired up in this demo. Contact your administrator, or check back once the platform module is connected.");
});

function showAlert(type, message) {
  alertSlot.innerHTML = `
    <div class="alert alert--${type}" style="margin-bottom:var(--space-5)">
      ${icon(type === "danger" ? "alert-triangle" : "info", { size: 18 })}
      <div>${message}</div>
    </div>`;
}

function clearFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  field.classList.remove("has-error");
}

function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  field.classList.add("has-error");
  field.querySelector(".field__error").textContent = message;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  alertSlot.innerHTML = "";
  clearFieldError("field-email");
  clearFieldError("field-password");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const remember = document.getElementById("remember-me").checked;

  let hasError = false;
  if (!isRequired(email)) { setFieldError("field-email", "Email is required."); hasError = true; }
  else if (!isValidEmail(email)) { setFieldError("field-email", "Enter a valid email address."); hasError = true; }
  if (!isRequired(password)) { setFieldError("field-password", "Password is required."); hasError = true; }
  if (hasError) return;

  submitBtn.classList.add("is-loading");
  submitBtn.disabled = true;

  try {
    const session = await authService.login(email, password);
    authService.saveSession(session, remember);
    window.location.href = session.role === "admin" ? "/admin-dashboard" : "/dashboard";
  } catch (err) {
    showAlert("danger", err.message || "Something went wrong while connecting to ASSUREX.");
    submitBtn.classList.remove("is-loading");
    submitBtn.disabled = false;
  }
});
