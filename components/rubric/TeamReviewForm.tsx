'use client';
import {useMemo,useState} from 'react';

type Level={id:number,label:string,marks:number,descriptor:string};
type Item={id:number,co_code:string,criterion_name:string,max_marks:number,levels:Level[]};
type Student={enrollment_id:number,usn:string,name:string,contribution_percent:number,correction_status?:string,hod_comment?:string};
export default function TeamReviewForm({reviewId,teamId,items,students,initialScores,status,returnScope,facultyRemarks}:{reviewId:number;teamId:number;items:Item[];students:Student[];initialScores:Record<string,number>;status:string;returnScope?:string|null;facultyRemarks?:string}){
 const [scores,setScores]=useState<Record<string,number>>(initialScores||{});
 const [contrib,setContrib]=useState<Record<string,number>>(Object.fromEntries(students.map(s=>[String(s.enrollment_id),Number(s.contribution_percent??100)])));
 const wholeEditable=status==='DRAFT'||(status==='RETURNED_FOR_CORRECTION'&&returnScope==='ENTIRE');
 const contributionEditable=(s:Student)=>status==='DRAFT'||(status==='RETURNED_FOR_CORRECTION'&&(returnScope==='ENTIRE'||s.correction_status==='RETURNED'));
 const teamByCO=useMemo(()=>{const out:Record<string,number>={}; for(const it of items){const lid=scores[String(it.id)];const lev=it.levels.find(l=>Number(l.id)===Number(lid));out[it.co_code]=(out[it.co_code]||0)+(lev?Number(lev.marks):0)} return out},[scores,items]);
 const coMax=useMemo(()=>{const o:Record<string,number>={};items.forEach(i=>o[i.co_code]=(o[i.co_code]||0)+Number(i.max_marks));return o},[items]);
 const teamTotal=Object.values(teamByCO).reduce((a,b)=>a+b,0); const totalMax=Object.values(coMax).reduce((a,b)=>a+b,0);
 if(!['DRAFT','RETURNED_FOR_CORRECTION'].includes(status)) return <div className="notice">This evaluation is read-only while its status is <b>{status}</b>.</div>;
 return <form action={`/api/faculty/reviews/${reviewId}/team/${teamId}/submit`} method="post">
  <h2>Step 1 — Team Rubric Evaluation</h2><p>Evaluate the project once for the entire team.</p>
  {items.map(it=><div className="card" key={it.id}><h3>{it.co_code} — {it.criterion_name} ({it.max_marks} marks)</h3>{it.levels.map(l=><label className="rubric-choice" key={l.id}><input disabled={!wholeEditable} required={wholeEditable} type="radio" name={`score_${it.id}`} value={l.id} checked={Number(scores[String(it.id)])===Number(l.id)} onChange={()=>setScores(x=>({...x,[String(it.id)]:l.id}))}/> <b>{l.label} — {l.marks}</b>: {l.descriptor}</label>)}</div>)}
  <div className="card"><h3>Team Rubric Result</h3>{Object.entries(teamByCO).map(([co,m])=><p key={co}><b>{co}:</b> {m.toFixed(2)} / {(coMax[co]||0).toFixed(2)}</p>)}<p><b>Total:</b> {teamTotal.toFixed(2)} / {totalMax.toFixed(2)}</p></div>
  <h2>Step 2 — Student Contribution Indicators</h2><p>Enter only the contribution indicator for each member. Individual marks are derived automatically from the team rubric marks.</p>
  <div className="tablewrap"><table><thead><tr><th>Student</th><th>USN</th><th>Contribution %</th>{Object.keys(coMax).map(co=><th key={co}>{co}</th>)}<th>Total</th><th>HoD comment</th></tr></thead><tbody>{students.map(s=>{const pct=Number(contrib[String(s.enrollment_id)]||0);return <tr key={s.enrollment_id}><td>{s.name}</td><td>{s.usn}</td><td><input style={{width:90}} name={`contribution_${s.enrollment_id}`} type="number" min="0" max="100" step="0.01" required value={pct} disabled={!contributionEditable(s)} onChange={e=>setContrib(x=>({...x,[String(s.enrollment_id)]:Math.max(0,Math.min(100,Number(e.target.value)))}))}/>{!contributionEditable(s)&&<input type="hidden" name={`contribution_${s.enrollment_id}`} value={pct}/>}</td>{Object.entries(teamByCO).map(([co,m])=><td key={co}>{(m*pct/100).toFixed(2)} / {(coMax[co]||0).toFixed(2)}</td>)}<td><b>{(teamTotal*pct/100).toFixed(2)}</b> / {totalMax.toFixed(2)}</td><td>{s.hod_comment||'—'}</td></tr>})}</tbody></table></div>
  {items.map(it=><input key={it.id} type="hidden" name={`selected_${it.id}`} value={scores[String(it.id)]||''}/>)}
  <h2>Step 3 — Faculty Declaration</h2><div className="field"><label>Faculty remarks</label><textarea name="facultyRemarks" defaultValue={facultyRemarks||''}/></div><label className="rubric-choice"><input type="checkbox" name="declaration" value="1" required/> I hereby declare that I have conducted the Review presentation of the students, analyzed their progress, and evaluated their performance. The contribution indicators entered above reflect their performance and contribution during the review.</label>
  <button className="btn secondary" name="action" value="SAVE_DRAFT">Save Draft</button> <button className="btn" name="action" value="SUBMIT">Submit to HoD</button>
 </form>
}
