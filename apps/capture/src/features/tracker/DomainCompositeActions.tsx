import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormEngine } from '../../shared/FormEngine';
import type { CaptureApi } from '../../shared/types';
import type { CaptureFormSection } from '../../shared/model';

/** Composite DER_DOMAIN entities (spec §4) — Capture panel
 *  rendered below RelatedStageActions on the event-edit page.
 *
 *  Metadata-driven: each composite kind in the catalogue
 *  (/edge-api/v1/domain/composite-kinds) is bound by an admin
 *  to a DHIS2 program stage (head_program_stage_uid) whose data
 *  elements become the head form fields. Kinds without a bound
 *  stage are "configuration incomplete" and their "+ New …"
 *  action button is disabled with a hint explaining why.
 *
 *  Scope of this slice: head-form capture using FormEngine
 *  against the kind's bound stage. Line items (item stage repeatable)
 *  have the data model and server CRUD in place but the capture
 *  UI for them lands in a follow-up — rendering nested repeatable
 *  FormEngine instances is a separate UX pass.
 *
 *  Why not reuse the existing TrackerStageEditor for the head?
 *  TrackerStageEditor creates an actual DHIS2 Tracker event.
 *  Composites are DER_DOMAIN entities — they live in
 *  der_domain_composite, not edge_tracker_event. Shape of the
 *  form is identical (DHIS2 data elements) but the destination
 *  table and sync semantics differ. */
