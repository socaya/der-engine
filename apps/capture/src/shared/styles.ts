/**
 * Shared design-token CSS for the unified Capture app. Palette +
 * sizing + focus halo match the Data Entry app so operators get
 * one consistent muscle memory across both modules (requirements
 * doc §5 "Modern DER Capture Design System").
 *
 * Softening pass (G9-30): borders and label text drop one step in
 * contrast so the page reads calmer at a glance; section titles
 * use medium weight instead of semibold so the hierarchy guides
 * the eye without shouting.
 */
export const CAPTURE_STYLES = `
:root {
  /*
   * v3 §5.2 — DER design tokens (source of truth). Every Capture
   * screen reads from these. Tweak a swatch here and the whole
   * app shifts, so a visual rework doesn't mean a grep-and-replace
   * through dozens of selectors.
   */
  --der-bg: #F8FAFC;
  --der-surface: #FFFFFF;
  --der-surface-subtle: #F3F6FA;
  --der-text: #17263C;
  --der-text-muted: #607089;
  --der-text-faint: #8A95A6;
  --der-border: #E6EBF1;
  --der-border-soft: #F0F3F7;
  --der-primary: #2563A6;
  --der-primary-strong: #194E86;
  --der-primary-subtle: #EAF3FC;
  --der-success: #237A57;
  --der-success-subtle: #E6F2EC;
  --der-warning: #A56518;
  --der-warning-subtle: #FBEFD9;
  --der-danger: #B74444;
  --der-danger-subtle: #F7E0E0;
  /* Radii are tokenised for completeness but held at 0 per operator
   * preference (flat, clinical look — no rounded chips). Change the
   * single value here to re-introduce rounded surfaces app-wide. */
  --der-radius-sm: 0;
  --der-radius-md: 0;
  --der-radius-lg: 0;
  --der-space-unit: 4px;
  --der-focus-halo: 0 0 0 2px rgba(37, 99, 166, 0.35);

  /*
   * Compatibility aliases — existing .cap-* selectors still reach
   * for --cap-* vars; delegating to the DER tokens keeps the two
   * naming schemes in lockstep without a sweeping find-replace.
   */
  --cap-ink-900: var(--der-text);
  --cap-ink-700: var(--der-text);
  --cap-ink-500: var(--der-text-muted);
  --cap-ink-300: var(--der-text-faint);
  --cap-border: var(--der-border);
  --cap-border-soft: var(--der-border-soft);
  --cap-surface: var(--der-surface);
  --cap-surface-soft: var(--der-surface-subtle);
  --cap-brand-500: var(--der-primary);
  --cap-brand-700: var(--der-primary-strong);
}
.cap-toolbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; flex-direction: column; gap: 10px;
  padding: 10px 14px 10px 14px;
  background: var(--der-surface);
  border-bottom: 1px solid var(--der-border);
}
.cap-toolbar__fields {
  display: flex; gap: 16px; flex-wrap: wrap; align-items: center;
}
@media (max-width: 760px) {
  .cap-toolbar__fields {
    gap: 10px;
  }
  .cap-toolbar__brand {
    flex-wrap: wrap;
  }
}
.cap-toolbar__brand {
  display: flex; align-items: center; gap: 12px;
}
.cap-toolbar__ou-wrap {
  margin-left: auto;
  display: inline-flex; flex-direction: column; align-items: flex-end;
  gap: 1px; max-width: 360px;
  line-height: 1.2;
}
.cap-toolbar__ou-label {
  font-size: 10px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--der-text-faint);
}
.cap-toolbar__ou-value {
  color: var(--der-text); font-size: 13px; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cap-toolbar__mode--empty {
  background: var(--der-surface-subtle); color: var(--der-text-faint); border-color: var(--der-border);
}
.cap-toolbar__icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 0;
  background: #e8f0fa;
}
.cap-toolbar__title {
  margin: 0; font-size: 18px; font-weight: 600;
  color: var(--der-primary); letter-spacing: -0.01em;
}
.cap-toolbar__info-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  background: transparent; border: 1px solid var(--der-border);
  color: var(--der-primary); cursor: pointer; padding: 0;
}
.cap-toolbar__info-btn:hover { background: var(--der-surface-subtle); }
.cap-net-wrap {
  display: inline-flex; align-items: center; gap: 8px;
}
.cap-net-flush {
  padding: 2px 8px;
  background: transparent; color: var(--der-primary);
  border: 1px solid var(--der-border);
  font-size: 11px; font-weight: 500;
  cursor: pointer; font-family: inherit;
}
.cap-net-flush:hover { background: var(--der-surface-subtle); border-color: var(--der-primary); }
.cap-net-flush:disabled { opacity: 0.6; cursor: wait; }
.cap-net-status {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0; font-size: 12px; font-weight: 500;
  color: var(--cap-ink-700, var(--der-text));
  background: transparent; border: 0;
  white-space: nowrap; cursor: help;
}
.cap-net-status__dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--der-text-faint);
  box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.18);
}
.cap-net-status--live .cap-net-status__dot {
  background: var(--der-success);
  box-shadow: 0 0 0 2px rgba(30, 142, 74, 0.2);
}
.cap-net-status--live { color: var(--der-success); }
.cap-net-status--syncing .cap-net-status__dot {
  background: var(--der-warning);
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.22);
  animation: cap-pulse 1.6s ease-in-out infinite;
}
.cap-net-status--syncing { color: var(--der-warning); }
.cap-net-status--offline-held .cap-net-status__dot {
  background: var(--der-warning);
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.22);
}
.cap-net-status--offline-held { color: var(--der-warning); }
.cap-net-status--offline { color: var(--der-text-muted); }
@keyframes cap-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.cap-dirty-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 0;
  font-size: 12px; font-weight: 600;
  background: transparent; color: var(--der-warning);
  border: 0;
  white-space: nowrap;
}
.cap-dirty-chip__dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--der-warning);
}
.cap-toolbar__field, .cap-toolbar__ou {
  display: flex; flex-direction: column; gap: 4px;
  min-width: 0;
}
.cap-toolbar__field-label {
  font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--der-text-muted);
}
.cap-toolbar__select {
  padding: 6px 8px; border: 1px solid #aaa; border-radius: 0;
  font-size: 14px; background: var(--der-surface); appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--der-text-muted) 50%),
    linear-gradient(135deg, var(--der-text-muted) 50%, transparent 50%);
  background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 24px;
}
.cap-toolbar__select:focus {
  outline: none; border-color: var(--der-primary);
  box-shadow: 0 0 0 2px rgba(20,124,215,0.2);
}
.cap-toolbar__select:disabled { background-color: var(--der-surface-subtle); color: var(--der-text-faint); }
.cap-toolbar__ou-code {
  display: inline-block;
  padding: 6px 8px; border: 1px solid var(--der-border); border-radius: 0;
  background: var(--der-surface-subtle); color: var(--der-text);
  font-size: 13px; font-family: inherit;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cap-toolbar__mode {
  display: inline-block;
  padding: 2px 0;
  font-size: 13px; font-weight: 500;
  color: var(--der-text);
  background: transparent; border: 0;
  letter-spacing: 0;
}
.cap-toolbar__mode--tracker { color: var(--der-primary-strong); }
.cap-toolbar__mode--event   { color: var(--der-success); }

.cap-sub {
  margin: 10px 14px 0 14px; color: var(--der-text-muted); font-size: 13px;
}
.cap-sub__code {
  background: var(--der-surface-subtle); padding: 1px 6px; border-radius: 0;
  font-size: 12px; margin-inline: 4px;
}

.cap-strip {
  margin: 10px 14px 0 14px; padding: 8px 12px; border-radius: 0;
  font-size: 13px;
}
.cap-strip--ok  { background: var(--der-success-subtle); color: var(--der-success);
                  border: 1px solid var(--der-success); }
.cap-strip--err { background: var(--der-danger-subtle); color: var(--der-danger);
                  border: 1px solid var(--der-danger); }
.cap-strip--info{ background: var(--der-primary-subtle); color: var(--der-primary);
                  border: 1px solid #cfe1f4; }
.cap-strip--warn{ background: #fff4de; color: var(--der-warning);
                  border: 1px solid #f4d7a2; }

.cap-toolbar__field--wf {
  min-width: 0;
}
.cap-wf-chips {
  display: inline;
  color: var(--der-text); font-size: 13px; font-weight: 500;
}
.cap-wf-chip {
  display: inline;
  color: var(--der-primary-strong);
  background: transparent; border: 0; padding: 0;
  font-weight: 500;
}
.cap-wf-chip + .cap-wf-chip::before {
  content: ' · ';
  color: var(--der-text-faint); font-weight: 400;
}
.cap-wf-chip--more {
  color: var(--der-text-muted); font-weight: 400;
}
/* Distributed-workflow banner — a thin strip that names the
 * operator's workflow + step. The actual capture form renders
 * below via the normal tracker/event workflow components.
 * Calm, soft palette per user ask. */
.cap-dwf {
  margin: 10px 14px 0 14px;
  display: flex; flex-direction: column; gap: 4px;
}
.cap-dwf__banner {
  padding: 8px 12px;
  background: #fafcff;
  border-left: 3px solid var(--der-primary);
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  font-size: 13px; line-height: 1.4;
}
.cap-dwf__banner-title { color: var(--der-primary); font-weight: 600; }
.cap-dwf__banner-meta { color: var(--der-text-muted); font-size: 12px; }
.cap-dwf__banner-meta em { color: var(--der-text); font-style: normal;
  font-weight: 500; }
.cap-dwf__queue {
  padding: 10px 14px;
  background: var(--der-surface);
  border-top: 1px solid var(--der-border);
  margin-bottom: 4px;
}
.cap-dwf__queue-title {
  display: flex; align-items: baseline; gap: 10px;
  margin: 0 0 6px 0;
  font-size: 12px; font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--der-text);
}
.cap-dwf__queue-count {
  font-size: 11px; font-weight: 400;
  text-transform: none; letter-spacing: 0;
  color: var(--der-text-faint);
}
.cap-dwf__queue-empty {
  margin: 0; font-size: 12px; color: var(--der-text-faint);
}
.cap-dwf__queue-list {
  margin: 0; padding: 0; list-style: none;
}
.cap-dwf__queue-list > li {
  padding: 6px 0; font-size: 13px; color: var(--der-text);
  display: flex; align-items: center; gap: 10px;
  border-top: 1px solid var(--der-border-soft);
}
.cap-dwf__queue-key { color: var(--der-primary); font-weight: 600; }
.cap-dwf__queue-spacer { flex: 1; }
.cap-dwf__queue-list > li:first-child { border-top: 0; }
.cap-dwf__queue-meta {
  font-size: 11px; color: var(--der-text-faint);
}
.cap-dwf__queue-meta em {
  font-style: normal; color: var(--der-text-muted); font-weight: 500;
}
.cap-dwf__eyebrow {
  display: block;
  font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--der-text-muted);
  font-weight: 600;
}
.cap-dwf__title {
  margin: 4px 0 2px 0;
  font-size: 18px; font-weight: 600; color: var(--der-text);
  letter-spacing: -0.01em;
}
.cap-dwf__sub {
  margin: 4px 0 0 0;
  font-size: 13px; color: var(--der-text-muted); line-height: 1.5;
  max-width: 66ch;
}
.cap-dwf__list {
  margin: 0; padding: 0; list-style: none;
}
.cap-dwf__row {
  padding: 14px 18px;
  border-top: 1px solid #eef0f3;
}
.cap-dwf__row:first-child { border-top: 0; }
.cap-dwf__row-head {
  display: flex; align-items: baseline; gap: 10px;
  margin-bottom: 8px;
}
.cap-dwf__row-name {
  font-size: 15px; color: var(--der-text); font-weight: 600;
}
.cap-dwf__row-meta {
  font-size: 11px; color: var(--der-text-muted);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.cap-dwf__steps {
  margin: 0; padding: 0; list-style: none;
  display: flex; flex-direction: column; gap: 4px;
}
.cap-dwf__step {
  display: flex; align-items: center; gap: 10px;
  padding: 5px 10px;
  background: #fafcff;
  font-size: 13px; color: var(--der-text-muted);
}
.cap-dwf__step--mine {
  background: #ecf4fc;
  color: var(--der-text); font-weight: 500;
}
.cap-dwf__step-ord {
  min-width: 20px; height: 20px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--der-border); color: var(--der-text);
  font-size: 11px; font-weight: 600;
}
.cap-dwf__step--mine .cap-dwf__step-ord {
  background: var(--der-primary); color: var(--der-surface);
}
.cap-dwf__step-name { flex: 1; }
.cap-dwf__step-flag {
  font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--der-primary); font-weight: 600;
}
.cap-dwf__actions {
  margin-top: 10px;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
}
.cap-dwf__defer {
  font-size: 11px; color: var(--der-text-muted);
}

/* Workflow tabs when more than one workflow is assigned. */
.cap-dwf__tabs {
  display: flex; gap: 2px;
  padding: 0 14px;
  border-bottom: 1px solid #eef0f3;
  background: #fafcff;
  overflow-x: auto;
}
.cap-dwf__tab {
  padding: 8px 14px;
  background: transparent; border: 0; border-bottom: 2px solid transparent;
  color: var(--der-text-muted); font-size: 13px; font-weight: 500;
  cursor: pointer; font-family: inherit; white-space: nowrap;
}
.cap-dwf__tab:hover { background: var(--der-surface-subtle); }
.cap-dwf__tab--active {
  color: var(--der-primary); border-bottom-color: var(--der-primary);
}

.cap-dwf__run { padding: 14px 18px; }
.cap-dwf__start {
  display: flex; align-items: end; gap: 10px;
  margin: 10px 0;
}
.cap-dwf__runs {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 10px; align-items: end;
  margin: 10px 0;
}
.cap-dwf__step--current {
  background: #fff4de; color: var(--der-warning);
}
.cap-dwf__step--current .cap-dwf__step-ord {
  background: var(--der-warning); color: var(--der-surface);
}
.cap-dwf__ctx {
  margin-top: 14px;
  padding: 10px 14px;
  background: #fafcff;
  border: 1px solid var(--der-border);
}
.cap-dwf__ctx-title {
  margin: 0 0 8px 0;
  font-size: 12px; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--der-text-muted);
  font-weight: 600;
}
.cap-dwf__ctx-step {
  padding: 6px 0;
  border-top: 1px solid #eef0f3;
}
.cap-dwf__ctx-step:first-of-type { border-top: 0; }
.cap-dwf__ctx-step-title {
  margin: 0 0 4px 0;
  font-size: 12px; font-weight: 500; color: var(--der-text);
  letter-spacing: 0.02em;
}
.cap-dwf__ctx-grid {
  margin: 4px 0 0 0;
  display: grid;
  grid-template-columns: minmax(180px, 30%) 1fr;
  gap: 2px 14px;
  font-size: 13px;
}
.cap-dwf__ctx-grid > div { display: contents; }
.cap-dwf__ctx-grid dt {
  color: var(--der-text-muted); padding: 2px 0;
}
.cap-dwf__ctx-grid dd {
  margin: 0; color: var(--der-text); padding: 2px 0;
}
.cap-dwf__step-form {
  margin-top: 14px;
  padding: 10px 14px;
  background: var(--der-surface);
  border: 1px solid var(--der-border);
}

.cap-empty {
  margin: 24px 14px; padding: 24px;
  border: 1px dashed var(--der-border); border-radius: 0;
  background: #fafcff;
  display: flex; flex-direction: column; gap: 8px;
}
.cap-empty__title {
  margin: 0; font-size: 16px; font-weight: 600; color: var(--der-primary);
}
.cap-empty__body {
  margin: 0; color: var(--der-text-muted); font-size: 14px; max-width: 60ch;
}

.cap-section-head {
  margin: 20px 14px 10px 14px;
  display: flex; align-items: center; gap: 12px;
}
.cap-section-head__title {
  margin: 0; font-size: 12px; font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--der-text);
}
.cap-section-head__count {
  font-size: 12px; color: var(--der-text-faint); font-weight: 400;
}
.cap-section-head__rule {
  /* Pure flex spacer — the original border-top rule read as busy
   * clutter next to each list/section title, so we keep the layout
   * role but drop the hairline. */
  flex: 1;
}

/* Shared form engine styling — sections + typed inputs. Mirrors
 * the Data Entry app so operators feel at home. */
.cap-section-nav {
  position: sticky; top: 56px; z-index: 6;
  display: flex; gap: 6px; overflow-x: auto;
  padding: 6px 14px;
  background: #fafcff;
  border-bottom: 1px solid var(--der-border);
  scrollbar-width: thin;
}
.cap-section-nav__chip {
  padding: 4px 12px; border-radius: 0;
  border: 1px solid var(--der-border); background: var(--der-surface);
  color: var(--der-text-muted); font-size: 12px; font-weight: 500;
  white-space: nowrap; cursor: pointer; font-family: inherit;
}
.cap-section-nav__chip:hover { background: var(--der-surface-subtle); }
.cap-section-nav__chip--active {
  background: var(--der-primary); color: var(--der-surface); border-color: var(--der-primary);
}
.cap-section-nav__chip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--der-surface), 0 0 0 4px var(--der-primary);
}
.cap-form { padding: 0 14px 14px 14px;
            display: flex; flex-direction: column; gap: 14px; }
.cap-form-section {
  /* Dropped the box border + tinted fill — grouping comes from the
   * legend + consistent grid gaps; the outline was doing too much
   * work in a page that already uses one separator per section head. */
  padding: 10px 0 12px 0;
}
.cap-form-section__title {
  font-size: 12px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--der-text);
  padding: 0 6px; font-weight: 500;
  display: inline-flex; gap: 10px; align-items: baseline;
}
.cap-form-section__title-text { color: var(--der-text); }
.cap-form-section__title-count {
  font-size: 11px; font-weight: 400;
  color: var(--der-text-faint); text-transform: none; letter-spacing: 0;
}
.cap-form-section__req-ok { color: var(--der-success); font-weight: 500; }
.cap-form-section__req-pending { color: var(--der-warning); font-weight: 500; }
.cap-form-section__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px 14px; margin-top: 8px;
}
.cap-input {
  display: flex; flex-direction: column; gap: 4px;
}
.cap-input__label {
  font-size: 12px; color: var(--der-text); font-weight: 500;
}
.cap-input__req { color: #D32F2F; margin-left: 2px; }
.cap-input__ctl {
  padding: 6px 8px; border: 1px solid #aaa; border-radius: 0;
  font-size: 14px; background: var(--der-surface); font-family: inherit;
}
.cap-input__ctl:focus {
  outline: none; border-color: var(--der-primary);
  box-shadow: 0 0 0 2px rgba(20,124,215,0.2);
}
.cap-input__ctl--ro {
  background: var(--der-surface-subtle); color: var(--der-text-muted);
}
.cap-input__help {
  font-size: 11px; color: var(--der-text-muted);
}
.cap-field-warn {
  font-size: 11px; color: var(--der-warning);
  padding: 3px 6px; border-radius: 0;
  background: #fff4de; border: 1px solid #f4d7a2;
}
.cap-field-warn--err {
  color: var(--der-danger);
  background: var(--der-danger-subtle); border-color: var(--der-danger);
}

/* Sticky action footer — one row: save-state on the left, primary
 * actions on the right (§5.3 StickyActionBar). */
.cap-action-bar {
  position: sticky; bottom: 0; z-index: 5;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 10px 14px; margin: 0 -14px -14px -14px;
  background: var(--der-surface);
  border-top: 1px solid var(--der-border);
}
@media (max-width: 640px) {
  .cap-action-bar {
    gap: 8px;
  }
  .cap-action-bar__state {
    flex-basis: 100%; order: -1;
    padding-bottom: 4px;
    border-bottom: 1px solid #eef0f3;
  }
}
.cap-action-bar__state {
  flex: 1; color: var(--der-text-muted); font-size: 12px;
}
.cap-action-bar__state strong { color: var(--der-text); }
.cap-btn {
  padding: 7px 18px; border-radius: 0; font-size: 14px;
  font-weight: 500; cursor: pointer; border: 1px solid transparent;
  background: var(--der-surface);
}
.cap-btn--primary {
  background: var(--der-primary); color: var(--der-surface); border-color: var(--der-primary);
}
.cap-btn--primary:hover:not(:disabled) { background: var(--der-primary); }
.cap-btn--secondary {
  background: var(--der-surface); color: var(--der-text); border-color: var(--der-border);
}
.cap-btn--secondary:hover:not(:disabled) { background: var(--der-surface-subtle); }
.cap-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.cap-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--der-surface), 0 0 0 4px var(--der-primary);
}

/* Recent list — mirror the Data Entry chip aesthetic. */
.cap-list { margin: 0 14px 14px 14px; padding: 0; list-style: none; }
.cap-list__row {
  padding: 8px 10px; border-bottom: 1px solid var(--der-border-soft);
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 10px; align-items: center;
  font-size: 13px; color: var(--der-text);
}
.cap-list__row:last-child { border-bottom: 0; }
.cap-list__row:hover { background: var(--der-surface-subtle); }
.cap-list__row--clickable { cursor: pointer; }
.cap-list__row--clickable:focus {
  outline: none; background: var(--der-surface-subtle);
  box-shadow: inset 2px 0 0 var(--der-primary);
}
.cap-list__row--active {
  background: var(--der-primary-subtle);
  box-shadow: inset 2px 0 0 var(--der-primary);
}
.cap-list__when { color: var(--der-text-muted); }

.cap-row-actions { position: relative; display: inline-block; }
.cap-row-actions__trigger {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  background: transparent; border: 1px solid transparent;
  color: var(--der-text-muted); cursor: pointer;
  padding: 0; font-family: inherit;
}
.cap-row-actions__trigger:hover {
  background: var(--der-surface-subtle); border-color: var(--der-border); color: var(--der-primary);
}
.cap-row-actions__menu {
  position: absolute; right: 0; top: 100%;
  margin: 2px 0 0 0; padding: 4px 0; list-style: none;
  background: var(--der-surface);
  border: 1px solid #d8dee8;
  min-width: 180px;
  z-index: 50;
}
.cap-row-actions__item {
  display: block; width: 100%; padding: 6px 12px;
  text-align: left;
  background: transparent; border: 0;
  color: var(--der-text); font-size: 13px; cursor: pointer;
  font-family: inherit;
}
.cap-row-actions__item:hover:not(:disabled) { background: var(--der-surface-subtle); }
.cap-row-actions__item:disabled {
  color: var(--der-text-faint); cursor: not-allowed;
}
.cap-row-actions__item--danger { color: var(--der-danger); }
.cap-row-actions__item--danger:hover:not(:disabled) {
  background: var(--der-danger-subtle);
}

/* Flat chips — no background, no border; the colour alone
 * carries the semantic. Matches the user's 'no chips styles'
 * directive while still being scannable. */
.cap-chip {
  display: inline;
  padding: 0;
  font-size: 11px; font-weight: 500;
  background: transparent; color: var(--der-primary);
  border: 0;
  text-transform: uppercase; letter-spacing: 0.04em;
}
.cap-chip--warn { color: var(--der-warning); }

.cap-identity-strip {
  margin: 10px 14px;
  padding: 10px 14px;
  background: #fafcff;
  border: 1px solid var(--der-border);
  border-radius: 0;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  align-items: center;
  font-size: 13px;
}
.cap-identity-strip > div {
  display: flex; align-items: center; gap: 8px;
  flex-wrap: wrap;
}

.cap-stage-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 14px;
  margin: 10px 14px 14px 14px;
  min-height: 240px;
}
.cap-stage-rail {
  display: flex; flex-direction: column; gap: 4px;
  padding: 6px;
  background: #fafcff;
  border: 1px solid var(--der-border);
  border-radius: 0;
  align-self: start;
}
.cap-stage-rail__item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px;
  background: transparent; border: 0; border-radius: 0;
  cursor: pointer; font-family: inherit;
  font-size: 13px; color: var(--der-text);
  text-align: left;
}
.cap-stage-rail__item:hover { background: var(--der-surface-subtle); }
.cap-stage-rail__item--active {
  background: var(--der-primary-subtle); color: var(--der-primary); font-weight: 600;
  box-shadow: inset 2px 0 0 var(--der-primary);
}
.cap-stage-rail__name { flex: 1; }
.cap-stage-rail__count {
  min-width: 22px; padding: 1px 6px;
  text-align: center;
  background: var(--der-surface-subtle); color: var(--der-text-muted);
  font-size: 11px; font-weight: 500;
  border-radius: 0;
  margin-left: 8px;
}
.cap-stage-rail__item--active .cap-stage-rail__count {
  background: var(--der-primary); color: var(--der-surface);
}
.cap-stage-pane {
  padding: 10px 14px;
  background: var(--der-surface);
  border: 1px solid var(--der-border);
  border-radius: 0;
  min-height: 160px;
}
@media (max-width: 760px) {
  .cap-stage-layout {
    grid-template-columns: 1fr;
  }
}

/* Info popover — matches the Data Entry info modal. */
.cap-info-backdrop {
  position: fixed; inset: 0;
  background: rgba(10,30,56,0.42);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
}
.cap-info {
  width: min(560px, calc(100vw - 32px));
  background: var(--der-surface);
  border-radius: 0;
  border: 1px solid #d8dee8;
  display: flex; flex-direction: column;
  max-height: calc(100vh - 32px);
  overflow: hidden;
}
.cap-info__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--der-border);
}
.cap-info__title { margin: 0; font-size: 16px; font-weight: 600;
                   color: var(--der-primary); }
.cap-info__close {
  background: transparent; border: 0; color: var(--der-text-muted);
  cursor: pointer; font-size: 20px; line-height: 1; padding: 2px 6px;
}
.cap-info__body {
  padding: 16px 18px; overflow: auto;
  display: flex; flex-direction: column; gap: 12px;
  font-size: 14px; color: var(--der-text); line-height: 1.5;
}
.cap-info__dl {
  margin: 0; display: grid; grid-template-columns: max-content 1fr;
  gap: 4px 12px; font-size: 13px;
}
.cap-info__dl > div {
  display: contents;
}
.cap-info__dl dt {
  color: var(--der-text-muted); font-weight: 500;
}
.cap-info__dl dd { margin: 0; color: var(--der-text); }
.cap-info__note {
  margin: 0; padding: 10px; border-radius: 0;
  background: var(--der-primary-subtle); color: var(--der-primary); font-size: 13px;
}
.cap-info__dl kbd {
  display: inline-block;
  padding: 1px 6px; min-width: 20px;
  text-align: center;
  background: var(--der-surface-subtle); color: var(--der-text);
  border: 1px solid #cfd7e4; border-bottom-width: 2px;
  border-radius: 0;
  font-size: 11px; font-family: ui-monospace, Menlo, monospace;
}

/* --- ContextInspector (v3 §5.3) ---------------------------------
 * Right-side overlay panel. Backdrop is transparent on desktop so
 * the operator can still see the page beneath; on narrow viewports
 * the panel becomes a full-width sheet.
 */
.cap-insp-backdrop {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(23, 38, 60, 0.18);
  display: flex; justify-content: flex-end;
}
.cap-insp {
  width: 360px; max-width: 95vw; height: 100%;
  background: var(--der-surface);
  border-left: 1px solid var(--der-border);
  box-shadow: -2px 0 0 rgba(23, 38, 60, 0.04);
  display: flex; flex-direction: column;
  outline: none;
}
.cap-insp__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--der-border);
}
.cap-insp__title {
  margin: 0; font-size: 13px; font-weight: 600;
  letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--der-text-muted);
}
.cap-insp__close {
  background: transparent; border: 0;
  color: var(--der-text-muted); cursor: pointer;
  font-size: 22px; line-height: 1; padding: 0 4px;
}
.cap-insp__close:hover { color: var(--der-text); }
.cap-insp__tabs {
  display: flex; gap: 0;
  border-bottom: 1px solid var(--der-border);
}
.cap-insp__tab {
  flex: 1; padding: 8px 10px;
  background: transparent; border: 0;
  border-bottom: 2px solid transparent;
  font-size: 12px; font-weight: 500; font-family: inherit;
  color: var(--der-text-muted); cursor: pointer;
}
.cap-insp__tab:hover { color: var(--der-text); }
.cap-insp__tab--active {
  color: var(--der-primary);
  border-bottom-color: var(--der-primary);
}
.cap-insp__body {
  flex: 1; overflow: auto;
  padding: 14px;
  font-size: 13px; color: var(--der-text);
  display: flex; flex-direction: column; gap: 12px;
}
.cap-insp__sync-line {
  display: inline-flex; align-items: center; gap: 6px;
  font-weight: 500;
}
.cap-insp__sync-line--live { color: var(--der-success); }
.cap-insp__sync-line--syncing { color: var(--der-warning); }
.cap-insp__sync-line--offline-held { color: var(--der-warning); }
.cap-insp__sync-line--offline { color: var(--der-text-muted); }
.cap-insp__hint {
  margin: 10px 0 0 0;
  padding: 8px 10px;
  background: var(--der-surface-subtle);
  color: var(--der-text-muted);
  font-size: 11px; line-height: 1.5;
}
@media (max-width: 640px) {
  .cap-insp { width: 100%; max-width: 100%; }
}
`;
