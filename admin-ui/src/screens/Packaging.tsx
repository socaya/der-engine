import { useEffect, useState } from 'react';
import { Panel, SyncStatusBar, Status, fmtAgo } from './shared';
import { UiIcon } from '../components/UiIcon';

interface HwKit {
  kitId: string;
  name: string;
  specs: string;
  bestFor: string[];
}

interface KindRow { kind: string; count: number; latest: string | null; }

interface Summary {
  appVersion: string;
  artifactCount: number;
  kinds: KindRow[];
  hwKits: HwKit[];
}

interface Artifact {
  artifactId: string;
  kind: 'DEB' | 'TARBALL';
  version: string;
  arch: string | null;
  sha256: string;
  sizeBytes: number;
  builtAt: string;
  builtBy: string | null;
  sourceCommit: string | null;
  outputPath: string;
}

interface IndexResponse { summary: Summary; artifacts: Artifact[]; }

async function fetchJson<T>(path: string): Promise<T> {
  const r = await fetch(path, { credentials: 'include' });
  const t = await r.text();
  return (t ? JSON.parse(t) : undefined) as T;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Packaging(): JSX.Element {
  const [data, setData] = useState<IndexResponse | null>(null);

  async function reload(): Promise<void> {
    try { setData(await fetchJson<IndexResponse>('/edge-api/v1/packaging')); }
    catch { /* ignore */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  const summary = data?.summary;
  const artifacts = data?.artifacts ?? [];

  return (
    <div className="ea-screen" data-test="packaging">
      <SyncStatusBar
        tone={summary && summary.artifactCount > 0 ? 'success' : 'muted'}
        title="Packaging"
        statusLabel={
          summary
            ? `v${summary.appVersion} · ${summary.artifactCount} artefacts tracked`
            : 'loading'
        }
        subtitle={
          <span>
            Artefact registry (<code>.deb</code> + portable tarball) and
            reference hardware kits. See <code>docs/site/install.md</code>.
          </span>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                  aria-label="Refresh packaging"
                  onClick={() => { reload().catch(() => undefined); }}>
            <UiIcon icon="refresh" size={14} /><span>Refresh</span>
          </button>
        }
      />

      <Panel title="Reference hardware kits">
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense" aria-label="Reference hardware kits">
            <thead><tr>
              <th scope="col">Kit</th>
              <th scope="col">Name</th>
              <th scope="col">Specs</th>
              <th scope="col">Best for</th>
            </tr></thead>
            <tbody>
              {(summary?.hwKits ?? []).map((k) => (
                <tr key={k.kitId}>
                  <td className="ea-mono">{k.kitId}</td>
                  <td>{k.name}</td>
                  <td className="ea-text-muted" style={{ fontSize: 12 }}>{k.specs}</td>
                  <td className="ea-text-muted" style={{ fontSize: 12 }}>
                    {k.bestFor.join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={`Artefact registry · ${artifacts.length}`}>
        {artifacts.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No artefacts recorded yet. After building with <code>packaging/deb/build.sh</code> or
            <code> packaging/tarball/build.sh</code>, register with:
            <br />
            <code>POST /edge-api/v1/packaging/artifacts {`{ kind, version, sha256, sizeBytes, outputPath }`}</code>
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense" aria-label="Artefact registry">
              <thead><tr>
                <th scope="col">Built</th>
                <th scope="col">Kind</th>
                <th scope="col">Version</th>
                <th scope="col">Arch</th>
                <th scope="col">Size</th>
                <th scope="col">sha256</th>
                <th scope="col">Commit</th>
                <th scope="col">Path</th>
                <th scope="col">By</th>
              </tr></thead>
              <tbody>
                {artifacts.map((a) => (
                  <tr key={a.artifactId}>
                    <td className="ea-text-muted">{fmtAgo(a.builtAt)}</td>
                    <td>
                      <Status tone={a.kind === 'DEB' ? 'info' : 'muted'}>{a.kind}</Status>
                    </td>
                    <td className="ea-mono">{a.version}</td>
                    <td className="ea-mono">{a.arch || '—'}</td>
                    <td className="ea-mono">{fmtSize(a.sizeBytes)}</td>
                    <td className="ea-mono" style={{ fontSize: 11 }} title={a.sha256}>
                      {a.sha256.slice(0, 12)}…
                    </td>
                    <td className="ea-mono" style={{ fontSize: 11 }}>
                      {a.sourceCommit ? a.sourceCommit.slice(0, 8) : '—'}
                    </td>
                    <td className="ea-mono" style={{ fontSize: 11 }}>{a.outputPath}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{a.builtBy ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Build commands">
        <div style={{ padding: 10, fontSize: 13 }}>
          <p>
            <strong>Debian / Ubuntu (.deb):</strong>
            <code style={{ display: 'block', padding: '6px 10px', margin: '4px 0' }}>
              bash packaging/deb/build.sh
            </code>
          </p>
          <p>
            <strong>Any systemd distro (portable tarball):</strong>
            <code style={{ display: 'block', padding: '6px 10px', margin: '4px 0' }}>
              bash packaging/tarball/build.sh
            </code>
          </p>
          <p className="ea-text-muted" style={{ fontSize: 12 }}>
            Both scripts expect the server JAR and admin UI to be built first.
          </p>
        </div>
      </Panel>
    </div>
  );
}
