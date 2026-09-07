export async function register() {
  // The BullMQ study-pack worker runs as a dedicated Railway service via `npm run worker`.
  // It must NOT auto-start here unless ENABLE_INLINE_WORKER=true is explicitly set,
  // otherwise every `npm run dev` session creates a second competing worker against the
  // Railway production worker on the same shared Redis queue.
  //
  // ⚠️  Do NOT set ENABLE_INLINE_WORKER=true in .env.local or any local dev env file.
  //     Run `npm run worker:dev` in a separate terminal if you need a local worker.
  // ⚠️  Do NOT set ENABLE_INLINE_WORKER=true on the Railway Next.js app service.
  //     The dedicated Railway worker service already handles this via `npm run worker`.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.ENABLE_INLINE_WORKER === 'true') {
    try {
      const { startStudyPackWorker } = await import('@/workers/study-pack-worker');
      startStudyPackWorker();
    } catch (err) {
      console.warn('[Instrumentation] Failed to auto-start study pack worker:', err);
    }
  }
}
