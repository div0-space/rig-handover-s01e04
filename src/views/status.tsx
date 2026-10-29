import { readNight } from '../digest/types.js';
import type { Status } from '../status.js';
import type { RigConfig } from '../config.js';

export function StatusBoard({ status, config }: { status: Status; config: RigConfig }) {
  const nights = status.nights.map((n) => {
    const night = readNight(config.runsDir, n);
    const ok = night ? night.rows.filter((r) => r.lastStatus === 'ok').length : 0;
    const retry = night ? night.rows.filter((r) => r.lastStatus === 'retry').length : 0;
    const fail = night ? night.rows.filter((r) => r.lastStatus === 'fail').length : 0;
    return { night: n, ok, retry, fail, hasDigest: !!night };
  });
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} · pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {status.nights.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <ul>
          {nights.map(({ night, ok, retry, fail, hasDigest }) => (
            <li>
              {hasDigest ? (
                <a href={`/digest/${night}`}>{night}</a>
              ) : (
                night
              )}{' '}
              <span class="mute">ok {ok} · retry {retry} · fail {fail}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
