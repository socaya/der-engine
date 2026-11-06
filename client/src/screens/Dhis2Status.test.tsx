import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dhis2Status } from './Dhis2Status';
import { renderWithProviders } from '../test/renderWithProviders';

const ping = {
  reachable: true, observedVersion: '2.44', latencyMs: 42,
  probedAt: '2026-11-05T10:00:00Z', message: null,
};
const compat = {
  status: 'COMPATIBLE', observedVersion: '2.44', pinnedVersion: '2.44',
  revision: 'abc', buildTime: '2026-10-01', message: null,
};

afterEach(() => { vi.restoreAllMocks(); });

describe('Dhis2Status', () => {
  it('renders ping + compat details', async () => {
    const api = {
      dhis2Ping: vi.fn().mockResolvedValue(ping),
      dhis2Compat: vi.fn().mockResolvedValue(compat),
    };
    renderWithProviders(<Dhis2Status api={api as never} />);
    await waitFor(() =>
      expect(screen.getByTestId('dhis2-status-heading')).toBeInTheDocument());
    expect(screen.getByTestId('dhis2-ping-ok')).toBeInTheDocument();
    expect(screen.getByTestId('dhis2-ping-version')).toHaveTextContent('2.44');
    expect(screen.getByTestId('dhis2-ping-latency')).toHaveTextContent('42');
    expect(screen.getByTestId('dhis2-compat-status')).toHaveTextContent('COMPATIBLE');
  });

  it('shows the Not-reachable tag when ping.reachable=false', async () => {
    const api = {
      dhis2Ping: vi.fn().mockResolvedValue({
        ...ping, reachable: false, message: 'timeout',
      }),
      dhis2Compat: vi.fn().mockResolvedValue({ ...compat, status: 'DEGRADED' }),
    };
    renderWithProviders(<Dhis2Status api={api as never} />);
    await waitFor(() =>
      expect(screen.getByTestId('dhis2-ping-fail')).toBeInTheDocument());
    expect(screen.getByTestId('dhis2-ping-message')).toHaveTextContent('timeout');
    expect(screen.getByTestId('dhis2-compat-status')).toHaveTextContent('DEGRADED');
  });

  it('shows NEGATIVE tag for incompatible status', async () => {
    const api = {
      dhis2Ping: vi.fn().mockResolvedValue(ping),
      dhis2Compat: vi.fn().mockResolvedValue({ ...compat, status: 'INCOMPATIBLE', message: 'bad' }),
    };
    renderWithProviders(<Dhis2Status api={api as never} />);
    await waitFor(() =>
      expect(screen.getByTestId('dhis2-compat-message')).toHaveTextContent('bad'));
  });

  it('error state when the fetch rejects', async () => {
    const api = {
      dhis2Ping: vi.fn().mockRejectedValue(new Error('boom')),
      dhis2Compat: vi.fn().mockResolvedValue(compat),
    };
    renderWithProviders(<Dhis2Status api={api as never} />);
    await waitFor(() =>
      expect(screen.getByTestId('dhis2-status-error')).toBeInTheDocument());
  });

  it('non-Error rejection surfaces as string', async () => {
    const api = {
      dhis2Ping: vi.fn().mockRejectedValue('nope'),
      dhis2Compat: vi.fn().mockResolvedValue(compat),
    };
    renderWithProviders(<Dhis2Status api={api as never} />);
    await waitFor(() =>
      expect(screen.getByTestId('dhis2-status-error')).toBeInTheDocument());
  });
});
