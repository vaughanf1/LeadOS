import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AUTH_COOKIE, checkPassword } from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";
  const pw = String(formData.get("password") ?? "");
  if (!checkPassword(pw)) redirect("/login?error=1");
  const jar = await cookies();
  jar.set(AUTH_COOKIE, pw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/dashboard");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form action={loginAction} className="card w-full max-w-sm">
        <div className="card-body space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">LeadOS</h1>
            <p className="text-sm text-ink-muted mt-1">Sign in to continue</p>
          </div>
          <div>
            <label className="label">Admin password</label>
            <input
              name="password"
              type="password"
              autoFocus
              required
              className="input"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div className="text-sm text-danger">Incorrect password.</div>
          )}
          <button type="submit" className="btn-primary w-full justify-center">
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
