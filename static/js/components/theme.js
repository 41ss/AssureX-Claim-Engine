import { icon } from "./icons.js";

const THEME_KEY = "assurex:theme";

function storedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "light";
  } catch (err) {
    return "light";
  }
}

function updateToggle(toggle, theme) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  toggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
  toggle.setAttribute("title", `Switch to ${nextTheme} mode`);
  toggle.setAttribute("aria-pressed", String(theme === "dark"));
  toggle.innerHTML = icon(theme === "dark" ? "sun" : "moon", { size: 18 });
}

export function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  try {
    localStorage.setItem(THEME_KEY, nextTheme);
  } catch (err) {
    // Keep the current page usable when storage is unavailable.
  }
  document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => updateToggle(toggle, nextTheme));
}

export function wireThemeToggle() {
  document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => {
    if (toggle.dataset.themeWired) return;
    toggle.dataset.themeWired = "true";
    toggle.addEventListener("click", () => {
      const currentTheme = document.documentElement.dataset.theme || storedTheme();
      applyTheme(currentTheme === "dark" ? "light" : "dark");
    });
    updateToggle(toggle, document.documentElement.dataset.theme || storedTheme());
  });
}

applyTheme(document.documentElement.dataset.theme || storedTheme());
