import { requireAnyRole } from '@/lib/auth';
import { pool } from '@/lib/db';
import { parseCSV } from '@/lib/csv';
import { buildStudentInitialPassword, normalizeDob } from '@/lib/student-password';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export async function POST(req:Request){
  const hod=await requireAnyRole(['HOD']);
  if(!hod)return new Response('Unauthorized',{status:401});
  const fd=await req.formData();
  const file=fd.get('file');
  if(!(file instanceof File))return new Response('CSV file required',{status:400});
  const rows=parseCSV(await file.text());
  const c=await pool.connect();
  let ok=0,fail=0;
  const generated:string[]=[];
  try{
    await c.query('BEGIN');
    const role=(await c.query("SELECT id FROM roles_v2 WHERE code='STUDENT'")).rows[0].id;
    const prog=(await c.query("SELECT id FROM programs_v2 WHERE code='CSE'")).rows[0].id;
    for(const r of rows){
      try{
        const usn=(r['Usn']||r['USN']||'').trim().toUpperCase();
        const name=(r['Name']||r['NAME']||'').trim();
        const cycleName=(r['Academic Year']||'2026-27').trim();
        const sem=Number(r['Sem']);
        let section=(r['Section']||'').trim().toUpperCase();
        const mother=(r['Mother']||r['Mother Name']||'').trim();
        const dobRaw=(r['DoB']||r['DOB']||r['Date of Birth']||'').trim();
        if(!usn||!name||!cycleName||!sem||!section)throw new Error('Required values missing');
        if(sem===7 && section.startsWith('CS3')) section=`CS4${section.slice(-1)}`;
        const dob=normalizeDob(dobRaw)?.iso||null;
        const pw=buildStudentInitialPassword(dob,mother);

        let cyc=(await c.query('SELECT id FROM academic_cycles_v2 WHERE name=$1',[cycleName])).rows[0];
        if(!cyc)cyc=(await c.query('INSERT INTO academic_cycles_v2(name,season) VALUES($1,$2) RETURNING id',[cycleName,r['Season']||null])).rows[0];
        let sec=(await c.query('SELECT id FROM sections_v2 WHERE program_id=$1 AND academic_cycle_id=$2 AND semester=$3 AND code=$4',[prog,cyc.id,sem,section])).rows[0];
        if(!sec)sec=(await c.query('INSERT INTO sections_v2(program_id,academic_cycle_id,semester,code) VALUES($1,$2,$3,$4) RETURNING id',[prog,cyc.id,sem,section])).rows[0];
        let pc=(await c.query('SELECT id FROM pbl_cycles_v2 WHERE academic_cycle_id=$1 AND program_id=$2 AND semester=$3',[cyc.id,prog,sem])).rows[0];
        if(!pc)pc=(await c.query("INSERT INTO pbl_cycles_v2(academic_cycle_id,program_id,semester,team_min_size,team_max_size,status) VALUES($1,$2,$3,4,6,'DRAFT') RETURNING id",[cyc.id,prog,sem])).rows[0];

        const mentor=(await c.query('SELECT id FROM faculty_v2 WHERE employee_id=$1',[r['Mentor Id']||''])).rows[0]?.id||null;
        let stu=(await c.query('SELECT id,user_id FROM students_v2 WHERE usn=$1',[usn])).rows[0];
        if(stu){
          await c.query('UPDATE students_v2 SET name=$1,mentor_faculty_id=$2,date_of_birth=$3,mother_name=$4 WHERE id=$5',[name,mentor,dob,mother||null,stu.id]);
          await c.query('UPDATE users_v2 SET display_name=$1,is_active=$2 WHERE id=$3',[name,!!pw,stu.user_id]);
          if(pw){const h=await bcrypt.hash(pw,12);await c.query('UPDATE users_v2 SET password_hash=$1,must_change_password=true,password_changed_at=NULL WHERE id=$2',[h,stu.user_id]);}
        }else{
          const internal=pw||`${crypto.randomBytes(8).toString('base64url')}@LOCKED`;
          const h=await bcrypt.hash(internal,12);
          const u=(await c.query('INSERT INTO users_v2(username,password_hash,display_name,must_change_password,is_active) VALUES($1,$2,$3,true,$4) RETURNING id',[usn.toLowerCase(),h,name,!!pw])).rows[0];
          stu=(await c.query('INSERT INTO students_v2(user_id,usn,name,mentor_faculty_id,date_of_birth,mother_name) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,user_id',[u.id,usn,name,mentor,dob,mother||null])).rows[0];
          await c.query('INSERT INTO user_roles_v2(user_id,role_id) VALUES($1,$2)',[u.id,role]);
        }
        generated.push(pw?`${usn} — ${name}: ${pw}`:`${usn} — ${name}: DOB REQUIRED (account inactive)`);

        await c.query(`INSERT INTO student_enrollments_v2(student_id,academic_cycle_id,program_id,semester,section_id,scheme,year_of_study)
          VALUES($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT(student_id,academic_cycle_id,semester) DO UPDATE SET section_id=EXCLUDED.section_id,scheme=EXCLUDED.scheme,year_of_study=EXCLUDED.year_of_study`,
          [stu.id,cyc.id,prog,sem,sec.id,Number(r['Scheme'])||null,Number(r['Year'])||null]);
        ok++;
      }catch{fail++;}
    }
    await c.query("INSERT INTO import_batches_v2(import_type,file_name,imported_by,total_rows,success_rows,failed_rows) VALUES('STUDENT',$1,$2,$3,$4,$5)",[file.name,hod.id,rows.length,ok,fail]);
    await c.query('COMMIT');
    return new Response(html('Student import complete',ok,fail,generated),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
  }catch(e){
    await c.query('ROLLBACK');
    return new Response(e instanceof Error?e.message:'Import failed',{status:400});
  }finally{c.release();}
}

function html(title:string,ok:number,fail:number,g:string[]){return `<!doctype html><meta charset="utf-8"><style>body{font-family:system-ui;max-width:900px;margin:40px auto;padding:20px}code{display:block;padding:6px;background:#eee}</style><h1>${title}</h1><p>Success: ${ok}; Failed: ${fail}</p>${g.length?'<h2>Student account status</h2><p>Initial password rule: m + MMDD + first meaningful mother name. Missing DOB accounts remain inactive.</p>'+g.map(x=>`<code>${x}</code>`).join(''):'<p>No rows were processed.</p>'}<p><a href="/hod/imports">Back to imports</a></p>`}
