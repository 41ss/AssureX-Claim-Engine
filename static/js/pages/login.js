/**
 * pages/login.js
 * Handles the login form only: client-side validation, loading/error
 * states, and role-based redirect after a successful session is
 * returned by authService. Authentication itself is the platform
 * team's responsibility.
 */
import { authService } from "../services/authService.js";
import { isStaff } from "../utils/claimOptions.js";
import { icon } from "../components/icons.js";
import { isRequired, isValidEmail } from "../utils/validators.js";

const form = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const submitBtn = document.getElementById("login-submit");
const registerSubmitBtn = document.getElementById("register-submit");
const alertSlot = document.getElementById("form-alert");
const togglePasswordBtn = document.getElementById("toggle-password");
const passwordInput = document.getElementById("password");
const registerLink = document.getElementById("register-link");
const authSwitch = document.getElementById("auth-switch");
const authDemo = document.getElementById("auth-demo");

// Demo account buttons fill the form; signing in stays a deliberate click.
authDemo?.querySelectorAll("[data-demo-email]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById("email").value = btn.dataset.demoEmail;
    document.getElementById("password").value = btn.dataset.demoPassword;
    document.getElementById("password").focus();
  });
});
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");

// Already signed in? Skip straight to the right dashboard.
const existing = authService.getSession();
if (existing) {
  window.location.href = isStaff(existing.role) ? "/admin-dashboard" : "/dashboard";
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
    window.location.href = isStaff(session.role) ? "/admin-dashboard" : "/dashboard";
  } catch (err) {
    showAlert("danger", err.message || "Something went wrong while connecting to ASSUREX.");
    submitBtn.classList.remove("is-loading");
    submitBtn.disabled = false;
  }
});

registerLink.addEventListener("click", (e) => {
  e.preventDefault();
  form.hidden = true;
  registerForm.hidden = false;
  authDemo.hidden = true;
  authTitle.textContent = "Create your account";
  authSubtitle.textContent = "Register to manage and track your claims.";
  authSwitch.innerHTML = 'Already have an account? <a href="#" id="login-link" style="color:var(--text-link);font-weight:600">Sign in</a>';
  document.getElementById("login-link").addEventListener("click", switchToLogin);
});

function switchToLogin(e) {
  e.preventDefault();
  registerForm.hidden = true;
  form.hidden = false;
  authDemo.hidden = false;
  authTitle.textContent = "Welcome back";
  authSubtitle.textContent = "Sign in to continue to your claims.";
  authSwitch.innerHTML = 'Don\'t have an account? <a href="#" id="register-link" style="color:var(--text-link);font-weight:600">Create one</a>';
  document.getElementById("register-link").addEventListener("click", (event) => {
    event.preventDefault();
    registerForm.hidden = false;
    form.hidden = true;
    authDemo.hidden = true;
    authTitle.textContent = "Create your account";
    authSubtitle.textContent = "Register to manage and track your claims.";
    authSwitch.innerHTML = 'Already have an account? <a href="#" id="login-link" style="color:var(--text-link);font-weight:600">Sign in</a>';
    document.getElementById("login-link").addEventListener("click", switchToLogin);
  });
}

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  alertSlot.innerHTML = "";
  ["name", "email", "phone", "password", "confirm-password", "terms"].forEach((field) => clearFieldError(`field-register-${field}`));

  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const phone = document.getElementById("register-phone").value.trim();
  const password = document.getElementById("register-password").value;
  const confirmPassword = document.getElementById("register-confirm-password").value;
  const termsAccepted = document.getElementById("register-terms").checked;
  let hasError = false;

  if (!isRequired(name)) { setFieldError("field-register-name", "Full name is required."); hasError = true; }
  if (!isRequired(email)) { setFieldError("field-register-email", "Email is required."); hasError = true; }
  else if (!isValidEmail(email)) { setFieldError("field-register-email", "Enter a valid email address."); hasError = true; }
  if (!isRequired(phone)) { setFieldError("field-register-phone", "Phone number is required."); hasError = true; }
  else if (phone.replace(/\D/g, "").length < 7) { setFieldError("field-register-phone", "Enter a valid phone number."); hasError = true; }
  if (password.length < 8) { setFieldError("field-register-password", "Password must be at least 8 characters."); hasError = true; }
  if (password !== confirmPassword) { setFieldError("field-register-confirm-password", "Passwords do not match."); hasError = true; }
  if (!termsAccepted) { setFieldError("field-register-terms", "You must accept the terms to continue."); hasError = true; }
  if (hasError) return;

  registerSubmitBtn.classList.add("is-loading");
  registerSubmitBtn.disabled = true;
  try {
    const role = document.getElementById("register-role").value;
    const session = await authService.register({ name, email, phone, password, role });
    authService.saveSession(session, true);
    window.location.href = "/dashboard";
  } catch (err) {
    showAlert("danger", err.message || "Something went wrong while creating your account.");
    registerSubmitBtn.classList.remove("is-loading");
    registerSubmitBtn.disabled = false;
  }
});
