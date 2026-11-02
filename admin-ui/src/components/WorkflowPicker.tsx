import { useEffect, useMemo, useState } from 'react';
import * as edgeApi from '../api/edgeApi';

/**
 * §2.3.97 R-E — Workflow-definition picker.
 * §2.3.110 R-AF — type-ahead searchable (mirrors `MetadataPicker`).
 *
 * Type-ahead dropdown that lets a Data-module admin scope the browse
 * (and the "Ready for Central" payload preview) to the capture
 * workflow that produced the rows. Fetches the catalogue once on
 * first focus and caches for the session; filters by the optional
 * {@code boundKind} so each Data screen only sees workflows that
 * could have produced its rows.
 */
export function WorkflowPicker(
  { value, onChange, boundKind, placeholder, dataTest, disabled }:
    {
      value: string;
      onChange(workflowId: string): void;
      boundKind?: ReadonlyArray<
        | 'DATA_SET'
        | 'DATA_SET_SECTION'
        | 'DATA_ELEMENT'
        | 'PROGRAM'
        | 'PROGRAM_SECTION'
        | 'PROGRAM_STAGE'
        | 'PROGRAM_STAGE_SECTION'
        | 'TRACKED_ENTITY_TYPE'
        | 'TRACKED_ENTITY_ATTRIBUTE'
        | 'SYSTEM'
      >;
      placeholder?: string;
      dataTest?: string;
      disabled?: boolean;
    },
): JSX.Element {
  const [items, setItems]
    = useState<ReadonlyArray<edgeApi.CaptureWorkflowSummary> | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Lazy-load on first open; cache for the session.
  useEffect(() => {
    if (!open || items !== null) return;
    edgeApi.listWorkflows()
      .then((r) => { setItems(r.workflows); })
      .catch((e) => {
        setErr(e instanceof Error ? e.message : String(e));
        setItems([]);
      });
  }, [open, items]);

  const scoped = useMemo(() => {
    if (!items) return [];
    if (!boundKind || boundKind.length === 0) return items;
    const allow = new Set(boundKind);
    return items.filter((w) => allow.has(w.boundMetadataKind));
  }, [items, boundKind]);

  // Selected display name resolution — shown as a muted sub-label
  // under the input when the dropdown is closed.
  const selectedName = useMemo(() => {
    if (!value || !items) return null;
    return items.find((w) => w.workflowId === value)?.displayName ?? null;
  }, [items, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped.slice(0, 50);
    return scoped
      .filter((w) =>
        w.workflowId.toLowerCase().includes(q)
        || w.displayName.toLowerCase().includes(q)
        || w.boundMetadataKind.toLowerCase().includes(q)
        || w.boundMetadataId.toLowerCase().includes(q))
      .slice(0, 50);
  }, [scoped, query]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="ea-input"
        style={{ maxWidth: 220 }}
        value={open ? query
             : selectedName ?? (value ? value : '')}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        placeholder={placeholder ?? 'Search workflows…'}
        disabled={disabled}
        data-test={dataTest ?? 'workflow-picker'} />
      {open && (
        <div style={{
               position: 'absolute', top: '100%', left: 0,
               minWidth: 300,
               marginTop: 2, zIndex: 1100,
               background: 'var(--der-raised)',
               border: '1px solid var(--der-border)',
               borderRadius: 6, maxHeight: 280, overflow: 'auto',
               boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
             }}>
          {/* "Any workflow" row at the top — clears the filter. */}
          <button type="button"
                   onMouseDown={(e) => e.preventDefault()}
                   onClick={() => {
                     onChange('');
                     setOpen(false);
                     setQuery('');
                   }}
                   style={{
                     display: 'block', width: '100%', textAlign: 'left',
                     padding: '7px 10px', border: 'none',
                     background: !value ? 'var(--der-primary-wash, #eff6ff)' : 'transparent',
                     cursor: 'pointer',
                     borderBottom: '1px solid var(--der-border)',
                     fontSize: 12, fontStyle: 'italic',
                     color: 'var(--der-ink-500)',
                   }}>
            Any workflow
          </button>
          {items === null && (
            <div style={{ padding: '8px 10px', fontSize: 12,
                           color: 'var(--der-ink-500)' }}>
              Loading…
            </div>
          )}
          {items !== null && !err && filtered.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 12,
                           color: 'var(--der-ink-500)' }}>
              {query ? 'No matching workflow.'
                     : 'No workflows match the allowed binding kinds yet.'}
            </div>
          )}
          {err && (
            <div style={{ padding: '8px 10px', fontSize: 12,
                           color: 'var(--der-danger-ink)' }}>
              {err}
            </div>
          )}
          {filtered.map((w) => (
            <button key={w.workflowId}
                     type="button"
                     onMouseDown={(e) => e.preventDefault()}
                     onClick={() => {
                       onChange(w.workflowId);
                       setOpen(false);
                       setQuery('');
                     }}
                     style={{
                       display: 'block', width: '100%', textAlign: 'left',
                       padding: '7px 10px', border: 'none',
                       background: value === w.workflowId
                         ? 'var(--der-primary-wash, #eff6ff)' : 'transparent',
                       cursor: 'pointer',
                       borderBottom: '1px solid var(--der-border)',
                     }}>
              <div style={{ fontSize: 12, fontWeight: 500,
                             display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{w.displayName}</span>
                {!w.enabled && (
                  <span className="ea-chip ea-chip--neutral"
                        style={{ fontSize: 10 }}>disabled</span>
                )}
              </div>
              <div className="ea-mono" style={{ fontSize: 10,
                                                 color: 'var(--der-ink-500)' }}>
                {w.boundMetadataKind} · {w.boundMetadataId}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
