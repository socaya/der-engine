/**
 * Capture-app hash routing (NAV-001..008).
 *
 * <p>The v3 requirements doc mandates that a working list, a
 * record detail page and a create/edit form are three different
 * route types with no overlap. This module parses the window's
 * current {@code location.hash} into a discriminated union so
 * every feature component can derive its mode from one source of
 * truth and no page ever renders a list and a form as siblings
 * on the same route.</p>
 *
 * <p>Routes:
 * <pre>
 *   #/                                                        → home
 *   #/tracker/:program/records                                → tracker list
 *   #/tracker/:program/records/:tei                           → tracker detail
 *   #/tracker/:program/records/:tei/relationships/new?step=1..4
 *                                                             → relationship wizard
 *   #/tracker/:program/register                               → tracker register
 *   #/tracker/:program/enrollments/:enr/events/:event/edit    → tracker stage form
 *   #/tracker/:program/enrollments/:enr/stages/:stage/new     → tracker stage form (new)
 *   #/events/:program                                         → event list
 *   #/events/:program/:event                                  → event detail
 *   #/events/:program/new                                     → event form (new)
 *   #/events/:program/:event/edit                             → event form (edit)
 * </pre>
 * </p>
 */

export type CaptureRoute =
  | { readonly kind: 'home' }
  | { readonly kind: 'tracker-list';
      readonly programId: string }
  | { readonly kind: 'tracker-detail';
      readonly programId: string; readonly teiId: string;
      /** Optional enrolment to pre-select when the TEI dashboard
       *  mounts — passed via `?enrolment=UID` from navigation sites
       *  that know which enrolment the operator wanted (relationship
       *  row "Open enrolment", scheduled-events link, etc.). */
      readonly focusEnrollmentId?: string | null;
      /** Which rail section the dashboard should open on. Derived
       *  from the URL sub-path so operators can deep-link, bookmark
       *  or share a specific view. `stages/<uid>` pins a specific
       *  program stage; `stages` alone picks the first stage. */
      readonly section?: 'profile' | 'enrolment' | 'notes'
                        | 'relationships' | 'stage' | null;
      readonly stageId?: string | null }
  | { readonly kind: 'tracker-register';
      readonly programId: string }
  | { readonly kind: 'tracker-enrol';
      readonly programId: string; readonly teiId: string }
  | { readonly kind: 'tracker-relationship-form';
      readonly programId: string; readonly teiId: string;
      /** Optional from-anchor override — present when the form
       *  is launched from somewhere other than the TEI dashboard
       *  (e.g. an event detail wanting to create a related-stage
       *  link anchored on that event). When null the form
       *  defaults to anchoring on the current TEI. */
      readonly fromKind: 'TRACKED_ENTITY' | 'ENROLLMENT'
                         | 'EVENT' | null;
      readonly fromUid: string | null;
      /** Optional type UID to preselect — the event detail page
       *  passes this when the action row is a specific type
       *  ("Request lab tests"). */
      readonly preType: string | null }
  | { readonly kind: 'tracker-stage-form';
      readonly programId: string; readonly enrollmentId: string;
      readonly stageId: string | null;
      readonly eventId: string | null }
  | { readonly kind: 'event-list';
      readonly programId: string }
  | { readonly kind: 'event-sheet';
      readonly programId: string }
  | { readonly kind: 'event-detail';
      readonly programId: string; readonly eventId: string }
  | { readonly kind: 'event-form';
      readonly programId: string; readonly eventId: string | null };

/** Split a hash like "#/tracker/abc/records" into path segments.
 *  Leading "#" and "/" are tolerated; empty segments are dropped. */
