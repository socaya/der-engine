import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NetworkSummary } from './NetworkSummary';
import type { TopologySummary } from './types';

const base: TopologySummary = {
  devices: 10,
  devicesOnline: 7,
  devicesDegraded: 0,
  devicesOffline: 0,
  syncQueueTotal: 42,
  peers: 2,
  peersConnected: 1,
  wanStatus: 'online',
};

describe('NetworkSummary', () => {
  it('renders every counter row', () => {
    render(<NetworkSummary summary={base} />);
    const dl = screen.getByLabelText('Network status summary');
    expect(dl).toHaveTextContent('Devices');
    expect(dl).toHaveTextContent('10');
    expect(dl).toHaveTextContent('Online');
    expect(dl).toHaveTextContent('7');
    expect(dl).toHaveTextContent('Sync queue');
    expect(dl).toHaveTextContent('42');
    expect(dl).toHaveTextContent('DHIS2');
  });
  it('hides the degraded tone when there are no degraded devices', () => {
    const { container } = render(<NetworkSummary summary={base} />);
    // Degraded label text is still in the dl (as a <dt>) but no colour badge.
    expect(container.querySelector('[aria-label="Network status summary"]'))
      .toHaveTextContent('Degraded');
  });
  it('shows degraded/offline badges when counts are non-zero', () => {
    render(<NetworkSummary summary={{
      ...base, devicesDegraded: 2, devicesOffline: 3,
    }} />);
    expect(screen.getByText('Degraded')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });
  it('reflects wanStatus in the DHIS2 row', () => {
    render(<NetworkSummary summary={{ ...base, wanStatus: 'offline' }} />);
    const dl = screen.getByLabelText('Network status summary');
    expect(dl).toHaveTextContent('Offline');
  });
});
