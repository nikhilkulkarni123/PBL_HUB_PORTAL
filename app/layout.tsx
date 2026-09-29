import './globals.css';
import {Header} from '@/components/Header';
import {Footer} from '@/components/Footer';
import BackButton from '@/components/BackButton';
import {getSession} from '@/lib/auth';

export const metadata={title:'Falcon PBL Project Hub V4.1.1 — GMU',description:'GM University Project Based Learning project, team, review and verification portal'};

export default async function RootLayout({children}:{children:React.ReactNode}){
  const s=await getSession();
  return <html lang="en"><body><Header/><div className="container backbar"><BackButton fallback={s?'/dashboard':'/'}/></div><main>{children}</main><Footer/></body></html>;
}
