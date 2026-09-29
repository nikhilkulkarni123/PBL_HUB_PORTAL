'use client';
import { useRouter } from 'next/navigation';
export default function BackButton({fallback='/'}:{fallback?:string}){
  const router=useRouter();
  return <button type="button" className="backbtn" onClick={()=>{if(typeof window!=='undefined'&&window.history.length>1)router.back();else router.push(fallback)}} aria-label="Go back">← Back</button>
}
