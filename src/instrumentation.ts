export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { startStudyPackWorker } = await import('@/workers/study-pack-worker');
      startStudyPackWorker();
    } catch (err) {
      console.warn('[Instrumentation] Failed to auto-start study pack worker:', err);
    }
  }
}
