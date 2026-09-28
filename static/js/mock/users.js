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

export function findUserByEmail(email) {
  return MOCK_USERS.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
}
