import { useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MODULES } from './modules';

export interface DerAppLauncherProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/**
 * ADR-0037 C-UI-2 — App launcher overlay.
 *
 * Shown above the shell as a dismissable modal grid of the six
 * Server-Module tiles. In C-UI-5 the grid also surfaces the
 * DER-dispatched apps catalogue; for now it's just the six first-
 * party modules.
 *
 * Behaviour:
 *   - Esc or backdrop click closes.
 *   - Clicking a tile navigates (via react-router Link) and then
 *     closes.
 *   - Focus lands on the first tile on open.
 *   - Arrow keys nav between tiles (the browser's default Tab
 *     order already gives linear traversal; arrows add a 2D
 *     affordance matching DHIS2's app menu).
 */
export function DerAppLauncher(
  { open, onClose }: DerAppLauncherProps,
): JSX.Element | null {
  const gridRef = useRef<HTMLDivElement>(null);
  const firstTileRef = useRef<HTMLAnchorElement>(null);

  // On open, focus the first tile so keyboard users land on a
  // meaningful target.
  useEffect(() => {
    if (open) firstTileRef.current?.focus();
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  const onArrow = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      return;
    }
    e.preventDefault();
    const tiles = Array.from(
      gridRef.current?.querySelectorAll<HTMLAnchorElement>('a.der-launcher__tile')
      ?? [],
    );
    const active = tiles.findIndex((t) => t === document.activeElement);
    if (active === -1) { tiles[0]?.focus(); return; }
    // 3-col grid at ≥641 px, 2-col at ≤640 px.
    const cols = window.innerWidth <= 640 ? 2 : 3;
    let next = active;
    if (e.key === 'ArrowRight') next = Math.min(active + 1, tiles.length - 1);
    if (e.key === 'ArrowLeft')  next = Math.max(active - 1, 0);
    if (e.key === 'ArrowDown')  next = Math.min(active + cols, tiles.length - 1);
    if (e.key === 'ArrowUp')    next = Math.max(active - cols, 0);
    tiles[next]?.focus();
  }, []);

  if (!open) return null;

  return (
    <div className="der-launcher-backdrop"
         data-test="der-launcher-backdrop"
         onClick={(e) => {
           if (e.target === e.currentTarget) onClose();
         }}>
      <div className="der-launcher"
           role="dialog"
           aria-modal="true"
           aria-labelledby="der-launcher-title"
           data-test="der-launcher">
        <header className="der-launcher__header">
          <h2 id="der-launcher-title" className="der-launcher__title">
            Server modules
          </h2>
          <button type="button"
                  className="der-launcher__close"
                  data-test="der-launcher-close"
                  aria-label="Close launcher"
                  onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="der-launcher__grid"
             ref={gridRef}
             onKeyDown={onArrow}>
          {MODULES.map((m, i) => (
            <Link key={m.id}
                  to={m.to}
                  className="der-launcher__tile"
                  data-test={m.testId}
                  ref={i === 0 ? firstTileRef : undefined}
                  onClick={onClose}>
              <svg className="der-launcher__tile-icon"
                   viewBox="0 0 24 24"
                   aria-hidden="true">
                <path d={m.icon} />
              </svg>
              <span className="der-launcher__tile-label">{m.label}</span>
              <span className="der-launcher__tile-subtitle">{m.subtitle}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
