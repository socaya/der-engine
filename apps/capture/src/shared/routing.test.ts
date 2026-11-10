import { describe, expect, it } from 'vitest';
import { parseCaptureRoute } from './routing';

describe('parseCaptureRoute', () => {
  it('returns home for empty / root hash', () => {
    expect(parseCaptureRoute('').kind).toBe('home');
    expect(parseCaptureRoute('#/').kind).toBe('home');
  });

  it('parses tracker list', () => {
    const r = parseCaptureRoute('#/tracker/abc/records');
    expect(r).toEqual({ kind: 'tracker-list', programId: 'abc' });
  });

  it('parses tracker detail', () => {
    const r = parseCaptureRoute('#/tracker/abc/records/tei1');
    expect(r).toEqual({ kind: 'tracker-detail',
      programId: 'abc', teiId: 'tei1',
      focusEnrollmentId: null, section: null, stageId: null });
  });

  it('parses tracker register', () => {
    const r = parseCaptureRoute('#/tracker/abc/register');
    expect(r).toEqual({ kind: 'tracker-register', programId: 'abc' });
  });

  it('parses tracker enrol (TEI-scoped)', () => {
    const r = parseCaptureRoute('#/tracker/abc/records/tei1/enrol');
    expect(r).toEqual({ kind: 'tracker-enrol',
      programId: 'abc', teiId: 'tei1' });
  });

  it('parses tracker stage form (new)', () => {
    const r = parseCaptureRoute(
      '#/tracker/abc/enrollments/E1/stages/S1/new');
    expect(r).toEqual({ kind: 'tracker-stage-form',
      programId: 'abc', enrollmentId: 'E1',
      stageId: 'S1', eventId: null });
  });

  it('parses tracker stage form (edit)', () => {
    const r = parseCaptureRoute(
      '#/tracker/abc/enrollments/E1/events/EV2/edit');
    expect(r).toEqual({ kind: 'tracker-stage-form',
      programId: 'abc', enrollmentId: 'E1',
      stageId: null, eventId: 'EV2' });
  });

  it('parses event list / detail / form', () => {
    expect(parseCaptureRoute('#/events/evp')).toEqual(
      { kind: 'event-list', programId: 'evp' });
    expect(parseCaptureRoute('#/events/evp/EV1')).toEqual(
      { kind: 'event-detail', programId: 'evp', eventId: 'EV1' });
    expect(parseCaptureRoute('#/events/evp/new')).toEqual(
      { kind: 'event-form', programId: 'evp', eventId: null });
    expect(parseCaptureRoute('#/events/evp/EV1/edit')).toEqual(
      { kind: 'event-form', programId: 'evp', eventId: 'EV1' });
  });

  it('parses event-sheet', () => {
    expect(parseCaptureRoute('#/events/evp/sheet')).toEqual(
      { kind: 'event-sheet', programId: 'evp' });
  });

  it('falls back to tracker list for unknown tracker suffix', () => {
    const r = parseCaptureRoute('#/tracker/abc/weirdthing');
    expect(r).toEqual({ kind: 'tracker-list', programId: 'abc' });
  });

  it('falls back to home for unknown root', () => {
    expect(parseCaptureRoute('#/unknown').kind).toBe('home');
  });
});
