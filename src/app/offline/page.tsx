export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-fg">S</div>
      <h1 className="text-xl font-semibold tracking-tight">You&apos;re offline</h1>
      <p className="mt-2 max-w-xs text-sm text-muted">Splitwisely needs a connection to load the group. Try again when you&apos;re back online.</p>
      <a href="/" className="mt-6 inline-flex h-11 items-center rounded-lg bg-accent px-4 text-base font-medium text-accent-fg">
        Try again
      </a>
    </main>
  );
}
