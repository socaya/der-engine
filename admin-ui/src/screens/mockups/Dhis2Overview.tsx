import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { KpiTile, Panel, Dot, fmtAgo, fmtDate } from './shared';
import { LoadingBlock } from '../../components/ScreenStates';

/**
 * DHIS2 Overview — primary landing page for the DHIS2 sidebar entry.
 * Replaces Compatibility as the group's primary. Shows a dashboard of
 * every DHIS2-side surface this edge touches: connection, OU binding,
 * compatibility probe, metadata mirror, drift, and program rules.
 */
export function MockupDhis2Overview(): JSX.Element {
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [c, setC] = useState<edgeApi.CompatSnapshot | null>(null);
  const [b, setB] = useState<edgeApi.OrgUnitBinding | null>(null);
  const [d, setD] = useState<edgeApi.DriftResponse | null>(null);
  const [cfg, setCfg] = useState<edgeApi.Dhis2ConnectionPayload | null>(null);

  useEffect(() => {
    Promise.allSettled([
      edgeApi.systemInfo(), edgeApi.compat(),
      edgeApi.getOrgUnitBinding(), edgeApi.drift(),
      edgeApi.readDhis2Connection(),
    ]).then((r) => {
      if (r[0].status === 'fulfilled') setSi(r[0].value);
      if (r[1].status === 'fulfilled') setC(r[1].value);
      if (r[2].status === 'fulfilled') setB(r[2].value);
      if (r[3].status === 'fulfilled') setD(r[3].value);
      if (r[4].status === 'fulfilled') setCfg(r[4].value);
    });
  }, []);

  if (!si || !c) return <LoadingBlock testId="loading" />;

  const reach = c.probeReachable;
  const bound = b?.bound ?? false;
  const drift = d?.fingerprintFrom && d?.fingerprintTo && d.fingerprintFrom !== d.fingerprintTo;
  const authKind = cfg?.patTokenSet ? 'PAT' : cfg?.passwordSet ? 'Basic' : 'none';

  return (
    <div className="ea-screen">
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <div className="ea-dash-hero-eyebrow">DHIS2 Integration</div>
          <h1 className="ea-dash-hero-title">DHIS2 overview</h1>
          <p className="ea-dash-hero-sub">
            Health of the DER→DHIS2 integration: central reachability,
            binding, compat profile, metadata mirror and drift.
          </p>
          <div className="ea-dash-hero-meta">
            <span className={'ea-chip ea-chip--' + (reach ? 'success' : 'danger')}>
              {reach ? 'Central reachable' : 'Central unreachable'}
            </span>
            <span className="ea-dash-hero-meta-item">{c.centralVersion ?? '—'}</span>
            <span className="ea-dash-hero-meta-item">profile {c.profileName ?? '—'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/integration/connection" className="ea-btn ea-btn--primary">Edit connection</Link>
        </div>
      </section>

      <div className="ea-kpi-grid">
        <KpiTile tone={reach ? 'success' : 'danger'} icon={<IconPlug />}
                 label="Reachable" value={reach ? 'yes' : 'no'}
                 caption={si.dhis2.probeDurationMs != null ? `${si.dhis2.probeDurationMs} ms` : '—'} />
        <KpiTile tone={bound ? 'success' : 'warning'} icon={<IconPin />}
                 label="Org unit" value={bound ? 'bound' : 'unbound'}
                 caption={b?.orgUnitDisplayName ?? 'select a facility'} />
        <KpiTile tone="info" icon={<IconProfile />}
                 label="Compat profile" value={c.profileName ?? '—'}
                 caption={`v${c.engineVersion ?? '—'}`} />
        <KpiTile tone={drift ? 'warning' : 'success'} icon={<IconDiff />}
                 label="Drift" value={drift ? 'detected' : 'in sync'} />
      </div>

      <div className="ea-dash-middle">
        <Panel title="Connection"
               action={<Link to="/integration/connection" className="ea-link-btn">Edit</Link>}>
          <ul className="ea-components-list">
            <li>
              <Dot tone={reach ? 'success' : 'danger'} />
              <div className="ea-components-main">
                <div className="ea-components-name">Base URL</div>
                <div className="ea-components-meta ea-mono">
                  {cfg?.baseUrl || si.dhis2.centralBaseUrl || '—'}
                </div>
              </div>
            </li>
            <li>
              <Dot tone={authKind === 'none' ? 'warning' : 'success'} />
              <div className="ea-components-main">
                <div className="ea-components-name">Authentication</div>
                <div className="ea-components-meta">
                  {authKind === 'PAT' ? 'Personal access token (Bearer)'
                    : authKind === 'Basic' ? `Basic · ${cfg?.username ?? ''}`
                      : 'Not configured'}
                </div>
              </div>
            </li>
            <li>
              <Dot tone="muted" />
              <div className="ea-components-main">
                <div className="ea-components-name">Captured</div>
                <div className="ea-components-meta ea-mono">{si.dhis2.capturedAt ? fmtDate(si.dhis2.capturedAt) : '—'}</div>
              </div>
            </li>
          </ul>
        </Panel>

        <Panel title="Compatibility"
               action={<Link to="/compat" className="ea-link-btn">Details</Link>}>
          <ul className="ea-components-list">
            <li>
              <Dot tone={reach ? 'success' : 'danger'} />
              <div className="ea-components-main">
                <div className="ea-components-name">Central version</div>
                <div className="ea-components-meta ea-mono">{c.centralVersion ?? '—'}</div>
              </div>
            </li>
            <li>
              <Dot tone="muted" />
              <div className="ea-components-main">
                <div className="ea-components-name">Pinned</div>
                <div className="ea-components-meta ea-mono">{si.dhis2.pinnedVersion ?? '—'}</div>
              </div>
            </li>
            <li>
              <Dot tone={si.dhis2.allowMismatch ? 'warning' : 'success'} />
              <div className="ea-components-main">
                <div className="ea-components-name">Allow mismatch</div>
                <div className="ea-components-meta">{si.dhis2.allowMismatch ? 'yes' : 'no'}</div>
              </div>
            </li>
          </ul>
        </Panel>
      </div>

      <Panel title="DHIS2 sub-modules">
        <div className="ea-tile-grid">
          <Link to="/integration/connection" className="ea-link-tile">
            <div className="ea-link-tile-icon">⚙</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Central connection</div>
              <div className="ea-link-tile-desc">Base URL, service account, PAT, timeouts, proxy.</div>
            </div>
          </Link>
          <Link to="/integration/organisation-unit" className="ea-link-tile">
            <div className="ea-link-tile-icon">⌖</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Organisation unit</div>
              <div className="ea-link-tile-desc">
                {bound ? `Bound to ${b?.orgUnitDisplayName}` : 'Not bound yet — pick a facility.'}
              </div>
            </div>
          </Link>
          <Link to="/compat" className="ea-link-tile">
            <div className="ea-link-tile-icon">✓</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Compatibility</div>
              <div className="ea-link-tile-desc">Live probe + ADR-0006 policy.</div>
            </div>
          </Link>
          <Link to="/compat/history" className="ea-link-tile">
            <div className="ea-link-tile-icon">⏱</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Compat history</div>
              <div className="ea-link-tile-desc">Past snapshots and engine versions.</div>
            </div>
          </Link>
          <Link to="/metadata" className="ea-link-tile">
            <div className="ea-link-tile-icon">◱</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Metadata mirror</div>
              <div className="ea-link-tile-desc">Local copy of DHIS2 metadata for offline capture.</div>
            </div>
          </Link>
          <Link to="/sync/drift" className="ea-link-tile">
            <div className="ea-link-tile-icon">≠</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Metadata drift</div>
              <div className="ea-link-tile-desc">
                {drift ? 'Drift detected — review before next sync.' : 'Fingerprints match central.'}
              </div>
            </div>
          </Link>
          <Link to="/dhis2/metadata-sync" className="ea-link-tile">
            <div className="ea-link-tile-icon">▶</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Metadata sync</div>
              <div className="ea-link-tile-desc">Trigger an immediate metadata pull from central.</div>
            </div>
          </Link>
        </div>
      </Panel>

      <Panel title="Latest probe">
        <ul className="ea-components-list">
          <li>
            <Dot tone="muted" />
            <div className="ea-components-main">
              <div className="ea-components-name">Last probe</div>
              <div className="ea-components-meta">{fmtAgo(c.capturedAt)}</div>
            </div>
          </li>
          <li>
            <Dot tone="muted" />
            <div className="ea-components-main">
              <div className="ea-components-name">Reason</div>
              <div className="ea-components-meta">{si.dhis2.reason ?? '—'}</div>
            </div>
          </li>
        </ul>
      </Panel>
    </div>
  );
}

function IconPlug(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2v4M15 2v4" /><path d="M7 6h10v4a5 5 0 01-10 0V6z" /><path d="M12 15v7" /></svg>); }
function IconPin(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7z" /><circle cx="12" cy="9" r="2.5" /></svg>); }
function IconProfile(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 10h8M8 14h5" /></svg>); }
function IconDiff(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h12M4 16h12M20 4l-4 4M20 20l-4-4" /></svg>); }
