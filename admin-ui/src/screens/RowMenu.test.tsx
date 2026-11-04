/**
 * Focused tests for the keyboard + a11y behavior of the RowMenu
 * primitive used across every list screen (users, roles, authorities,
 * referral inbox, device fleet, etc.).  The primitive itself lives in
 * shared.tsx; this file mounts a minimal MemoryRouter + wrapper so
 * `to:` items can render as <Link>.
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RowMenu } from './shared';

function renderMenu(items: Parameters<typeof RowMenu>[0]['items']): void {
  render(
    <MemoryRouter>
      <RowMenu items={items} label="Row actions" />
      {/* Sibling focus-sink so Tab-from-last-item leaves the menu. */}
      <button type="button" data-test="outside">outside</button>
    </MemoryRouter>,
  );
}

describe('RowMenu — keyboard a11y', () => {
  it('summary carries aria-haspopup + aria-expanded that flips on toggle', async () => {
    const user = userEvent.setup();
    renderMenu([{ label: 'Edit', onSelect: vi.fn() }]);
    const kebab = screen.getByLabelText('Row actions');
    expect(kebab).toHaveAttribute('aria-haspopup', 'menu');
    expect(kebab).toHaveAttribute('aria-expanded', 'false');
    await user.click(kebab);
    expect(kebab).toHaveAttribute('aria-expanded', 'true');
  });

  it('opening the menu auto-focuses the first enabled item', async () => {
    const user = userEvent.setup();
    renderMenu([
      { label: 'Disabled', onSelect: vi.fn(), disabled: true },
      { label: 'Edit', onSelect: vi.fn() },
      { label: 'Duplicate', onSelect: vi.fn() },
    ]);
    await user.click(screen.getByLabelText('Row actions'));
    /* Focus skips the disabled first item and lands on Edit. */
    expect(screen.getByText('Edit')).toHaveFocus();
  });

  it('ArrowDown moves roving focus to the next enabled item; wraps', async () => {
    const user = userEvent.setup();
    renderMenu([
      { label: 'Edit', onSelect: vi.fn() },
      { label: 'Duplicate', onSelect: vi.fn() },
      { label: 'Delete', onSelect: vi.fn(), danger: true },
    ]);
    await user.click(screen.getByLabelText('Row actions'));
    expect(screen.getByText('Edit')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByText('Duplicate')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByText('Delete')).toHaveFocus();
    /* Wraps back to the first. */
    await user.keyboard('{ArrowDown}');
    expect(screen.getByText('Edit')).toHaveFocus();
  });

  it('ArrowUp moves backwards and wraps', async () => {
    const user = userEvent.setup();
    renderMenu([
      { label: 'A', onSelect: vi.fn() },
      { label: 'B', onSelect: vi.fn() },
      { label: 'C', onSelect: vi.fn() },
    ]);
    await user.click(screen.getByLabelText('Row actions'));
    await user.keyboard('{ArrowUp}');
    /* From A (first), ArrowUp wraps to C. */
    expect(screen.getByText('C')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByText('B')).toHaveFocus();
  });

  it('Home / End jump to first and last enabled items', async () => {
    const user = userEvent.setup();
    renderMenu([
      { label: 'A', onSelect: vi.fn() },
      { label: 'B', onSelect: vi.fn() },
      { label: 'C', onSelect: vi.fn() },
    ]);
    await user.click(screen.getByLabelText('Row actions'));
    await user.keyboard('{End}');
    expect(screen.getByText('C')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByText('A')).toHaveFocus();
  });

  it('Escape closes the menu and returns focus to the kebab', async () => {
    const user = userEvent.setup();
    renderMenu([{ label: 'Edit', onSelect: vi.fn() }]);
    const kebab = screen.getByLabelText('Row actions');
    await user.click(kebab);
    expect(screen.getByText('Edit')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(kebab).toHaveAttribute('aria-expanded', 'false');
    expect(kebab).toHaveFocus();
  });

  it('activating a menu item fires onSelect and closes the menu', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderMenu([{ label: 'Edit', onSelect: onEdit }]);
    const kebab = screen.getByLabelText('Row actions');
    await user.click(kebab);
    /* Enter on the focused item (Edit) fires onSelect + closes. */
    await user.keyboard('{Enter}');
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(kebab).toHaveAttribute('aria-expanded', 'false');
  });

  it('disabled items are skipped by keyboard navigation', async () => {
    const user = userEvent.setup();
    renderMenu([
      { label: 'Edit', onSelect: vi.fn() },
      { label: 'Cannot', onSelect: vi.fn(), disabled: true },
      { label: 'Duplicate', onSelect: vi.fn() },
    ]);
    await user.click(screen.getByLabelText('Row actions'));
    /* ArrowDown from Edit skips Cannot and lands on Duplicate. */
    await user.keyboard('{ArrowDown}');
    expect(screen.getByText('Duplicate')).toHaveFocus();
  });

  it('Tab closes the menu (focus leaves naturally)', async () => {
    const user = userEvent.setup();
    renderMenu([{ label: 'Edit', onSelect: vi.fn() }]);
    const kebab = screen.getByLabelText('Row actions');
    await user.click(kebab);
    expect(screen.getByText('Edit')).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(kebab).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking outside closes the menu', async () => {
    const user = userEvent.setup();
    renderMenu([{ label: 'Edit', onSelect: vi.fn() }]);
    const kebab = screen.getByLabelText('Row actions');
    await user.click(kebab);
    expect(kebab).toHaveAttribute('aria-expanded', 'true');
    /* Mousedown on the sibling button — document-level listener closes. */
    await user.click(screen.getByTestId('outside'));
    expect(kebab).toHaveAttribute('aria-expanded', 'false');
  });

  it('danger items are marked with aria-disabled when disabled', async () => {
    const user = userEvent.setup();
    renderMenu([
      { label: 'Delete', onSelect: vi.fn(), danger: true, disabled: true },
    ]);
    await user.click(screen.getByLabelText('Row actions'));
    const item = screen.getByText('Delete');
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toBeDisabled();
  });
});
