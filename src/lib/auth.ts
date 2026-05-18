/**
 * Trivial single-password admin gate. Good enough for an internal tool.
 * Replace with NextAuth/SSO when needed.
 */
import { cookies } from "next/headers";

export const AUTH_COOKIE = "leados_auth";

export async function isAuthenticated(): Promise<boolean> {
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw) return true; // dev mode: open
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value === adminPw;
}

export function checkPassword(input: string): boolean {
  return !!process.env.ADMIN_PASSWORD && input === process.env.ADMIN_PASSWORD;
}
