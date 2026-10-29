import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const dirs: string[] = [];
function setup(runsDir = 'runs') {
  return createApp({ adapter: 'shim', installed: 'now', beatEverySeconds: 60, runsDir });
}

function makeTempRunsDir() {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-api-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('digest JSON: GET /api/digest/:night', () => {
  it('returns the same jobs in the same order as the HTML page for 2026-10-28', async () => {
    const app = setup('runs');

    // 1. Fetch JSON
    const jsonRes = await app.request('/api/digest/2026-10-28');
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.headers.get('content-type')).toContain('application/json');
    const rows = (await jsonRes.json()) as DigestRow[];
    expect(rows).toHaveLength(5);

    const jsonJobs = rows.map((r) => r.job);
    expect(jsonJobs).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);

    // 2. Fetch HTML page and extract job order
    const htmlRes = await app.request('/digest/2026-10-28');
    expect(htmlRes.status).toBe(200);
    const html = await htmlRes.text();

    // Verify each job appears in HTML in the exact same sequence as in JSON
    let lastIndex = -1;
    for (const job of jsonJobs) {
      const idx = html.indexOf(`<td>${job}</td>`);
      expect(idx).toBeGreaterThan(-1);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it('preserves field values including null owners and error details', async () => {
    const app = setup('runs');
    const res = await app.request('/api/digest/2026-10-28');
    const rows = (await res.json()) as DigestRow[];

    const render = rows.find((r) => r.job === 'digest/render');
    expect(render).toMatchObject({
      job: 'digest/render',
      owner: null,
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      lastError: null,
    });

    const refresh = rows.find((r) => r.job === 'fixtures/refresh');
    expect(refresh).toMatchObject({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
    });

    const notes = rows.find((r) => r.job === 'notes/backup');
    expect(notes).toMatchObject({
      job: 'notes/backup',
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
  });

  it('shares 404 semantics with the HTML page for a missing night or invalid name', async () => {
    const app = setup('runs');

    const json404 = await app.request('/api/digest/2001-01-01');
    const html404 = await app.request('/digest/2001-01-01');
    expect(json404.status).toBe(404);
    expect(html404.status).toBe(404);

    const traversalJson = await app.request('/api/digest/..%2Frig');
    expect(traversalJson.status).toBe(404);
  });

  it('shares empty semantics with the HTML page for an empty file (200 with empty rows)', async () => {
    const tempDir = makeTempRunsDir();
    writeFileSync(join(tempDir, '2026-01-02.jsonl'), '');

    const app = setup(tempDir);
    const jsonRes = await app.request('/api/digest/2026-01-02');
    expect(jsonRes.status).toBe(200);
    const rows = await jsonRes.json();
    expect(rows).toEqual([]);

    const htmlRes = await app.request('/digest/2026-01-02');
    expect(htmlRes.status).toBe(200);
    expect(await htmlRes.text()).toContain('nothing ran');
  });

  it('handles bad lines gracefully without throwing, returning parsed rows', async () => {
    const tempDir = makeTempRunsDir();
    const line = (job: string) => JSON.stringify({ at: '2026-10-28T23:00:00+01:00', job, status: 'ok', owner: 'test' });
    writeFileSync(
      join(tempDir, '2026-01-03.jsonl'),
      ['not json', line('job-b'), '{bad json', line('job-a'), ''].join('\n'),
    );

    const app = setup(tempDir);
    const res = await app.request('/api/digest/2026-01-03');
    expect(res.status).toBe(200);
    const rows = (await res.json()) as DigestRow[];
    expect(rows.map((r) => r.job)).toEqual(['job-a', 'job-b']);
  });
});
