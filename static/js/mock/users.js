/**
 * mock/users.js — demonstration accounts only.
 * Real authentication belongs to the platform team; the frontend
 * only needs enough shape here to demo role-based navigation.
 */

export const MOCK_USERS = [
  {
    id: "USR-1001",
    name: "Cyrus Ngugi",
    email: "cyrus@assurex.demo",
    password: "assurex123",
    role: "user",
    avatarInitials: "CN",
    joined: "2025-11-02",
  },
  {
    id: "USR-1002",
    name: "Amara Wekesa",
    email: "admin@assurex.demo",
    password: "assurex123",
    role: "admin",
    avatarInitials: "AW",
    joined: "2025-08-14",
  },
];

const REGISTERED_USERS_KEY = "assurex:registered-users";

function registeredUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(REGISTERED_USERS_KEY) || "[]");
    return Array.isArray(users) ? users : [];
  } catch (err) {
    return [];
  }
}

export function findUserByEmail(email) {
  const normalizedEmail = String(email).toLowerCase();
  return [...MOCK_USERS, ...registeredUsers()].find((u) => u.email.toLowerCase() === normalizedEmail);
}

export function registerUser({ name, email, phone, password }) {
  if (findUserByEmail(email)) throw new Error("An account with this email already exists.");
  const user = {
    id: `USR-${Date.now()}`,
    name,
    email: email.toLowerCase(),
    phone,
    password,
    role: "user",
    avatarInitials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    joined: new Date().toISOString().slice(0, 10),
  };
  try {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify([...registeredUsers(), user]));
  } catch (err) {
    throw new Error("We couldn't create your account in this browser. Please try again.");
  }
  return user;
}
