import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DerAppLauncher } from './DerAppLauncher';
import { MODULES } from './modules';
import { renderWithProviders } from '../test/renderWithProviders';

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
    const grid = screen.getByTestId('der-launcher').querySelector('.der-launcher__grid')!;
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
    const grid = screen.getByTestId('der-launcher').querySelector('.der-launcher__grid')!;
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByTestId(MODULES[0].testId));
  });

  it('ignores unrelated keys on the grid', () => {
    renderWithProviders(<DerAppLauncher open onClose={() => undefined} />);
    const grid = screen.getByTestId('der-launcher').querySelector('.der-launcher__grid')!;
    const first = screen.getByTestId(MODULES[0].testId) as HTMLAnchorElement;
    first.focus();
    fireEvent.keyDown(grid, { key: 'a' });
    expect(document.activeElement).toBe(first);
  });

  it('ArrowDown jumps by one row (3 cols on desktop), clamped at the end', () => {
    // The default jsdom window.innerWidth is 1024 → 3-col grid.
    renderWithProviders(<DerAppLauncher open onClose={() => undefined} />);
    const grid = screen.getByTestId('der-launcher').querySelector('.der-launcher__grid')!;
    const first = screen.getByTestId(MODULES[0].testId) as HTMLAnchorElement;
    first.focus();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByTestId(MODULES[3].testId));
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
  });
});
