import fs from "node:fs"; import path from "node:path"; import { pool } from "../lib/db";
async function main(){ const dir=path.join(process.cwd(),"db/migrations"); for(const file of fs.readdirSync(dir).filter(f=>f.endsWith(".sql")).sort()){ console.log("Applying",file); await pool.query(fs.readFileSync(path.join(dir,file),"utf8")); } await pool.end(); }
main().catch(e=>{console.error(e);process.exit(1)});
