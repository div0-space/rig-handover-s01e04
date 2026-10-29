import type { Night } from '../digest/types.js';

export function Digest({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.badLines > 0 && <p class="warn">unreadable lines: {night.badLines}</p>}
      {night.rows.length === 0 ? <p class="mute">nothing ran</p> : (
        <table>
          <thead><tr><th>job</th><th>owner</th><th>runs</th><th>retries</th><th>last status</th><th>last error</th><th>first time</th><th>last time</th></tr></thead>
          <tbody>
            {[...night.rows].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0).map((row) => (
              <tr class={row.retries >= 3 || row.lastStatus === 'fail' ? 'warn' : undefined}>
                <td>{row.job}</td><td>{row.owner ?? '—'}</td><td>{row.runs}</td><td>{row.retries}</td>
                <td>{row.lastStatus}</td><td>{row.lastError ?? '—'}</td><td>{row.firstAt}</td><td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
