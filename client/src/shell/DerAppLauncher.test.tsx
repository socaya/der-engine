import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DerAppLauncher } from './DerAppLauncher';
import { MODULES } from './modules';
import { renderWithProviders } from '../test/renderWithProviders';

beforeEach(() => {
  // Catalogue stays empty by default so existing module-only tests
  // don't accidentally get a second grid.
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    () => Promise.reject(new Error('stubbed')));
});
afterEach(() => vi.restoreAllMocks());

describe('DerAppLauncher', () => {
  it('renders nothing when closed', () => {
    renderWithProviders(<DerAppLauncher open={false} onClose={() => undefined} />);
    expect(screen.queryByTestId('der-launcher')).toBeNull();
  });

  it('renders every module tile when open', () => {
    renderWithProviders(<DerAppLauncher open onClose={() => undefined} />);
    for (const m of MODULES) {
      expect(screen.getByTestId(m.testId)).toHaveTextContent(m.label);
      expect(screen.getByTestId(m.testId)).toHaveAttribute('href', m.to);
    }
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    renderWithProviders(<DerAppLauncher open onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on backdrop click', () => {
    const onClose = vi.fn();
    renderWithProviders(<DerAppLauncher open onClose={onClose} />);
    fireEvent.click(screen.getByTestId('der-launcher-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does NOT close on dialog-content click', () => {
    const onClose = vi.fn();
    renderWithProviders(<DerAppLauncher open onClose={onClose} />);
    fireEvent.click(screen.getByTestId('der-launcher'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('close button fires onClose', () => {
    const onClose = vi.fn();
    renderWithProviders(<DerAppLauncher open onClose={onClose} />);
    fireEvent.click(screen.getByTestId('der-launcher-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking a tile also closes', () => {
    const onClose = vi.fn();
    renderWithProviders(<DerAppLauncher open onClose={onClose} />);
    fireEvent.click(screen.getByTestId(MODULES[0].testId));
    expect(onClose).toHaveBeenCalled();
  });

  it('arrow keys move focus between tiles', () => {
    renderWithProviders(<DerAppLauncher open onClose={() => undefined} />);
    const grid = screen.getByTestId('der-launcher').querySelector('.der-launcher__list')!;
    const first = screen.getByTestId(MODULES[0].testId) as HTMLAnchorElement;
    const second = screen.getByTestId(MODULES[1].testId) as HTMLAnchorElement;
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(first);
  });

  it('arrow keys with no tile focused default to first tile', () => {
    renderWithProviders(<DerAppLauncher open onClose={() => undefined} />);
    const grid = screen.getByTestId('der-launcher').querySelector('.der-launcher__list')!;
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByTestId(MODULES[0].testId));
  });

  it('ignores unrelated keys on the grid', () => {
    renderWithProviders(<DerAppLauncher open onClose={() => undefined} />);
    const grid = screen.getByTestId('der-launcher').querySelector('.der-launcher__list')!;
    const first = screen.getByTestId(MODULES[0].testId) as HTMLAnchorElement;
    first.focus();
    fireEvent.keyDown(grid, { key: 'a' });
    expect(document.activeElement).toBe(first);
  });

  it('adds catalogue apps into the unified tile list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      { ok: true, json: () => Promise.resolve({
        apps: [{
          appId: 'a1', appKey: 'hello', displayName: 'Hello DER',
          module: null, version: '1.0.0', bundleUrl: '/b',
          bundleSha256: 'ab', signatureB64: 'si',
          requiresDerApi: '1.0.0',
        }],
      }) } as unknown as Response);
    renderWithProviders(<DerAppLauncher open onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('der-launcher-app-hello'))
      .toHaveTextContent(/Hello DER/));
  });

  it('filters tiles by the search input', async () => {
    renderWithProviders(<DerAppLauncher open onClose={() => undefined} />);
    const filter = screen.getByTestId('der-launcher-filter') as HTMLInputElement;
    fireEvent.change(filter, { target: { value: 'zzz-no-match' } });
    await waitFor(() => expect(screen.getByTestId('der-launcher-empty'))
      .toBeInTheDocument());
  });

  it('ArrowDown clamps at the end of a single-row grid', () => {
    // MODULES is a 3-tile row (DHIS2/Network/Admin moved to the
    // profile menu per C-UI-5c); ArrowDown from tile 0 clamps at
    // the last tile.
    renderWithProviders(<DerAppLauncher open onClose={() => undefined} />);
    const grid = screen.getByTestId('der-launcher').querySelector('.der-launcher__list')!;
    const first = screen.getByTestId(MODULES[0].testId) as HTMLAnchorElement;
    first.focus();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByTestId(MODULES[MODULES.length - 1].testId));
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
  });
});