export function DomainCompositeActions(
  { api, programUid, enrollmentId, eventId, orgUnitUid,
    onResolveTei }: {
    api: CaptureApi;
    programUid: string;
    enrollmentId: string;
    eventId: string;
    orgUnitUid: string;
    /** Resolves the enrolment's TEI UID (same callback the
     *  parent StageFormPage uses for its back-nav). Needed for
     *  the composite's anchor_tei_uid field. */
    onResolveTei: (enrollmentUid: string) => Promise<string | null>;
  },
): JSX.Element {
  const [resolvedTeiId, setResolvedTeiId] =
    useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    onResolveTei(enrollmentId).then((t) => {
      if (!cancelled) setResolvedTeiId(t);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [enrollmentId, onResolveTei]);
  const [kinds, setKinds] = useState<Array<Kind>>([]);
  const [composites, setComposites] =
    useState<Array<CompositeRow>>([]);
  const [loadState, setLoadState] =
    useState<'loading' | 'idle' | 'err'>('loading');

  const [composing, setComposing] = useState<Kind | null>(null);
  const [headSections, setHeadSections] =
    useState<readonly CaptureFormSection[]>([]);
  const [headValues, setHeadValues] =
    useState<Record<string, string>>({});
  const [headLoad, setHeadLoad] =
    useState<'idle' | 'loading' | 'err'>('idle');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoadState('loading');
    try {
      const [kr, cr] = await Promise.all([
        fetch('/edge-api/v1/domain/composite-kinds',
          { credentials: 'include' })
          .then((r) => r.ok ? r.json() : { kinds: [] }),
        fetch('/edge-api/v1/domain/composites?anchorEventUid='
          + encodeURIComponent(eventId),
          { credentials: 'include' })
          .then((r) => r.ok ? r.json() : { composites: [] }),
      ]);
      setKinds(kr.kinds ?? []);
      setComposites(cr.composites ?? []);
      setLoadState('idle');
    } catch {
      setLoadState('err');
    }
  }, [eventId]);
  useEffect(() => { reload().catch(() => undefined); }, [reload]);

  // Load head-form sections when the operator opens a kind.
  useEffect(() => {
    if (!composing || !composing.headProgramStageUid) {
      setHeadSections([]); return;
    }
    let cancelled = false;
    setHeadLoad('loading');
    (async () => {
      try {
        const assembly = await api.getCaptureStageForm(programUid,
          composing.headProgramStageUid!);
        if (cancelled) return;
        setHeadSections(assembly.sections);
        setHeadValues({});
        setHeadLoad('idle');
      } catch {
        if (!cancelled) setHeadLoad('err');
      }
    })();
    return () => { cancelled = true; };
  }, [composing, programUid, api]);

  const kindByCode = useMemo(() => {
    const m = new Map<string, Kind>();
    for (const k of kinds) m.set(k.kindCode, k);
    return m;
  }, [kinds]);

  function openCompose(kind: Kind): void {
    if (!kind.configurationComplete) return;
    setComposing(kind);
    setMsg(null); setErr(null); setHeadValues({});
  }
  function cancelCompose(): void {
    setComposing(null);
    setHeadSections([]); setHeadValues({});
  }

  async function save(): Promise<void> {
    if (!composing) return;
    if (!resolvedTeiId) {
      setErr('Could not resolve the TEI for this enrolment — '
        + 'reload the page and try again.');
      return;
    }
    setSaving(true); setMsg(null); setErr(null);
    try {
      // Head payload is a data_element_uid → value map (same
      // shape as a tracker event's dataValues). Empty values
      // dropped so an unfilled slot doesn't clobber a server-
      // side default once we start tracking those.
      const headPayload: Record<string, string> = {};
      for (const [k, v] of Object.entries(headValues)) {
        if (v && v.trim() !== '') headPayload[k] = v;
      }
      const body = {
        compositeUid: genUid(),
        kindCode: composing.kindCode,
        anchorEventUid: eventId,
        anchorEnrollmentUid: enrollmentId,
        anchorTeiUid: resolvedTeiId,
        orgUnitUid,
        headPayload,
        items: [],  // Item UI lands in a follow-up slice.
      };
      const r = await fetch('/edge-api/v1/domain/composites', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json',
          Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || `HTTP ${r.status}`);
      }
      setMsg(`${composing.displayName} saved`);
      setComposing(null);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  }

  if (loadState === 'loading') return <></>;
  if (kinds.length === 0 && composites.length === 0) return <></>;

  return (
    <section className="cap-composites" data-test="tr-composites">
      <div className="cap-section-head">
        <h3 className="cap-section-head__title"
            style={{ fontSize: 14 }}>Clinical orders</h3>
        <span className="cap-section-head__count">
          {composites.length === 0 ? 'none yet'
            : `${composites.length} record`
              + (composites.length === 1 ? '' : 's')}
        </span>
      </div>

      {msg && <div className="cap-strip cap-strip--ok"
                   style={{ margin: '0 0 10px 0' }}
                   data-test="tr-composites-msg">{msg}</div>}
      {err && <div className="cap-strip cap-strip--err"
                   style={{ margin: '0 0 10px 0' }}
                   data-test="tr-composites-err">{err}</div>}

      {composites.length > 0 && (
        <ul className="cap-list" data-test="tr-composites-list">
          {composites.map((c) => {
            const kind = kindByCode.get(c.kindCode);
            return (
              <li key={c.compositeUid}
                  className="cap-list__row"
                  style={{ gridTemplateColumns: '1fr auto' }}>
                <div>
                  <strong>
                    {kind?.displayName ?? c.kindCode}
                  </strong>
                  <span className="cap-chip"
                        style={{ marginLeft: 10 }}>
                    {c.status}
                  </span>
                  <span className="cap-chip"
                        style={{ marginLeft: 6,
                          color: 'var(--der-text-muted)' }}>
                    {kind?.syncPolicy === 'EXPORTABLE'
                      ? 'exportable to DHIS2'
                      : 'edge-only'}
                  </span>
                  <div style={{ marginTop: 4, fontSize: 13,
                    color: 'var(--der-text-muted)' }}>
                    {Object.keys(c.headPayload ?? {}).length} field
                    {Object.keys(c.headPayload ?? {}).length === 1
                      ? '' : 's'}
                    {' · '}
                    {c.items.length} line
                    {c.items.length === 1 ? '' : 's'}
                  </div>
                </div>
                <span className="cap-list__when">{c.updatedAt}</span>
              </li>
            );
          })}
        </ul>
      )}

      {composing && (
        <div className="cap-rel-new-target"
             data-test="tr-composite-form"
             style={{ background: 'var(--der-surface-subtle)',
               border: '1px solid var(--der-border-soft)',
               borderRadius: 4, padding: '14px 16px',
               marginTop: 10 }}>
          <strong style={{ fontSize: 14 }}>
            New {composing.displayName}
          </strong>
          <div style={{ marginTop: 4, fontSize: 12,
            color: 'var(--der-text-muted)' }}>
            {composing.description ?? 'DER-only composite — not '
              + 'exported to DHIS2 unless an admin maps the fields.'}
          </div>
          {headLoad === 'loading' && (
            <p className="cap-sub"
               style={{ marginTop: 14 }}>Loading form…</p>
          )}
          {headLoad === 'err' && (
            <div className="cap-strip cap-strip--err"
                 style={{ marginTop: 14 }}>
              Could not load the head stage form. Ask an admin
              to check the stage binding on this composite kind.
            </div>
          )}
          {headLoad === 'idle' && headSections.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <FormEngine api={api} sections={headSections}
                           values={headValues}
                           onChange={(k, v) => setHeadValues(
                             (prev) => ({ ...prev, [k]: v }))} />
            </div>
          )}
          {headLoad === 'idle' && headSections.length === 0 && (
            <p className="cap-sub" style={{ marginTop: 14 }}>
              The bound stage has no capturable data elements.
              Nothing to collect at the head level.
            </p>
          )}
          <p className="cap-sub"
             style={{ fontSize: 12, marginTop: 14,
               fontStyle: 'italic' }}>
            Line-item capture for this composite is coming in a
            follow-up slice — the data model supports it, but the
            repeatable item form isn't wired yet.
          </p>
          <div style={{ display: 'flex',
            justifyContent: 'flex-end', gap: 10,
            marginTop: 14, paddingTop: 14,
            borderTop: '1px solid var(--der-border-soft)' }}>
            <button type="button"
                    className="cap-btn cap-btn--secondary"
                    data-test="tr-composite-cancel"
                    style={{ padding: '5px 13px', fontSize: 13 }}
                    disabled={saving}
                    onClick={cancelCompose}>Cancel</button>
            <button type="button"
                    className="cap-btn cap-btn--primary"
                    data-test="tr-composite-save"
                    style={{ padding: '5px 13px', fontSize: 13 }}
                    disabled={saving || headLoad !== 'idle'}
                    onClick={() => { void save(); }}>
              {saving ? 'Saving…'
                : 'Save ' + composing.displayName}
            </button>
          </div>
        </div>
      )}

      {!composing && kinds.length > 0 && (
        <div className="cap-related-stage__actions"
             data-test="tr-composite-actions">
          <p className="cap-sub" style={{ marginTop: 10,
            marginBottom: 6 }}>
            Create a new DER-domain record anchored on this event.
            Kinds without a bound DHIS2 stage are greyed out — an
            admin needs to configure them first.
          </p>
          <ul className="cap-related-stage__actionlist">
            {kinds.map((k) => (
              <li key={k.kindCode}>
                <button type="button"
                        className="cap-btn cap-btn--secondary"
                        data-test={'tr-composite-new-' + k.kindCode}
                        disabled={!k.configurationComplete}
                        title={!k.configurationComplete
                          ? 'This kind has no DHIS2 stage bound '
                            + '— admin configuration needed.'
                          : (k.description ?? k.displayName)}
                        style={{ padding: '6px 14px', fontSize: 13 }}
                        onClick={() => openCompose(k)}>
                  + {k.displayName}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

interface Kind {
  readonly kindCode: string;
  readonly displayName: string;
  readonly description?: string;
  readonly headProgramStageUid: string | null;
  readonly itemProgramStageUid: string | null;
  readonly syncPolicy: 'EDGE_ONLY' | 'EXPORTABLE';
  readonly configurationComplete: boolean;
}

interface CompositeRow {
  readonly compositeUid: string;
  readonly kindCode: string;
  readonly status: string;
  readonly headPayload: Record<string, unknown>;
  readonly items: ReadonlyArray<{ itemUid: string }>;
  readonly updatedAt: string;
}

/** 11-char DHIS2 UID generator. */
function genUid(): string {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const alphanum = alpha + '0123456789';
  let out = alpha[Math.floor(Math.random() * alpha.length)];
  for (let i = 0; i < 10; i++) {
    out += alphanum[Math.floor(Math.random() * alphanum.length)];
  }
  return out;
}
