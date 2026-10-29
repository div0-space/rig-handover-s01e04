export type JobStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log. Times keep the offset from the log.
export type DigestRow = {
  job: string;
  // null when the log has no owner for the job; views render it as `—`.
  owner: string | null;
  // Every log line of the job, retries included.
  runs: number;
  // Lines with status `retry`.
  retries: number;
  lastStatus: JobStatus;
  // Error of the last line that carried one; null when none did.
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  // Sorted by job.
  rows: DigestRow[];
  // Lines that did not parse. Counted, never thrown.
  badLines: number;
};

// Reads `<runsDir>/<night>.jsonl` (read-only). Returns null when there is no such night.
export { readNight } from './read.js';
