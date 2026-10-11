'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="error-page"><h1>Something went wrong</h1><p>Your room may still be active. Try again.</p><button onClick={reset}>Retry</button></main>; }
