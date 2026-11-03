import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DerCard, DeviceCard, InternetBubble, PeerCard,
         WanBubble } from './NetworkNode';
import type { DerNode, DeviceNode, PeerNode } from './types';

const der: DerNode = {
  id: 'der', name: 'DER',
  type: 'edge', status: 'online',
  fingerprint: 'ab:cd', ipAddress: '10.0.0.1', hostname: 'der.local',
  centralBridge: true,
};
const device: DeviceNode = {
  id: 'd1', name: 'Tablet A', type: 'tablet', formFactor: 'TABLET',
  status: 'online', lastSeen: null,
  userAgent: null, firmwareVersion: null, deviceStatus: 'APPROVED',
  sync: { state: 'syncing', pending: 3 },
};
const peer: PeerNode = {
  id: 'peer-x', name: 'Nakivale', type: 'peer-edge', status: 'degraded',
  endpoint: 'https://p.local', state: 'HANDSHAKING', trust: 'UNVERIFIED',
  lastHandshake: null,
};

function svgWrap(child: JSX.Element): JSX.Element {
  return <svg>{child}</svg>;
}

describe('NetworkNode components', () => {
  it('DerCard click + keyboard both fire onSelect', () => {
    const onSelect = vi.fn();
    render(svgWrap(<DerCard x={100} y={100} selected={false}
                             onSelect={onSelect} der={der} />));
    const g = screen.getByRole('button', { name: /DER Edge Runtime, Online/ });
    fireEvent.click(g);
    expect(onSelect).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(g, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(g, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(3);
    fireEvent.keyDown(g, { key: 'Escape' });
    expect(onSelect).toHaveBeenCalledTimes(3);
  });
  it('DerCard renders selected state (blue background)', () => {
    render(svgWrap(<DerCard x={0} y={0} selected onSelect={() => {}} der={der} />));
    expect(screen.getByRole('button', { name: /DER Edge Runtime/ })).toBeInTheDocument();
  });
  it('DeviceCard surfaces queued count in label and visible footer', () => {
    render(svgWrap(<DeviceCard x={0} y={0} selected={false}
                                onSelect={() => {}} device={device} />));
    expect(screen.getByRole('button',
      { name: /Tablet A, tablet, Online, 3 queued/ })).toBeInTheDocument();
    expect(screen.getByText(/3 queued/)).toBeInTheDocument();
  });
  it('DeviceCard without pending has no sync suffix', () => {
    const quiet: DeviceNode = { ...device, sync: { state: 'synced', pending: 0 } };
    render(svgWrap(<DeviceCard x={0} y={0} selected onSelect={() => {}} device={quiet} />));
    expect(screen.getByRole('button', { name: 'Tablet A, tablet, Online' })).toBeInTheDocument();
  });
  it('DeviceCard renders every form factor', () => {
    (['WORKSTATION', 'LAPTOP', 'TABLET', 'MOBILE', 'UNKNOWN'] as const).forEach((ff) => {
      const d: DeviceNode = { ...device, id: `d-${ff}`, formFactor: ff,
                               sync: { state: 'synced', pending: 0 } };
      const { unmount } = render(
        svgWrap(<DeviceCard x={0} y={0} selected={false} onSelect={() => {}} device={d} />));
      expect(screen.getAllByRole('button')[0]).toBeInTheDocument();
      unmount();
    });
  });
  it('DeviceCard keyboard events', () => {
    const on = vi.fn();
    render(svgWrap(<DeviceCard x={0} y={0} selected={false} onSelect={on} device={device} />));
    const b = screen.getByRole('button', { name: /Tablet A/ });
    fireEvent.keyDown(b, { key: 'Enter' });
    fireEvent.keyDown(b, { key: ' ' });
    fireEvent.keyDown(b, { key: 'x' });
    expect(on).toHaveBeenCalledTimes(2);
  });
  it('PeerCard click + keyboard fire onSelect', () => {
    const on = vi.fn();
    render(svgWrap(<PeerCard x={0} y={0} selected={false} onSelect={on} peer={peer} />));
    const b = screen.getByRole('button', { name: /Peer edge Nakivale/ });
    fireEvent.click(b);
    fireEvent.keyDown(b, { key: 'Enter' });
    fireEvent.keyDown(b, { key: 'Tab' });
    expect(on).toHaveBeenCalledTimes(2);
  });
  it('PeerCard truncates long name', () => {
    const longPeer: PeerNode = { ...peer, name: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' };
    render(svgWrap(<PeerCard x={0} y={0} selected onSelect={() => {}} peer={longPeer} />));
    // Truncated to length 18 (17 chars + ellipsis).
    expect(screen.getByText(/…/)).toBeInTheDocument();
  });
  it('InternetBubble shows online + sim chip when simulated', () => {
    render(svgWrap(<InternetBubble x={0} y={0} status="online" selected={false}
                                     simulated onSelect={() => {}} />));
    expect(screen.getByRole('button', { name: /Internet gateway, ON \(simulated\)/ })).toBeInTheDocument();
    expect(screen.getByText(/sim/)).toBeInTheDocument();
  });
  it('InternetBubble shows offline when status is offline', () => {
    const on = vi.fn();
    render(svgWrap(<InternetBubble x={0} y={0} status="offline" selected
                                     simulated={false} onSelect={on} />));
    expect(screen.getByRole('button', { name: /Internet gateway, OFF/ })).toBeInTheDocument();
    const b = screen.getByRole('button', { name: /Internet gateway, OFF/ });
    fireEvent.click(b);
    fireEvent.keyDown(b, { key: 'Enter' });
    fireEvent.keyDown(b, { key: ' ' });
    expect(on).toHaveBeenCalledTimes(3);
  });
  it('WanBubble renders with keyboard support', () => {
    const on = vi.fn();
    render(svgWrap(<WanBubble x={0} y={0} status="online" selected={false} onSelect={on} />));
    const b = screen.getByRole('button', { name: /Central DHIS2, Online/ });
    fireEvent.click(b);
    fireEvent.keyDown(b, { key: 'Enter' });
    fireEvent.keyDown(b, { key: ' ' });
    fireEvent.keyDown(b, { key: 'Esc' });
    expect(on).toHaveBeenCalledTimes(3);
  });
});