export function parseCaptureRoute(hash: string): CaptureRoute {
  // Strip optional query string — we use ?step=N for the
  // relationship wizard; the path above is still what determines
  // the route kind, the query just parameterises it.
  const rawNoHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const qIdx = rawNoHash.indexOf('?');
  const pathPart = qIdx >= 0 ? rawNoHash.slice(0, qIdx) : rawNoHash;
  const queryPart = qIdx >= 0 ? rawNoHash.slice(qIdx + 1) : '';
  const clean = pathPart.replace(/^\/+/, '').replace(/\/+$/, '');
  if (clean === '' || clean === '/') return { kind: 'home' };
  const segs = clean.split('/');

  if (segs[0] === 'tracker' && segs[1]) {
    const programId = segs[1];
    if (segs[2] === 'records' && segs[3] && segs[4] === 'enrol') {
      return { kind: 'tracker-enrol',
        programId, teiId: segs[3]! };
    }
    if (segs[2] === 'records' && segs[3]
        && segs[4] === 'relationships' && segs[5] === 'new') {
      const q = new URLSearchParams(queryPart);
      const fromKindRaw = q.get('fromKind');
      const fromKind = fromKindRaw === 'TRACKED_ENTITY'
          || fromKindRaw === 'ENROLLMENT'
          || fromKindRaw === 'EVENT' ? fromKindRaw : null;
      const fromUid = q.get('fromUid');
      const preType = q.get('preType');
      return { kind: 'tracker-relationship-form',
        programId, teiId: segs[3]!,
        fromKind, fromUid, preType };
    }
    if (segs[2] === 'records' && segs[3]) {
      const focus = new URLSearchParams(queryPart).get('enrolment');
      // Section deep-links:
      //   .../records/{tei}                       → profile (default)
      //   .../records/{tei}/profile               → profile
      //   .../records/{tei}/notes                 → notes
      //   .../records/{tei}/relationships         → relationships
      //   .../records/{tei}/stages                → first stage
      //   .../records/{tei}/stages/{stageUid}     → that stage
      let section: 'profile' | 'enrolment' | 'notes'
        | 'relationships' | 'stage' | null = null;
      let stageId: string | null = null;
      if (segs[4] === 'profile') section = 'profile';
      else if (segs[4] === 'enrolment') section = 'enrolment';
      else if (segs[4] === 'notes') section = 'notes';
      else if (segs[4] === 'relationships') section = 'relationships';
      else if (segs[4] === 'stages') {
        section = 'stage';
        if (segs[5]) stageId = segs[5];
      }
      return { kind: 'tracker-detail',
        programId, teiId: segs[3]!,
        focusEnrollmentId: focus && focus.length > 0 ? focus : null,
        section, stageId };
    }
    if (segs[2] === 'records') {
      return { kind: 'tracker-list', programId };
    }
    if (segs[2] === 'register') {
      return { kind: 'tracker-register', programId };
    }
    if (segs[2] === 'enrollments' && segs[3]) {
      const enrollmentId = segs[3]!;
      if (segs[4] === 'events' && segs[5] && segs[6] === 'edit') {
        return { kind: 'tracker-stage-form',
          programId, enrollmentId,
          stageId: null, eventId: segs[5]! };
      }
      if (segs[4] === 'stages' && segs[5] && segs[6] === 'new') {
        return { kind: 'tracker-stage-form',
          programId, enrollmentId,
          stageId: segs[5]!, eventId: null };
      }
    }
    return { kind: 'tracker-list', programId };
  }

  if (segs[0] === 'events' && segs[1]) {
    const programId = segs[1];
    if (segs[2] === 'sheet') {
      return { kind: 'event-sheet', programId };
    }
    if (segs[2] === 'new') {
      return { kind: 'event-form', programId, eventId: null };
    }
    if (segs[2] && segs[3] === 'edit') {
      return { kind: 'event-form',
        programId, eventId: segs[2]! };
    }
    if (segs[2]) {
      return { kind: 'event-detail',
        programId, eventId: segs[2]! };
    }
    return { kind: 'event-list', programId };
  }

  return { kind: 'home' };
}

export function navigateTo(path: string): void {
  if (typeof window === 'undefined') return;
  const clean = path.startsWith('/') ? path : '/' + path;
  if (window.location.hash === '#' + clean) return;
  window.location.hash = '#' + clean;
}

export const navTracker = {
  list: (programId: string) =>
    navigateTo(`/tracker/${programId}/records`),
  detail: (programId: string, teiId: string,
      extra?: { focusEnrollmentId?: string | null }) => {
    const qs = extra?.focusEnrollmentId
      ? `?enrolment=${encodeURIComponent(extra.focusEnrollmentId)}` : '';
    navigateTo(`/tracker/${programId}/records/${teiId}${qs}`);
  },
  /** Section deep-links. Preserves any `?enrolment=` already on
   *  the URL so switching between sections doesn't lose the pinned
   *  enrolment context. */
  section: (programId: string, teiId: string,
      section: 'profile' | 'enrolment' | 'notes' | 'relationships',
      extra?: { focusEnrollmentId?: string | null }) => {
    const qs = extra?.focusEnrollmentId
      ? `?enrolment=${encodeURIComponent(extra.focusEnrollmentId)}` : '';
    navigateTo(`/tracker/${programId}/records/${teiId}/`
      + `${section}${qs}`);
  },
  stage: (programId: string, teiId: string, stageUid: string | null,
      extra?: { focusEnrollmentId?: string | null }) => {
    const qs = extra?.focusEnrollmentId
      ? `?enrolment=${encodeURIComponent(extra.focusEnrollmentId)}` : '';
    const suffix = stageUid ? '/' + encodeURIComponent(stageUid) : '';
    navigateTo(`/tracker/${programId}/records/${teiId}/`
      + `stages${suffix}${qs}`);
  },
  register: (programId: string) =>
    navigateTo(`/tracker/${programId}/register`),
  enrol: (programId: string, teiId: string) =>
    navigateTo(`/tracker/${programId}/records/${teiId}/enrol`),
  relationshipNew: (programId: string, teiId: string,
      extra?: { fromKind?: 'TRACKED_ENTITY' | 'ENROLLMENT'
                            | 'EVENT' | null;
                fromUid?: string | null;
                preType?: string | null }) => {
    const params = new URLSearchParams();
    if (extra?.fromKind) params.set('fromKind', extra.fromKind);
    if (extra?.fromUid) params.set('fromUid', extra.fromUid);
    if (extra?.preType) params.set('preType', extra.preType);
    const qs = params.toString();
    navigateTo(`/tracker/${programId}/records/${teiId}/`
      + `relationships/new${qs ? '?' + qs : ''}`);
  },
  newEvent: (programId: string, enrollmentId: string,
      stageId: string) =>
    navigateTo(`/tracker/${programId}/enrollments/${enrollmentId}`
      + `/stages/${stageId}/new`),
  editEvent: (programId: string, enrollmentId: string,
      eventId: string) =>
    navigateTo(`/tracker/${programId}/enrollments/${enrollmentId}`
      + `/events/${eventId}/edit`),
};

export const navEvent = {
  list: (programId: string) =>
    navigateTo(`/events/${programId}`),
  sheet: (programId: string) =>
    navigateTo(`/events/${programId}/sheet`),
  detail: (programId: string, eventId: string) =>
    navigateTo(`/events/${programId}/${eventId}`),
  create: (programId: string) =>
    navigateTo(`/events/${programId}/new`),
  edit: (programId: string, eventId: string) =>
    navigateTo(`/events/${programId}/${eventId}/edit`),
};
