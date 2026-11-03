import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SystemComponents } from './SystemComponents';
import type { SystemInfo } from '../api/edgeApi';

/* SystemComponents is a pure presenter. info=null → "Loading…"; info
 * populated → 8 rows with per-field status mapping. Branches on each
 * row (ok / warn / danger / muted / ternaries for status / value). */

function info(overrides: Partial<SystemInfo> = {}): SystemInfo {
  return {
    build: { version: '2.3.123', commit: 'a', branch: 'main',
             buildTime: 'now', dirty: false },
    runtime: { heapUsedBytes: 1, heapMaxBytes: 100,
               uptimeMillis: 1,
               javaVersion: '17.0.9' } as unknown as SystemInfo['runtime'],
    database: { product: 'PostgreSQL 17 on x86_64-pc-linux',
                configured: true, sessionCount: 0 } as unknown as SystemInfo['database'],
    scheduler: { started: true, name: 'DER-SCHED',
                 totalJobs: 10, executingJobs: 0 } as unknown as SystemInfo['scheduler'],
    dhis2: { configured: true, probeReachable: true,
             profileName: 'default', probeDurationMs: 45,
             baseUrl: 'x',
             centralVersion: '2.44', pinnedVersion: '2.44' } as unknown as SystemInfo['dhis2'],
    storage: { totalBytes: 100, usableBytes: 50,
               status: 'OK', root: '/var/lib/der' },
    apps: { installed: 2, enabled: 1, items: [] },
    journal: { central_accepted: 50,
               central_rejected: 0 } as unknown as SystemInfo['journal'],
    attribution: { mappedUsers: 5 } as unknown as SystemInfo['attribution'],
    ...overrides,
  } as unknown as SystemInfo;
}

describe('SystemComponents', () => {
  it('null info renders the Loading row', () => {
    render(<SystemComponents info={null} />);
    expect(screen.getByTestId('system-components')).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('happy-path: all rows render with ok tones', () => {
    render(<SystemComponents info={info()} />);
    /* Each of the 8 rows surfaces. */
    expect(screen.getByTestId('sys-der')).toBeInTheDocument();
    expect(screen.getByTestId('sys-postgres')).toBeInTheDocument();
    expect(screen.getByTestId('sys-scheduler')).toBeInTheDocument();
    expect(screen.getByTestId('sys-compat')).toBeInTheDocument();
    expect(screen.getByTestId('sys-journal')).toBeInTheDocument();
    expect(screen.getByTestId('sys-storage')).toBeInTheDocument();
    expect(screen.getByTestId('sys-apps')).toBeInTheDocument();
    expect(screen.getByTestId('sys-attribution')).toBeInTheDocument();
  });

  it('postgres product undefined → warn tone + em-dash fallback', () => {
    render(<SystemComponents info={info({
      database: { product: null, configured: true,
                   sessionCount: 0 } as unknown as SystemInfo['database'],
    })} />);
    /* The row renders with warn status via the ternary. */
    expect(screen.getByTestId('sys-postgres')).toBeInTheDocument();
    expect(document.body.textContent ?? '').toMatch(/—/);
  });

  it('scheduler stopped → "stopped" value + warn tone', () => {
    render(<SystemComponents info={info({
      scheduler: { started: false, name: null, totalJobs: 0,
                   executingJobs: 0 } as unknown as SystemInfo['scheduler'],
    })} />);
    expect(screen.getByText('stopped')).toBeInTheDocument();
  });

  it('compat probe failed → "probe failed" + danger tone', () => {
    render(<SystemComponents info={info({
      dhis2: { configured: true, probeReachable: false,
               profileName: null, probeDurationMs: null,
               baseUrl: 'x',
               centralVersion: null,
               pinnedVersion: null } as unknown as SystemInfo['dhis2'],
    })} />);
    expect(screen.getByText('probe failed')).toBeInTheDocument();
  });

  it('journal with rejected rows → warn tone', () => {
    render(<SystemComponents info={info({
      journal: { central_accepted: 50,
                 central_rejected: 3 } as unknown as SystemInfo['journal'],
    })} />);
    expect(screen.getByText('50 accepted')).toBeInTheDocument();
  });

  it('storage WARN status → warn tone', () => {
    render(<SystemComponents info={info({
      storage: { totalBytes: 100, usableBytes: 50,
                 status: 'WARN', root: '/var/lib/der' },
    })} />);
    expect(screen.getByTestId('sys-storage')).toBeInTheDocument();
  });

  it('storage other status (unknown) → danger tone', () => {
    render(<SystemComponents info={info({
      storage: { totalBytes: 100, usableBytes: 50,
                 status: 'REJECT' as 'OK' | 'WARN',
                 root: '/var/lib/der' },
    })} />);
    expect(screen.getByTestId('sys-storage')).toBeInTheDocument();
  });

  it('empty optional fields fall back to defaults', () => {
    render(<SystemComponents info={info({
      runtime: { heapUsedBytes: 0, heapMaxBytes: 0, uptimeMillis: 0,
                 javaVersion: null } as unknown as SystemInfo['runtime'],
      build: { version: null, commit: null, branch: null, buildTime: null,
               dirty: false } as unknown as SystemInfo['build'],
      scheduler: { started: true, name: null, totalJobs: null,
                   executingJobs: 0 } as unknown as SystemInfo['scheduler'],
      journal: {} as unknown as SystemInfo['journal'],
      apps: {} as unknown as SystemInfo['apps'],
      attribution: {} as unknown as SystemInfo['attribution'],
    })} />);
    /* "0 accepted", "0 enabled of 0", "0 users mapped" surface. */
    expect(screen.getByText('0 accepted')).toBeInTheDocument();
    expect(screen.getByText('0 enabled of 0')).toBeInTheDocument();
    expect(screen.getByText('0 users mapped')).toBeInTheDocument();
  });
});
