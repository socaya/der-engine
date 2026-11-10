import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useFocusTrap } from './useFocusTrap';

/** Harness — mounts a dialog-shaped node whose trap can be toggled. */
function Dialog({ active, onClose }:
  { active: boolean; onClose: () => void }): JSX.Element {
  const ref = useFocusTrap<HTMLDivElement>({ active, onClose });
  return (
    <>
      <button data-test="outside">outside</button>
      {active && (
        <div ref={ref} data-test="dialog" role="dialog" aria-modal="true">
          <button data-test="first">first</button>
          <button data-test="middle">middle</button>
          <button data-test="last">last</button>
        </div>
      )}
    </>
  );
}

describe('useFocusTrap', () => {
  it('focuses the first focusable descendant on mount', () => {
    render(<Dialog active onClose={() => undefined} />);
    expect(screen.getByTestId('first')).toHaveFocus();
  });

  it('cycles focus to the last element when Shift+Tab lands on the first', async () => {
    render(<Dialog active onClose={() => undefined} />);
    const user = userEvent.setup();
    /* focused is first by useFocusTrap; Shift+Tab should wrap to last */
    expect(screen.getByTestId('first')).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByTestId('last')).toHaveFocus();
  });

  it('cycles focus to the first element when Tab lands on the last', async () => {
    render(<Dialog active onClose={() => undefined} />);
    const user = userEvent.setup();
    /* navigate to last */
    screen.getByTestId('last').focus();
    await user.tab();
    expect(screen.getByTestId('first')).toHaveFocus();
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<Dialog active onClose={onClose} />);
    act(() => {
      screen.getByTestId('dialog').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the opener when the dialog unmounts', () => {
    const { rerender } = render(<Dialog active={false} onClose={() => undefined} />);
    screen.getByTestId('outside').focus();
    expect(screen.getByTestId('outside')).toHaveFocus();
    rerender(<Dialog active onClose={() => undefined} />);
    expect(screen.getByTestId('first')).toHaveFocus();
    rerender(<Dialog active={false} onClose={() => undefined} />);
    expect(screen.getByTestId('outside')).toHaveFocus();
  });

  it('does nothing when active is false', () => {
    render(
      <>
        <button data-test="outside">outside</button>
        <Dialog active={false} onClose={() => undefined} />
      </>,
    );
    /* no dialog rendered, outside button is reachable */
    expect(screen.queryByTestId('dialog')).toBeNull();
  });
});
