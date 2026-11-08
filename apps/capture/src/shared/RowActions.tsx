import { useEffect, useLayoutEffect, useRef, useState,
  type ReactNode } from 'react';

export interface RowAction {
  readonly label: string;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
  readonly destructive?: boolean;
  readonly title?: string;
}

/**
 * Three-dot action button + flat dropdown used on record rows
 * (Events, Tracker TEIs, enrolments). Keeps the row chrome calm
 * — the menu only appears on click. Closes on Escape, outside
 * click, or action select.
 */
export function RowActions(
  { label, actions, dataTest }:
  { label?: string; actions: readonly RowAction[];
    dataTest?: string },
): JSX.Element {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);
  /** Viewport-anchored menu coords. Computed from the trigger's
   *  getBoundingClientRect so the menu escapes the table-wrap's
   *  overflow-x: auto clipping context and renders above the
   *  pager / stage pane / anything else below it. */
  const [menuRect, setMenuRect] =
    useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) { setMenuRect(null); return; }
    function recompute() {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      setMenuRect({
        top: r.bottom + 2,
        right: window.innerWidth - r.right,
      });
    }
    recompute();
    window.addEventListener('scroll', recompute, true);
    window.addEventListener('resize', recompute);
    return () => {
      window.removeEventListener('scroll', recompute, true);
      window.removeEventListener('resize', recompute);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | KeyboardEvent): void => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setOpen(false);
        return;
      }
      if (!(e.target instanceof Node)) return;
      // Close if click lands outside both the trigger wrap AND
      // the floating menu (menu is portaled via position: fixed,
      // so a contains() on wrapRef alone would miss menu clicks).
      if (wrapRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onDown);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onDown);
    };
  }, [open]);

  return (
    <span className="cap-row-actions" ref={wrapRef}
          onClick={(e) => e.stopPropagation()}>
      <button type="button"
              className="cap-row-actions__trigger"
              data-test={dataTest ?? 'cap-row-actions-trigger'}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={label ?? 'Row actions'}
              title={label ?? 'Row actions'}
              onClick={(e) => { e.stopPropagation();
                setOpen((v) => !v); }}>
        <DotsIcon />
      </button>
      {open && menuRect && (
        <ul className="cap-row-actions__menu" role="menu"
            ref={menuRef}
            style={{ top: menuRect.top + 'px',
                     right: menuRect.right + 'px' }}>
          {actions.map((a, i) => (
            <li key={i} role="none">
              <button type="button"
                      role="menuitem"
                      className={'cap-row-actions__item'
                        + (a.destructive
                          ? ' cap-row-actions__item--danger' : '')}
                      disabled={a.disabled}
                      title={a.title}
                      data-test={'cap-row-action-' + a.label
                        .toLowerCase().replace(/\s+/g, '-')}
                      onClick={(e) => { e.stopPropagation();
                        setOpen(false);
                        a.onSelect(); }}>
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

function DotsIcon(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16"
         aria-hidden="true">
      <circle cx="3" cy="8" r="1.5" fill="currentColor" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="13" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}
