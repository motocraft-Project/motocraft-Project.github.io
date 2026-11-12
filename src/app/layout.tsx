import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'MOTOCRAFT Dealer Management', description: 'MOTOCRAFT dealership management · temporary demonstration' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
