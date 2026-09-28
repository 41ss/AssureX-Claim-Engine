/**
 * toast.js — transient success/error notices in the bottom-right corner.
 * Usage: showToast("Claim submitted", "success")
 */
import { icon } from "./icons.js";

function ensureStack() {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  return stack;
}

export function showToast(message, type = "success", duration = 3800) {
  const stack = ensureStack();
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  const iconName = type === "success" ? "check-circle-2" : type === "error" ? "x-circle" : "info";
  el.innerHTML = `${icon(iconName, { size: 18 })}<span>${message}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 200ms ease";
    setTimeout(() => el.remove(), 220);
  }, duration);
}
