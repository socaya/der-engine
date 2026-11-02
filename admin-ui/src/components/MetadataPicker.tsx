import { useEffect, useMemo, useState } from 'react';
import * as edgeApi from '../api/edgeApi';

/**
 * §2.3.93 R-C/pick-lists — searchable UID picker populated from the
 * local DHIS2 metadata mirror.
 *
 * <p>The admin UI's Pull-from-Central dialogs previously accepted
 * free-text UIDs. Operators normally don't memorise 11-char UIDs, so
 * we offer a type-ahead picker backed by the local mirror (which the
 * metadata sync job keeps fresh).</p>
 *
 * <p>The component lazy-loads the resource list on first focus and
 * caches it for the session (parent-scoped). It falls back silently
 * to a plain text input if the mirror call fails so the dialog
 * remains usable when metadata hasn't been synced yet.</p>
 */
export function MetadataPicker(
  { resource, value, onChange, placeholder, dataTest, disabled }:
    { resource: 'dataSets' | 'dataElements' | 'programs'
                 | 'programStages' | 'organisationUnits'
                 | 'trackedEntityTypes' | 'trackedEntityAttributes';
      value: string;
      onChange(uid: string): void;
      placeholder?: string;
      dataTest?: string;
      disabled?: boolean }
): JSX.Element {
  const [items, setItems] = useState<edgeApi.MetadataListItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Lazy-load on first open; cache for the session.
  useEffect(() => {
    if (!open || items !== null) return;
    edgeApi.metadataList(resource)
      .then((r) => {
        const arr = r[resource];
        if (Array.isArray(arr)) {
          setItems(arr as edgeApi.MetadataListItem[]);
        } else {
          setItems([]);
        }
      })
      .catch((e) => {
        setErr(e instanceof Error ? e.message : String(e));
        setItems([]);
      });
  }, [open, items, resource]);

  // Selected display name resolution (for showing "DataSet · <name>"
  // instead of raw UID after a pick).
  const selectedName = useMemo(() => {
    if (!value || !items) return null;
    return items.find((i) => i.id === value)?.displayName ?? null;
  }, [items, value]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 50);
    return items
      .filter((i) =>
        i.id.toLowerCase().includes(q)
        || i.displayName.toLowerCase().includes(q))
      .slice(0, 50);
  }, [items, query]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="ea-input ea-mono"
          value={open ? query : value}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          placeholder={placeholder ?? `Search ${resource}…`}
          disabled={disabled}
          data-test={dataTest} />
      </div>
      {selectedName && !open && (
        <div style={{ fontSize: 11, color: 'var(--der-ink-500)',
                       marginTop: 2 }}>
          {selectedName}
        </div>
      )}
      {open && (
        <div style={{
               position: 'absolute', top: '100%', left: 0, right: 0,
               marginTop: 2, zIndex: 1100,
               background: 'var(--der-raised)',
               border: '1px solid var(--der-border)',
               borderRadius: 6, maxHeight: 240, overflow: 'auto',
               boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
             }}>
          {items === null && (
            <div style={{ padding: '8px 10px', fontSize: 12,
                           color: 'var(--der-ink-500)' }}>
              Loading…
            </div>
          )}
          {items !== null && filtered.length === 0 && !err && (
            <div style={{ padding: '8px 10px', fontSize: 12,
                           color: 'var(--der-ink-500)' }}>
              {query ? 'No matches.' : 'Nothing in the local mirror yet.'}
              <br />
              You can still paste a UID directly.
            </div>
          )}
          {err && (
            <div style={{ padding: '8px 10px', fontSize: 12,
                           color: 'var(--der-danger-ink)' }}>
              {err} — paste a UID directly.
            </div>
          )}
          {filtered.map((it) => (
            <button key={it.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(it.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '6px 10px', border: 'none',
                      background: value === it.id
                        ? 'var(--der-primary-wash, #eff6ff)' : 'transparent',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--der-border)',
                    }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>
                {it.displayName}
              </div>
              <div className="ea-mono" style={{ fontSize: 10,
                                                   color: 'var(--der-ink-500)' }}>
                {it.id}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
