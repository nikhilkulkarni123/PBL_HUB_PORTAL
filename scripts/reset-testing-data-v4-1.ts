import { pool } from '../lib/db';

async function main(){
  if(process.env.CONFIRM_PRODUCTION_RESET!=='YES'){
    throw new Error('Refusing destructive reset. Set CONFIRM_PRODUCTION_RESET=YES after confirming this is the V4 testing database.');
  }
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    const oldStudentUsers=(await c.query(`SELECT DISTINCT user_id FROM students_v2 WHERE user_id IS NOT NULL`)).rows.map(r=>Number(r.user_id));

    // All academic workflow rows in V4 are treated as testing data for the production reset.
    await c.query(`TRUNCATE TABLE
      rubric_pdf_access_log_v4,
      team_review_submission_items_v4,
      team_review_submissions_v4,
      review_file_requirements_v4,
      notifications_v3,
      review_verification_actions_v3,
      student_contributions_v3,
      team_rubric_scores_v3,
      review_evaluations_v3,
      review_scores_v2,
      rubric_levels_v2,
      rubric_items_v2,
      rubric_imports_v2,
      rubrics_v2,
      pbl_reviews_v2,
      project_allocations_v2,
      guide_requests_v2,
      project_applications_v2,
      projects_v2,
      team_members_v2,
      teams_v2,
      faculty_semester_guide_limits_v2,
      faculty_guide_limits_v2,
      pbl_coordinator_assignments_v2,
      pbl_cycles_v2,
      student_enrollments_v2,
      sections_v2,
      students_v2,
      password_reset_requests_v2,
      import_batches_v2,
      audit_logs_v2,
      login_attempts_v2
      RESTART IDENTITY`);

    if(oldStudentUsers.length){
      await c.query(`DELETE FROM user_roles_v2 WHERE user_id = ANY($1::bigint[])`,[oldStudentUsers]);
      await c.query(`DELETE FROM users_v2 WHERE id = ANY($1::bigint[])`,[oldStudentUsers]);
    }

    // PBL Coordinator assignments/roles in the test version are not production assignments.
    await c.query(`DELETE FROM user_roles_v2 ur USING roles_v2 r
      WHERE ur.role_id=r.id AND r.code='PBL_COORDINATOR'`);

    await c.query('COMMIT');
    console.log(`V4.1 testing-data reset complete. Removed ${oldStudentUsers.length} student login users; faculty master retained.`);
  }catch(e){
    await c.query('ROLLBACK');
    throw e;
  }finally{
    c.release();
    await pool.end();
  }
}
main().catch(e=>{console.error(e);process.exit(1)});
