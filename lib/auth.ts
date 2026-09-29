import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";

export type Role = "HOD" | "PBL_COORDINATOR" | "FACULTY" | "STUDENT";
export type SessionUser = {
  id: number;
  username: string;
  displayName: string;
  roles: Role[];
  facultyId?: number;
  studentId?: number;
  mustChangePassword?: boolean;
};

const COOKIE = "falcon_pbl_session";
const secret = new TextEncoder().encode(process.env.SESSION_SECRET || "development-only-change-this-secret");

export async function createSession(user: SessionUser) {
  const token = await new SignJWT(user).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(secret);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function destroySession() { (await cookies()).delete(COOKIE); }

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, secret); return payload as unknown as SessionUser; }
  catch { return null; }
}

export async function requireAnyRole(roles: Role[]) {
  const user = await getSession();
  if (!user || !user.roles.some(r => roles.includes(r))) return null;
  if (user.mustChangePassword) {
    redirect('/account/change-password');
  }
  return user;
}

export function hasRole(user: SessionUser | null, role: Role) { return !!user?.roles.includes(role); }
