export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="font-mono text-[10px] tracking-[0.26em] text-muted-foreground uppercase">
            Error · 404
          </p>
          <h1 className="font-display text-4xl font-normal">
            Not found<span className="text-primary">.</span>
          </h1>
        </main>
      </body>
    </html>
  );
}
