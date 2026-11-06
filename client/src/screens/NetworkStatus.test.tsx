import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetworkStatus } from './NetworkStatus';
import { renderWithProviders } from '../test/renderWithProviders';

const status = { mode: 'edge-only', wanOnline: true, lanOnline: true };
const ifaces = [
  { name: 'eth0', state: 'up', purpose: 'wan', ipv4: '192.168.1.5', mac: 'aa:bb:cc:dd:ee:ff' },
  { name: 'wlan0', state: 'up', purpose: 'ap', ipv4: '10.0.0.1', mac: '11:22:33:44:55:66' },
];
const ap = { ssid: 'DER-EDGE', band: '5GHz', security: 'WPA2', channel: 36, running: true };

afterEach(() => { vi.restoreAllMocks(); });

function stubApi(overrides: Record<string, unknown> = {}): never {
  return {
    networkStatus: vi.fn().mockResolvedValue(status),
    listNetworkInterfaces: vi.fn().mockResolvedValue({ interfaces: ifaces }),
    networkAccessPoint: vi.fn().mockResolvedValue(ap),
    ...overrides,
  } as never;
}

describe('NetworkStatus', () => {
  it('renders status + AP + interfaces', async () => {
    renderWithProviders(<NetworkStatus api={stubApi()} />);
    await waitFor(() =>
      expect(screen.getByTestId('network-status-heading')).toBeInTheDocument());
    expect(screen.getByTestId('network-status-mode')).toHaveTextContent('edge-only');
    expect(screen.getByTestId('network-ap-ssid')).toHaveTextContent('DER-EDGE');
    expect(screen.getByTestId('network-iface-eth0')).toHaveTextContent('192.168.1.5');
    expect(screen.getByTestId('network-iface-wlan0')).toHaveTextContent('ap');
  });

  it('empty state when server returns no interfaces', async () => {
    renderWithProviders(
      <NetworkStatus api={stubApi({
        listNetworkInterfaces: vi.fn().mockResolvedValue({ interfaces: [] }),
      })} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('network-ifaces-empty')).toBeInTheDocument());
  });

  it('empty summary + empty AP when server returns {} ', async () => {
    renderWithProviders(
      <NetworkStatus api={stubApi({
        networkStatus: vi.fn().mockResolvedValue({}),
        networkAccessPoint: vi.fn().mockResolvedValue({}),
      })} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('network-status-empty')).toBeInTheDocument());
    expect(screen.getByTestId('network-ap-empty')).toBeInTheDocument();
  });

  it('filters out object-valued and null-valued keys from the summary', async () => {
    renderWithProviders(
      <NetworkStatus api={stubApi({
        networkStatus: vi.fn().mockResolvedValue({
          mode: 'edge-only',
          wanOnline: null,
          extras: { nested: 'ignored' },
        }),
      })} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('network-status-mode')).toBeInTheDocument());
    expect(screen.queryByTestId('network-status-extras')).not.toBeInTheDocument();
    expect(screen.queryByTestId('network-status-wanOnline')).not.toBeInTheDocument();
  });

  it('error state when a fetch rejects', async () => {
    renderWithProviders(
      <NetworkStatus api={stubApi({
        networkStatus: vi.fn().mockRejectedValue(new Error('boom')),
      })} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('network-status-error')).toBeInTheDocument());
  });

  it('non-Error rejection surfaces as string', async () => {
    renderWithProviders(
      <NetworkStatus api={stubApi({
        networkStatus: vi.fn().mockRejectedValue('nope'),
      })} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('network-status-error')).toBeInTheDocument());
  });

  it('coerces non-primitive interface fields to —', async () => {
    renderWithProviders(
      <NetworkStatus api={stubApi({
        listNetworkInterfaces: vi.fn().mockResolvedValue({ interfaces: [{
          name: 'eth0', state: null, purpose: undefined, ipv4: {}, mac: 'aa',
        }] }),
      })} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('network-iface-eth0')).toBeInTheDocument());
    const cells = screen.getByTestId('network-iface-eth0').querySelectorAll('td');
    // name=eth0, state=—, purpose=—, ipv4=—, mac=aa
    expect(cells[1].textContent).toBe('—');
    expect(cells[2].textContent).toBe('—');
    expect(cells[3].textContent).toBe('—');
  });
});
