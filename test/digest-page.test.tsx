import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const dirs: string[] = [];
function setup() {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-page-'));
  dirs.push(runsDir);
  return { runsDir, app: createApp({ adapter: 'shim', installed: 'now', beatEverySeconds: 60, runsDir }) };
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('digest page', () => {
  it('renders sorted jobs, highlights retries and failures, and retains missing data', async () => {
    const { runsDir, app } = setup();
    const line = (job: string, status: string, owner: string | null, error?: string) =>
      JSON.stringify({ at: '2026-10-28T23:00:00+01:00', job, status, owner, error });
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), [
      line('z-failed', 'fail', 'lane', 'failed <safely>'),
      line('a-retry', 'retry', null), line('a-retry', 'retry', null), line('a-retry', 'retry', null),
      line('a-retry', 'ok', null), 'bad line',
    ].join('\n'));
    const res = await app.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.indexOf('a-retry')).toBeLessThan(html.indexOf('z-failed'));
    expect(html).toContain('<tr class="warn"><td>a-retry</td><td>—</td>');
    expect(html).toContain('<tr class="warn"><td>z-failed</td>');
    expect(html).toContain('failed &lt;safely&gt;');
    expect(html).toContain('unreadable lines: 1');
    expect(html).toContain('2026-10-28T23:00:00+01:00');
    expect(html).not.toContain('<script');
  });

  it('distinguishes a missing night from an empty file', async () => {
    const { runsDir, app } = setup();
    expect((await app.request('/digest/2026-10-29')).status).toBe(404);
    writeFileSync(join(runsDir, '2026-10-29.jsonl'), '');
    const res = await app.request('/digest/2026-10-29');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });
});
