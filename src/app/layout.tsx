import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'SketchRush — Draw it. Guess it. Win it.', description: 'A real-time multiplayer drawing and guessing game.' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
