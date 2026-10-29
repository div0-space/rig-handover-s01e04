import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const night = '2026-10-28';
const lines = [
  { at: '2026-10-28T22:00:00+01:00', job: 'zeta', owner: 'rook', status: 'ok' },
  { at: '2026-10-28T22:01:00+01:00', job: 'alpha', owner: null, status: 'retry', error: 'busy' },
  { at: '2026-10-28T22:02:00+01:00', job: 'alpha', owner: null, status: 'fail', error: 'still busy' },
];
const log = lines.map((line) => JSON.stringify(line)).join('\n') + '\n';
const rows = [
  {
    job: 'alpha', owner: null, runs: 2, retries: 1, lastStatus: 'fail',
    lastError: 'still busy', firstAt: lines[1].at, lastAt: lines[2].at,
  },
  {
    job: 'zeta', owner: 'rook', runs: 1, retries: 0, lastStatus: 'ok',
    lastError: null, firstAt: lines[0].at, lastAt: lines[0].at,
  },
];

describe('digest routes', () => {
  let runsDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
    app = createApp({
      adapter: 'shim', installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60, runsDir,
    });
  });

  afterEach(() => {
    rmSync(runsDir, { recursive: true, force: true });
  });

  describe('GET /digest/:night', () => {
    it('renders a real night with jobs sorted, a missing owner, and original times', async () => {
      writeFileSync(join(runsDir, `${night}.jsonl`), log);

      const res = await app.request(`/digest/${night}`);
      const html = await res.text();

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(html).toContain('alpha');
      expect(html).toContain('zeta');
      expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zeta'));
      expect(html).toContain('—');
      expect(html).toContain('still busy');
      expect(html).toContain(lines[2].at);
    });

    it('returns 404 when there is no file in the configured runs directory', async () => {
      // This night exists in the repository's runs/; the injected empty directory wins.
      const res = await app.request(`/digest/${night}`);

      expect(res.status).toBe(404);
    });

    it('renders "nothing ran" for an empty file', async () => {
      writeFileSync(join(runsDir, `${night}.jsonl`), '');

      const res = await app.request(`/digest/${night}`);

      expect(res.status).toBe(200);
      expect(await res.text()).toContain('nothing ran');
    });

    it('still renders valid jobs on both sides of a bad line', async () => {
      writeFileSync(join(runsDir, `${night}.jsonl`), [
        JSON.stringify(lines[0]), '{broken json', ...lines.slice(1).map((line) => JSON.stringify(line)), '',
      ].join('\n'));

      const res = await app.request(`/digest/${night}`);
      const html = await res.text();

      expect(res.status).toBe(200);
      expect(html).toContain('alpha');
      expect(html).toContain('zeta');
      expect(html).toContain('still busy');
      expect(html).toMatch(/unreadable lines:\s*1/);
    });
  });

  describe('GET /api/digest/:night', () => {
    it('returns the real night as JSON with sorted, aggregated rows', async () => {
      writeFileSync(join(runsDir, `${night}.jsonl`), log);

      const res = await app.request(`/api/digest/${night}`);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(await res.json()).toEqual({ night, rows, badLines: 0 });
    });

    it('returns 404 when there is no file in the configured runs directory', async () => {
      const res = await app.request(`/api/digest/${night}`);

      expect(res.status).toBe(404);
    });

    it('returns an empty set of rows for an empty file', async () => {
      writeFileSync(join(runsDir, `${night}.jsonl`), '');

      const res = await app.request(`/api/digest/${night}`);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ night, rows: [], badLines: 0 });
    });

    it('counts a bad line and retains valid jobs on both sides of it', async () => {
      writeFileSync(join(runsDir, `${night}.jsonl`), [
        JSON.stringify(lines[0]), '{broken json', ...lines.slice(1).map((line) => JSON.stringify(line)), '',
      ].join('\n'));

      const res = await app.request(`/api/digest/${night}`);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ night, rows, badLines: 1 });
    });
  });
});
