import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MODULES } from './modules';
import { useAppCatalogue, type CatalogueApp } from '../apps/catalogue';

export interface DerAppLauncherProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

interface Tile {
  readonly id: string;
  readonly to: string;
  readonly label: string;
  readonly testId: string;
  readonly iconPath?: string;
  readonly iconRects?: boolean;
  /** When set, the launcher renders this image URL instead of the
   *  inline SVG glyph — used by DER-dispatched apps that ship an
   *  icon inside their DHIS2-style zip manifest (C-UI-5c). */
  readonly iconImageUrl?: string | null;
}

/**
 * ADR-0037 C-UI-2/5a — App launcher.
 *
 * Faithful to DHIS2's `@dhis2-ui/header-bar` apps dropdown:
 * right-anchored panel, "Search apps" filter at top, a single flat
 * wrap-and-flow grid of 96 px tiles with a 48 px icon on each.
 * No section dividers — Server Modules and the DER-dispatched apps
 * catalogue sit in one unified list, exactly how DHIS2 renders
 * Capture / Maintenance / dashboard / etc. in a single pane.
 *
 * Behaviour:
 *   - Esc or outside click closes (no explicit × button, matching
 *     DHIS2's `@dhis2-ui` apps panel — close UX is positional).
 *   - Clicking a tile navigates and closes.
 *   - Opening focuses the filter input (initialFocus).
 *   - Arrow keys 2-D-navigate the tile grid.
 */
export function DerAppLauncher(
  { open, onClose }: DerAppLauncherProps,
): JSX.Element | null {
  const gridRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');
  const { apps } = useAppCatalogue(open);

  const tiles: Tile[] = useMemo(() => {
    const mods: Tile[] = MODULES.map((m) => ({
      id: `mod-${m.id}`,
      to: m.to,
      label: m.label,
      testId: m.testId,
      iconPath: m.icon,
    }));
    const extra: Tile[] = apps.map((a: CatalogueApp) => ({
      id: `app-${a.appKey}`,
      to: `/apps/${a.appKey}`,
      label: a.displayName,
      testId: `der-launcher-app-${a.appKey}`,
      iconRects: true,
      iconImageUrl: a.iconUrl,
    }));
    return [...mods, ...extra];
  }, [apps]);

  const q = filter.trim().toLowerCase();
  const visible = q === ''
    ? tiles
    : tiles.filter((t) => t.label.toLowerCase().includes(q));

  useEffect(() => {
    if (open) filterRef.current?.focus();
    if (!open) setFilter('');
  }, [open]);

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
    /* v8 ignore next 2 — defensive fallback when ref isn't attached yet. */
    const row = Array.from(
      gridRef.current?.querySelectorAll<HTMLAnchorElement>('a.der-launcher__tile')
      ?? [],
    );
    const active = row.findIndex((t) => t === document.activeElement);
    if (active === -1) { row[0]?.focus(); return; }
    const cols = window.innerWidth <= 640 ? 2 : 3;
    let next = active;
    if (e.key === 'ArrowRight') next = Math.min(active + 1, row.length - 1);
    if (e.key === 'ArrowLeft')  next = Math.max(active - 1, 0);
    if (e.key === 'ArrowDown')  next = Math.min(active + cols, row.length - 1);
    if (e.key === 'ArrowUp')    next = Math.max(active - cols, 0);
    row[next]?.focus();
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
        <h2 id="der-launcher-title" className="der-launcher__visually-hidden">
          App launcher
        </h2>
        <div className="der-launcher__search">
          <input
            ref={filterRef}
            type="search"
            className="der-launcher__filter"
            placeholder="Search apps"
            aria-label="Search apps"
            value={filter}
            data-test="der-launcher-filter"
            onChange={(e) => setFilter(e.target.value)}
          />
          {/* Keep a non-visual close for a11y so keyboard users not
              familiar with Esc can still dismiss. Matches DHIS2's
              "no visible chrome" spirit while covering WCAG 2.1. */}
          <button type="button"
                  className="der-launcher__close"
                  data-test="der-launcher-close"
                  aria-label="Close launcher"
                  onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="der-launcher__list"
             ref={gridRef}
             onKeyDown={onArrow}
             data-test="der-launcher-list">
          {visible.length === 0 ? (
            <div className="der-launcher__empty"
                 data-test="der-launcher-empty">
              No apps match “{filter}”.
            </div>
          ) : (
            visible.map((t) => (
              <Link key={t.id}
                    to={t.to}
                    className="der-launcher__tile"
                    data-test={t.testId}
                    onClick={onClose}>
                <span className="der-launcher__tile-glyph" aria-hidden="true">
                  {t.iconImageUrl ? (
                    <img src={t.iconImageUrl} alt=""
                         className="der-launcher__tile-img" />
                  ) : (
                    <svg viewBox="0 0 24 24">
                      {t.iconRects ? (
                        <>
                          <rect x="4" y="4" width="7" height="7" rx="1" />
                          <rect x="13" y="4" width="7" height="7" rx="1" />
                          <rect x="4" y="13" width="7" height="7" rx="1" />
                          <rect x="13" y="13" width="7" height="7" rx="1" />
                        </>
                      ) : (
                        <path d={t.iconPath} />
                      )}
                    </svg>
                  )}
                </span>
                <span className="der-launcher__tile-label">{t.label}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
