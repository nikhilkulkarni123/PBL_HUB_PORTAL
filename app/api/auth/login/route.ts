import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { createSession, Role } from "@/lib/auth";

type U={id:number;username:string;password_hash:string;display_name:string;must_change_password:boolean;faculty_id:number|null;student_id:number|null;roles:string[]};
export async function POST(req:Request){
  const f=await req.formData();
  const username=String(f.get('username')||'').trim().toLowerCase();
  const password=String(f.get('password')||'');
  const ip=(req.headers.get('x-forwarded-for')||req.headers.get('x-real-ip')||'').split(',')[0].trim().slice(0,100);
  const recent=(await query<{n:number}>(`SELECT COUNT(*)::int n FROM login_attempts_v2 WHERE username=$1 AND succeeded=false AND attempted_at>NOW()-INTERVAL '15 minutes'`,[username]))[0]?.n||0;
  if(recent>=5) return NextResponse.redirect(new URL('/login?locked=1',req.url),303);
  const u=(await query<U>(`SELECT u.id,u.username,u.password_hash,u.display_name,u.must_change_password,
    f.id faculty_id,s.id student_id,COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL),'{}') roles
    FROM users_v2 u
    LEFT JOIN faculty_v2 f ON f.user_id=u.id LEFT JOIN students_v2 s ON s.user_id=u.id
    LEFT JOIN user_roles_v2 ur ON ur.user_id=u.id LEFT JOIN roles_v2 r ON r.id=ur.role_id
    WHERE lower(u.username)=$1 AND u.is_active=true GROUP BY u.id,f.id,s.id`,[username]))[0];
  const valid=!!u&&await bcrypt.compare(password,u.password_hash);
  await query(`INSERT INTO login_attempts_v2(username,ip_address,succeeded) VALUES($1,$2,$3)`,[username,ip||null,valid]);
  if(!valid)return NextResponse.redirect(new URL('/login?error=1',req.url),303);

  const changedCount=(await query<{n:number}>(`SELECT COUNT(*)::int n FROM audit_logs_v2 WHERE user_id=$1 AND action='PASSWORD_CHANGED'`,[u.id]))[0]?.n||0;
  const hasEverChangedPassword=changedCount>0;
  const mustChange=Boolean(u.must_change_password||!hasEverChangedPassword);

  await query(`UPDATE users_v2 SET last_login_at=NOW(), must_change_password=$1 WHERE id=$2`,[mustChange,u.id]);
  await createSession({id:u.id,username:u.username,displayName:u.display_name,roles:u.roles as Role[],facultyId:u.faculty_id||undefined,studentId:u.student_id||undefined,mustChangePassword:mustChange});
  return NextResponse.redirect(new URL(mustChange?'/account/change-password':'/dashboard',req.url),303);
}
