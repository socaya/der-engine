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
      readonly programId: string; readonly teiId: string }
  | { readonly kind: 'tracker-register';
      readonly programId: string }
  | { readonly kind: 'tracker-enrol';
      readonly programId: string; readonly teiId: string }
  | { readonly kind: 'tracker-stage-form';
      readonly programId: string; readonly enrollmentId: string;
      readonly stageId: string | null;
      readonly eventId: string | null }
  | { readonly kind: 'event-list';
      readonly programId: string }
  | { readonly kind: 'event-detail';
      readonly programId: string; readonly eventId: string }
  | { readonly kind: 'event-form';
      readonly programId: string; readonly eventId: string | null };

/** Split a hash like "#/tracker/abc/records" into path segments.
 *  Leading "#" and "/" are tolerated; empty segments are dropped. */
export function parseCaptureRoute(hash: string): CaptureRoute {
  const clean = (hash.startsWith('#') ? hash.slice(1) : hash)
    .replace(/^\/+/, '').replace(/\/+$/, '');
  if (clean === '' || clean === '/') return { kind: 'home' };
  const segs = clean.split('/');

  if (segs[0] === 'tracker' && segs[1]) {
    const programId = segs[1];
    if (segs[2] === 'records' && segs[3] && segs[4] === 'enrol') {
      return { kind: 'tracker-enrol',
        programId, teiId: segs[3]! };
    }
    if (segs[2] === 'records' && segs[3]) {
      return { kind: 'tracker-detail',
        programId, teiId: segs[3]! };
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
  detail: (programId: string, teiId: string) =>
    navigateTo(`/tracker/${programId}/records/${teiId}`),
  register: (programId: string) =>
    navigateTo(`/tracker/${programId}/register`),
  enrol: (programId: string, teiId: string) =>
    navigateTo(`/tracker/${programId}/records/${teiId}/enrol`),
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
  detail: (programId: string, eventId: string) =>
    navigateTo(`/events/${programId}/${eventId}`),
  create: (programId: string) =>
    navigateTo(`/events/${programId}/new`),
  edit: (programId: string, eventId: string) =>
    navigateTo(`/events/${programId}/${eventId}/edit`),
};
