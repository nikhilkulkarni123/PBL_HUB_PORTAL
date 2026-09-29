import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../lib/db';
import { buildStudentInitialPassword, normalizeDob } from '../lib/student-password';

type FacultySeed={employee_id:string;name:string;email?:string|null;phone?:string|null;source:string};
type StudentSeed={academic_year:string;season:string;usn:string;name:string;year?:number;semester:number;section:string;scheme?:number;mentor_id?:string|null;mother_name?:string|null;date_of_birth?:string|null};
type Seed={faculty:FacultySeed[];students:StudentSeed[];defaults:any};
const seed:Seed=JSON.parse(fs.readFileSync(path.join(process.cwd(),'seed-data','institution_seed.json'),'utf8'));
const credentials:string[]=['role,user_id,name,temporary_password,must_change,status'];
const qcsv=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`;

function randomTemporaryPassword(){return `${crypto.randomBytes(6).toString('base64url')}@1aA`;}
async function roleId(code:string){return (await pool.query('SELECT id FROM roles_v2 WHERE code=$1',[code])).rows[0].id as number;}

async function ensureFacultyUser(username:string,displayName:string,email:string|null,phone:string|null,roleLabel:string){
  const existing=(await pool.query('SELECT id FROM users_v2 WHERE username=$1',[username])).rows[0];
  if(existing){
    await pool.query(`UPDATE users_v2 SET display_name=$1,email=COALESCE($2,email),phone=COALESCE($3,phone),updated_at=NOW() WHERE id=$4`,[displayName,email,phone,existing.id]);
    return {id:Number(existing.id),isNew:false};
  }
  const pw=randomTemporaryPassword();
  const hash=await bcrypt.hash(pw,12);
  const u=(await pool.query(`INSERT INTO users_v2(username,password_hash,display_name,email,phone,must_change_password,is_active) VALUES($1,$2,$3,$4,$5,true,true) RETURNING id`,[username,hash,displayName,email,phone])).rows[0];
  credentials.push([roleLabel,username,displayName,pw,'YES','READY'].map(qcsv).join(','));
  return {id:Number(u.id),isNew:true};
}

async function ensureStudentUser(s:StudentSeed){
  const username=s.usn.toLowerCase();
  const existing=(await pool.query('SELECT id FROM users_v2 WHERE username=$1',[username])).rows[0];
  const pw=buildStudentInitialPassword(s.date_of_birth||null,s.mother_name||null);
  const active=!!pw;
  if(existing){
    await pool.query(`UPDATE users_v2 SET display_name=$1,is_active=$2,updated_at=NOW() WHERE id=$3`,[s.name,active,existing.id]);
    if(pw){
      const hash=await bcrypt.hash(pw,12);
      await pool.query(`UPDATE users_v2 SET password_hash=$1,must_change_password=true,password_changed_at=NULL WHERE id=$2`,[hash,existing.id]);
    }
    return {id:Number(existing.id),password:pw};
  }
  // When DOB is unavailable we create an inactive placeholder login so the student can still be enrolled and assigned to a team.
  const hash=await bcrypt.hash(pw||randomTemporaryPassword(),12);
  const u=(await pool.query(`INSERT INTO users_v2(username,password_hash,display_name,must_change_password,is_active) VALUES($1,$2,$3,true,$4) RETURNING id`,[username,hash,s.name,active])).rows[0];
  credentials.push(['STUDENT',username,s.name,pw||'','YES',active?'READY':'DOB REQUIRED'].map(qcsv).join(','));
  return {id:Number(u.id),password:pw};
}

async function main(){
  await pool.query(`INSERT INTO roles_v2(code,name) VALUES
    ('HOD','Head of Department'),('PBL_COORDINATOR','PBL Coordinator'),('FACULTY','Faculty'),('STUDENT','Student')
    ON CONFLICT(code) DO NOTHING`);
  const cycle=(await pool.query(`INSERT INTO academic_cycles_v2(name,season,is_active) VALUES($1,$2,true)
    ON CONFLICT(name) DO UPDATE SET season=EXCLUDED.season RETURNING id`,[seed.defaults.academic_cycle,seed.defaults.season])).rows[0].id;
  const program=(await pool.query(`INSERT INTO programs_v2(code,name,department) VALUES($1,$2,$3)
    ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,department=EXCLUDED.department RETURNING id`,[seed.defaults.program_code,seed.defaults.program_name,seed.defaults.department])).rows[0].id;
  const facRole=await roleId('FACULTY'),stuRole=await roleId('STUDENT'),hodRole=await roleId('HOD');
  const facultyIds=new Map<string,number>();

  for(const f of seed.faculty){
    const username=f.employee_id.toLowerCase();
    const u=await ensureFacultyUser(username,f.name,f.email||null,f.phone||null,f.employee_id===seed.defaults.hod_employee_id?'FACULTY+HOD':'FACULTY');
    const fr=(await pool.query(`INSERT INTO faculty_v2(user_id,employee_id,name,email,phone,department,source)
      VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(employee_id) DO UPDATE SET user_id=EXCLUDED.user_id,name=EXCLUDED.name,email=COALESCE(EXCLUDED.email,faculty_v2.email),phone=COALESCE(EXCLUDED.phone,faculty_v2.phone),source=EXCLUDED.source
      RETURNING id`,[u.id,f.employee_id,f.name,f.email||null,f.phone||null,seed.defaults.department,f.source])).rows[0];
    facultyIds.set(f.employee_id,Number(fr.id));
    await pool.query('INSERT INTO user_roles_v2(user_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[u.id,facRole]);
    if(f.employee_id===seed.defaults.hod_employee_id)await pool.query('INSERT INTO user_roles_v2(user_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[u.id,hodRole]);
  }

  const semesters=[...new Set(seed.students.map(s=>Number(s.semester)))].sort((a,b)=>a-b);
  for(const sem of semesters){
    await pool.query(`INSERT INTO pbl_cycles_v2(academic_cycle_id,program_id,semester,team_min_size,team_max_size,status)
      VALUES($1,$2,$3,$4,$5,'DRAFT') ON CONFLICT(academic_cycle_id,program_id,semester) DO UPDATE SET team_min_size=EXCLUDED.team_min_size, team_max_size=EXCLUDED.team_max_size`,[cycle,program,sem,seed.defaults.team_min_size,seed.defaults.team_max_size]);
  }

  const sectionIds=new Map<string,number>();
  for(const key of [...new Set(seed.students.map(s=>`${s.semester}|${s.section}`))]){
    const [sem,code]=key.split('|');
    const sec=(await pool.query(`INSERT INTO sections_v2(program_id,academic_cycle_id,semester,code) VALUES($1,$2,$3,$4)
      ON CONFLICT(program_id,academic_cycle_id,semester,code) DO UPDATE SET code=EXCLUDED.code RETURNING id`,[program,cycle,Number(sem),code])).rows[0];
    sectionIds.set(key,Number(sec.id));
  }

  for(const s of seed.students){
    const u=await ensureStudentUser(s);
    const mentor=facultyIds.get(String(s.mentor_id||''))||null;
    const dob=normalizeDob(s.date_of_birth||null)?.iso||null;
    const st=(await pool.query(`INSERT INTO students_v2(user_id,usn,name,mentor_faculty_id,date_of_birth,mother_name) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(usn) DO UPDATE SET user_id=EXCLUDED.user_id,name=EXCLUDED.name,mentor_faculty_id=EXCLUDED.mentor_faculty_id,date_of_birth=EXCLUDED.date_of_birth,mother_name=EXCLUDED.mother_name RETURNING id`,[u.id,s.usn,s.name,mentor,dob,s.mother_name||null])).rows[0];
    await pool.query('INSERT INTO user_roles_v2(user_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[u.id,stuRole]);
    await pool.query(`INSERT INTO student_enrollments_v2(student_id,academic_cycle_id,program_id,semester,section_id,scheme,year_of_study)
      VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(student_id,academic_cycle_id,semester) DO UPDATE SET section_id=EXCLUDED.section_id,scheme=EXCLUDED.scheme,year_of_study=EXCLUDED.year_of_study`,
      [st.id,cycle,program,Number(s.semester),sectionIds.get(`${s.semester}|${s.section}`),s.scheme||null,s.year||null]);
  }

  for(const fid of facultyIds.values()){
    await pool.query(`INSERT INTO faculty_guide_limits_v2(academic_cycle_id,faculty_id,overall_max_projects) VALUES($1,$2,$3)
      ON CONFLICT(academic_cycle_id,faculty_id) DO NOTHING`,[cycle,fid,seed.defaults.overall_guide_limit]);
    for(const sem of semesters){
      const pc=(await pool.query('SELECT id FROM pbl_cycles_v2 WHERE academic_cycle_id=$1 AND program_id=$2 AND semester=$3',[cycle,program,sem])).rows[0].id;
      await pool.query(`INSERT INTO faculty_semester_guide_limits_v2(pbl_cycle_id,faculty_id,max_projects) VALUES($1,$2,$3)
        ON CONFLICT(pbl_cycle_id,faculty_id) DO NOTHING`,[pc,fid,seed.defaults.semester_guide_limit]);
    }
  }

  const out=path.join(process.cwd(),'initial_credentials.csv');
  fs.writeFileSync(out,credentials.join('\n')+'\n');
  const ready=seed.students.filter(s=>buildStudentInitialPassword(s.date_of_birth||null,s.mother_name||null)).length;
  console.log(`V4.1 seed complete: ${seed.faculty.length} faculty, ${seed.students.length} students (${ready} login-ready, ${seed.students.length-ready} DOB-required).`);
  console.log(`Credentials written to: ${out}`);
  await pool.end();
}
main().catch(e=>{console.error(e);process.exit(1)});
