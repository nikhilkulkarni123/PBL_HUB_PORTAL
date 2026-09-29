export function firstMeaningfulMotherName(value:string|null|undefined){
  const raw=String(value||'').trim();
  if(!raw || ['NO DATA','N/A','NA','NONE','NULL','-','#N/A'].includes(raw.toUpperCase())) return 'india';
  const tokens=raw.match(/[A-Za-z]+/g)||[];
  const meaningful=tokens.find(t=>t.length>1);
  return (meaningful||tokens[0]||'india').toLowerCase();
}

export function normalizeDob(value:string|null|undefined){
  const s=String(value||'').trim();
  if(!s) return null;
  const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if(iso) return {year:iso[1],month:iso[2],day:iso[3],iso:s};
  const dmy=/^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(s);
  if(dmy) return {year:dmy[3],month:dmy[2],day:dmy[1],iso:`${dmy[3]}-${dmy[2]}-${dmy[1]}`};
  return null;
}

export function buildStudentInitialPassword(dob:string|null|undefined,mother:string|null|undefined){
  const d=normalizeDob(dob);
  if(!d) return null;
  return `m${d.month}${d.day}${firstMeaningfulMotherName(mother)}`;
}
