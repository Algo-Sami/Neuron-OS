import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Resolves the writable directory for persistent background diagnostic logs.
 * Fallback chain:
 * 1. process.env.LOG_DIR if explicitly set and writable.
 * 2. ./logs (relative to process.cwd()).
 * 3. os.tmpdir() fallback (e.g. for read-only serverless filesystems).
 *
 * Note: On Vercel / serverless runtimes, os.tmpdir() (/tmp) is writable but ephemeral
 * per invocation lifetime, not a durable cross-instance log store.
 */
let cachedLogDir: string | null = null;

export function resolveLogDirectory(): string {
  if (cachedLogDir) return cachedLogDir;

  const candidateDirs: string[] = [];

  if (process.env.LOG_DIR && process.env.LOG_DIR.trim()) {
    candidateDirs.push(path.resolve(process.env.LOG_DIR.trim()));
  }

  // Standard application logs directory
  candidateDirs.push(path.join(process.cwd(), 'logs'));

  // Ephemeral OS temp fallback (e.g. /tmp on Linux/Vercel)
  candidateDirs.push(os.tmpdir());

  for (const dir of candidateDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Test writeability
      const testFile = path.join(dir, `.write_test_${process.pid}_${Date.now()}`);
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);

      cachedLogDir = dir;
      return dir;
    } catch {
      // Try next candidate in the fallback chain
    }
  }

  // Absolute fallback if everything fails
  return os.tmpdir();
}

/**
 * Resets the cached log directory (primarily useful for unit/integration tests).
 */
export function resetCachedLogDir(): void {
  cachedLogDir = null;
}

/**
 * Appends a diagnostic entry to background_logs.txt in an OS-safe, container-resilient location.
 * Will never throw or abort caller execution.
 */
export function writeBackgroundLog(entry: string): void {
  try {
    const logDir = resolveLogDirectory();
    const filePath = path.join(logDir, 'background_logs.txt');
    const line = entry.endsWith('\n') ? entry : `${entry}\n`;
    fs.appendFileSync(filePath, line);
  } catch (err) {
    // Failsafe: log to stderr without interrupting caller execution
    console.error('[writeBackgroundLog:FALLBACK]', entry.trim(), err);
  }
}
