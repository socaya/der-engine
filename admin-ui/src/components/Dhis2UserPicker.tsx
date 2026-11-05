import { useEffect, useRef, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import { Status } from '../screens/shared';

/**
 * Single-select searchable combobox for the bound DHIS2 central's users.
 *
 * <p>Follows the DER MetadataPicker pattern: focus opens a dropdown,
 * typing queries central through
 * {@code /edge-api/v1/admin/users/dhis2-candidates}, click on a row
 * fills the field.  The result label is always
 * {@code @username — displayName} so operators recognise who they're
 * about to map without having to parse the uid.</p>
 *
 * <p>Falls back gracefully: when the central probe fails (503 / 502)
 * the dropdown shows a danger hint but the input stays usable so an
 * operator who already knows the uid can paste it directly.  The
 * combobox pre-populates the selectedLabel from
 * {@link Dhis2UserPickerProps#selectedLabel} so Edit flows start with
 * the current mapping visible in the field.</p>
 */
export interface Dhis2UserPickerProps {
  /** Currently selected DHIS2 uid, if any. */
  readonly value: string | null;
  /** Pre-rendered label of the current selection (e.g. '@alice.c — Alice Central'). */
  readonly selectedLabel: string | null;
  /** Called with the full candidate on pick; null when the user clears the field. */
  readonly onChange: (c: edgeApi.EdgeDhis2UserCandidate | null) => void;
  readonly dataTest?: string;
  readonly disabled?: boolean;
  readonly placeholder?: string;
}

export function Dhis2UserPicker(
  { value, selectedLabel, onChange, dataTest, disabled, placeholder }:
    Dhis2UserPickerProps,
): JSX.Element {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<edgeApi.EdgeDhis2UserCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Click-outside closes the menu (so the picker behaves like a native select).
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(ev: MouseEvent): void {
      const node = containerRef.current;
      if (node && ev.target instanceof Node && !node.contains(ev.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  // Debounced search while open.  Fires once on open with the empty query
  // so the dropdown has a first page of users ready.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    const handle = window.setTimeout(() => {
      edgeApi.searchDhis2UserCandidates(query, 20)
        .then((r) => { if (!cancelled) setCandidates(r.candidates); })
        .catch((e: unknown) => {
          if (!cancelled) {
            setCandidates([]);
            setErr(e instanceof Error ? e.message : String(e));
          }
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, query ? 200 : 0);
    return () => { cancelled = true; window.clearTimeout(handle); };
  }, [open, query]);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  }

  function pick(c: edgeApi.EdgeDhis2UserCandidate): void {
    if (c.id == null || c.username == null) return;
    onChange(c);
    setQuery('');
    setOpen(false);
  }

  // Value shown in the input: the typed query while open, otherwise
  // the current selection label.  When neither, the input is empty.
  const display = open
    ? query
    : (selectedLabel ?? '');

  return (
    <div className="ea-combobox"
         ref={containerRef}
         data-test={dataTest}>
      <input
        type="search"
        className="ea-input ea-combobox-input"
        ref={inputRef}
        value={display}
        disabled={disabled}
        placeholder={placeholder ?? 'Search DHIS2 Central users…'}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-test={dataTest ? `${dataTest}-input` : undefined}
        onFocus={() => { setQuery(''); setOpen(true); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={onInputKeyDown}
      />
      <span className="ea-combobox-caret" aria-hidden="true">▼</span>
      {open && (
        <div className="ea-combobox-menu"
             role="listbox"
             data-test={dataTest ? `${dataTest}-menu` : undefined}>
          {/* Sticky summary row so operators always see the result count
           *  + the search context, even after scrolling the list. */}
          {!loading && !err && candidates.length > 0 && (
            <div className="ea-combobox-hint">
              {candidates.length} match{candidates.length === 1 ? '' : 'es'}
              {query.trim() ? ` for '${query.trim()}'` : ''}
              {candidates.length === 20 && ' (first page — type to narrow)'}
            </div>
          )}
          {loading && (
            <div className="ea-combobox-hint">Searching DHIS2 Central…</div>
          )}
          {!loading && err && (
            <div className="ea-combobox-hint ea-combobox-hint--danger">
              DHIS2 search failed: {err}.  Paste a DHIS2 uid directly if
              you already know it.
            </div>
          )}
          {!loading && !err && candidates.length === 0 && (
            <div className="ea-combobox-hint">
              {query.trim()
                ? 'No DHIS2 users match this query.'
                : 'No DHIS2 users returned.  Start typing to search.'}
            </div>
          )}
          {!loading && !err && candidates.map((c) => {
            const active = value != null && c.id === value;
            const unusable = c.id == null || c.username == null;
            return (
              <button key={c.id ?? c.username ?? Math.random()}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={unusable}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(c)}
                      className={'ea-combobox-row'
                        + (active ? ' ea-combobox-row--active' : '')}
                      title={`${c.displayName ?? ''} · @${c.username ?? '?'} · ${c.id ?? '?'}`}
                      data-test={dataTest && c.id
                        ? `${dataTest}-row-${c.id}` : undefined}>
                <span className="ea-combobox-row-title">
                  {c.displayName ?? '(no display name)'}
                </span>
                <span className="ea-combobox-row-meta ea-mono">
                  @{c.username ?? '—'}
                </span>
                {c.disabled && <Status tone="warning">Disabled</Status>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
