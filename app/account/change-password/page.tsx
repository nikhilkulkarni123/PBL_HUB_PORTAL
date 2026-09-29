import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ChangePassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const u = await getSession();
  if (!u) redirect('/login');
  const q = await searchParams;

  return (
    <section className="section">
      <div className="container">
        <div className="form">
          <h1>Change Password</h1>
          <p>You must change your temporary password before using the portal.</p>
          {q.error && <div className="notice error">{q.error}</div>}
          <form action="/api/account/change-password" method="post">
            <div className="field">
              <label>Current password</label>
              <input name="currentPassword" type="password" required />
            </div>
            <div className="field">
              <label>New password</label>
              <input name="newPassword" type="password" minLength={10} required />
              <small>Minimum 10 characters; use upper/lowercase, number and symbol.</small>
            </div>
            <div className="field">
              <label>Confirm new password</label>
              <input name="confirmPassword" type="password" minLength={10} required />
            </div>
            <button className="btn">Update Password</button>
          </form>
        </div>
      </div>
    </section>
  );
}
