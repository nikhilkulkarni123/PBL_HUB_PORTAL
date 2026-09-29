export const DANGEROUS_EXTENSIONS = new Set([
  'exe','msi','bat','cmd','com','scr','ps1','vbs','jar','dll','sys','reg','hta','lnk','app','dmg','pkg','sh'
]);

export function normalizeExtensions(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : String(input || '').split(',');
  return raw.map(x => String(x).trim().toLowerCase().replace(/^\./,'')).filter(Boolean);
}

export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i+1).toLowerCase() : '';
}

export function isDangerousFilename(name: string): boolean {
  return DANGEROUS_EXTENSIONS.has(fileExtension(name));
}

export function isValidUrl(value: string, youtubeOnly=false): boolean {
  try {
    const u = new URL(value);
    if (!['http:','https:'].includes(u.protocol)) return false;
    if (!youtubeOnly) return true;
    const h=u.hostname.toLowerCase().replace(/^www\./,'');
    return h==='youtube.com'||h.endsWith('.youtube.com')||h==='youtu.be';
  } catch { return false; }
}

export function humanBytes(n:number){
  if(n<1024)return `${n} B`; if(n<1024*1024)return `${(n/1024).toFixed(0)} KB`;return `${(n/1024/1024).toFixed(1)} MB`;
}
