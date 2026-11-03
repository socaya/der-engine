import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HealthCards } from './HealthCards';
import type { SystemInfo } from '../api/edgeApi';

/* HealthCards is a pure presenter — info=null → skeleton, info
 * populated → four Link cards with status pills driven by
 * scheduler.started / dhis2.probeReachable / journal totals /
 * storage.status. Covers fmtBytes, pillCls, journalPending,
 * uptimeLabel across three bands (<60m, <1440m, ≥1440m). */

function wrap(ui: JSX.Element): JSX.Element {
  return <MemoryRouter>{ui}</MemoryRouter>;
}

function info(overrides: Partial<SystemInfo> = {}): SystemInfo {
  return {
    build: { version: '2.3.123', commit: 'a', branch: 'main',
             buildTime: 'now', dirty: false },
    runtime: { heapUsedBytes: 1 << 20, heapMaxBytes: 1 << 22,
               uptimeMillis: 10 * 60_000 },
    database: { configured: true, product: 'PostgreSQL 17',
                migrationCount: 42, sessionCount: 1,
                probeError: null } as unknown as SystemInfo['database'],
    scheduler: { started: true, totalJobs: 10,
                 executingJobs: 0 } as unknown as SystemInfo['scheduler'],
    dhis2: { configured: true, probeReachable: true,
             centralVersion: '2.44', pinnedVersion: '2.44',
             profileName: 'default',
             probeDurationMs: 45,
             centralBaseUrl: 'http://localhost:8080',
             baseUrl: 'x' } as unknown as SystemInfo['dhis2'],
    storage: { totalBytes: 1 << 30, usableBytes: 1 << 29,
               status: 'OK', root: '/var/lib/der' },
    apps: { installed: 0, enabled: 0, items: [] },
    journal: {} as unknown as SystemInfo['journal'],
    ...overrides,
  } as unknown as SystemInfo;
}

describe('HealthCards', () => {
  it('null info → skeleton render', () => {
    render(wrap(<HealthCards info={null} />));
    expect(screen.getByTestId('health-cards-skeleton')).toBeInTheDocument();
  });

  it('all-green scenario: scheduler running, DHIS2 up, empty journal, storage OK', () => {
    render(wrap(<HealthCards info={info()} />));
    expect(screen.getByTestId('health-cards')).toBeInTheDocument();
    /* Each pill surfaces the OK label. Multiple cards reach OK, so
     * length ≥ 3 (DER + journal + storage; DHIS2 renders OK too). */
    expect(screen.getAllByText('OK').length).toBeGreaterThanOrEqual(3);
    /* EMPTY badge is journal-specific — journal map is empty. */
    expect(screen.getByText('EMPTY')).toBeInTheDocument();
    /* Build version renders. */
    expect(screen.getByText('2.3.123')).toBeInTheDocument();
    /* Each of the four cards is a Link — test ids are stable. */
    expect(screen.getByTestId('health-der')).toBeInTheDocument();
    expect(screen.getByTestId('health-dhis2')).toBeInTheDocument();
    expect(screen.getByTestId('health-journal')).toBeInTheDocument();
    expect(screen.getByTestId('health-storage')).toBeInTheDocument();
  });

  it('degraded scenario: scheduler stopped, DHIS2 down, journal has backlog, storage WARN', () => {
    render(wrap(<HealthCards info={info({
      scheduler: { started: false, totalJobs: 10,
                   executingJobs: 0 } as unknown as SystemInfo['scheduler'],
      dhis2: { configured: true, probeReachable: false,
               centralVersion: null, pinnedVersion: '2.44',
               profileName: null, probeDurationMs: null,
               baseUrl: 'x' } as unknown as SystemInfo['dhis2'],
      storage: { totalBytes: 1 << 30, usableBytes: 1 << 29,
                 status: 'WARN', root: '/var/lib/der' },
      journal: { pending: 3, in_flight: 1, retryable: 2,
                 conflict_review: 1, central_accepted: 50,
                 central_rejected: 2,
      } as unknown as SystemInfo['journal'],
    })} />));
    /* DER pill = WARN (scheduler stopped). DHIS2 pill = DOWN. */
    expect(screen.getByText('DOWN')).toBeInTheDocument();
    /* "7 QUEUED" surfaces (3+1+2+1 pending/in_flight/retryable/conflict). */
    expect(screen.getByText('7 QUEUED')).toBeInTheDocument();
    /* Both WARN pills appear (DER + storage). */
    expect(screen.getAllByText('WARN').length).toBeGreaterThanOrEqual(2);
    /* fmtBytes renders bytes for storage. */
    expect(screen.getAllByText(/MB|GB/).length).toBeGreaterThan(0);
  });

  it('fmtBytes handles bytes=0/undefined → em-dash fallback', () => {
    render(wrap(<HealthCards info={info({
      runtime: { heapUsedBytes: undefined,
                 heapMaxBytes: undefined,
                 uptimeMillis: 0 } as unknown as SystemInfo['runtime'],
      storage: { totalBytes: 0, usableBytes: 0,
                 status: 'OK', root: '/' },
      build: { version: null, commit: null, branch: null,
               buildTime: null,
               dirty: false } as unknown as SystemInfo['build'],
      dhis2: { configured: true, probeReachable: true,
               centralVersion: null, pinnedVersion: null,
               profileName: null, probeDurationMs: null,
               baseUrl: 'x' } as unknown as SystemInfo['dhis2'],
    })} />));
    /* The uid-fallback em-dash surfaces for version + bytes +
     * profile + probe. */
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    /* No duration → "?ms probe" fallback. */
    expect(screen.getByText(/\?ms probe/)).toBeInTheDocument();
    /* uptimeMin=0 → "0m" branch. */
    expect(screen.getByText(/up 0m/)).toBeInTheDocument();
  });

  it('uptime band — hours+minutes branch (<1440m)', () => {
    render(wrap(<HealthCards info={info({
      runtime: { heapUsedBytes: 1024, heapMaxBytes: 2048,
                 uptimeMillis: 125 * 60_000, /* 2h 5m */
      } as unknown as SystemInfo['runtime'],
    })} />));
    /* 125 min = 2h 5m — hits the <1440 && ≥60 arm. */
    expect(screen.getByText(/up 2h 5m/)).toBeInTheDocument();
  });

  it('uptime band — days branch (≥1440m)', () => {
    render(wrap(<HealthCards info={info({
      runtime: { heapUsedBytes: 1024, heapMaxBytes: 2048,
                 uptimeMillis: 3 * 1440 * 60_000, /* 3 days */
      } as unknown as SystemInfo['runtime'],
    })} />));
    expect(screen.getByText(/up 3d/)).toBeInTheDocument();
  });

  it('pillCls default arm (REJECT/DOWN) via storage.status unknown', () => {
    /* storage.status comes through as a cast — passing 'REJECT'
     * hits the default-danger arm in pillCls. */
    render(wrap(<HealthCards info={info({
      storage: { totalBytes: 100, usableBytes: 50,
                 status: 'REJECT' as 'OK' | 'WARN',
                 root: '/' },
    })} />));
    expect(screen.getByText('REJECT')).toBeInTheDocument();
  });

  it('centralVersion falls back to pinnedVersion when central is null', () => {
    render(wrap(<HealthCards info={info({
      dhis2: { configured: true, probeReachable: true,
               centralVersion: null, pinnedVersion: '2.43',
               profileName: 'alt',
               probeDurationMs: 100,
               baseUrl: 'x' } as unknown as SystemInfo['dhis2'],
    })} />));
    expect(screen.getByText('2.43')).toBeInTheDocument();
  });
});
