import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useOnlineStatus } from './useOnlineStatus';

function Probe(): JSX.Element {
  const online = useOnlineStatus();
  return <span data-test="status">{online ? 'online' : 'offline'}</span>;
}

afterEach(() => {
  // restore default — jsdom treats navigator.onLine as true
  Object.defineProperty(navigator, 'onLine', {
    value: true, configurable: true,
  });
});

describe('useOnlineStatus', () => {
  it('starts from navigator.onLine', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true, configurable: true,
    });
    render(<Probe />);
    expect(screen.getByTestId('status')).toHaveTextContent('online');
  });

  it('flips on offline + online events', () => {
    render(<Probe />);
    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: false, configurable: true,
      });
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('status')).toHaveTextContent('offline');
    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: true, configurable: true,
      });
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByTestId('status')).toHaveTextContent('online');
  });
});
