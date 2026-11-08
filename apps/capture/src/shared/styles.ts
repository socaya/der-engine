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
  --cap-ink-900: #101a32;
  --cap-ink-700: #263352;
  --cap-ink-500: #4a5768;
  --cap-ink-300: #7a8597;
  --cap-border: #ecedf0;
  --cap-border-soft: #f2f3f7;
  --cap-surface: #ffffff;
  --cap-surface-soft: #fafbfd;
  --cap-brand-500: #147CD7;
  --cap-brand-700: #0a5497;
}
.cap-toolbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; flex-direction: column; gap: 10px;
  padding: 10px 14px 10px 14px;
  background: #fff;
  border-bottom: 1px solid #e5e9ef;
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
  text-transform: uppercase; color: #9097a8;
}
.cap-toolbar__ou-value {
  color: #101a32; font-size: 13px; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cap-toolbar__mode--empty {
  background: #f3f5f8; color: #94a3b8; border-color: #e3e8f0;
}
.cap-toolbar__icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 0;
  background: #e8f0fa;
}
.cap-toolbar__title {
  margin: 0; font-size: 18px; font-weight: 600;
  color: #0a5497; letter-spacing: -0.01em;
}
.cap-toolbar__info-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  background: transparent; border: 1px solid #c6d4e4;
  color: #147CD7; cursor: pointer; padding: 0;
}
.cap-toolbar__info-btn:hover { background: #eef2f8; }
.cap-net-status {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0; font-size: 12px; font-weight: 500;
  color: var(--cap-ink-700, #263352);
  background: transparent; border: 0;
  white-space: nowrap; cursor: help;
}
.cap-net-status__dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #94a3b8;
  box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.18);
}
.cap-net-status--live .cap-net-status__dot {
  background: #1E8E4A;
  box-shadow: 0 0 0 2px rgba(30, 142, 74, 0.2);
}
.cap-net-status--live { color: #136436; }
.cap-net-status--syncing .cap-net-status__dot {
  background: #F59E0B;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.22);
  animation: cap-pulse 1.6s ease-in-out infinite;
}
.cap-net-status--syncing { color: #A56518; }
.cap-net-status--offline-held .cap-net-status__dot {
  background: #F59E0B;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.22);
}
.cap-net-status--offline-held { color: #A56518; }
.cap-net-status--offline { color: #6e7a8a; }
@keyframes cap-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.cap-dirty-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 0;
  font-size: 12px; font-weight: 600;
  background: transparent; color: #A56518;
  border: 0;
  white-space: nowrap;
}
.cap-dirty-chip__dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #F59E0B;
}
.cap-toolbar__field, .cap-toolbar__ou {
  display: flex; flex-direction: column; gap: 4px;
  min-width: 0;
}
.cap-toolbar__field-label {
  font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.06em; color: #6e7a8a;
}
.cap-toolbar__select {
  padding: 6px 8px; border: 1px solid #aaa; border-radius: 0;
  font-size: 14px; background: #fff; appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, #6e7a8a 50%),
    linear-gradient(135deg, #6e7a8a 50%, transparent 50%);
  background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 24px;
}
.cap-toolbar__select:focus {
  outline: none; border-color: #147CD7;
  box-shadow: 0 0 0 2px rgba(20,124,215,0.2);
}
.cap-toolbar__select:disabled { background-color: #f3f5f8; color: #94a3b8; }
.cap-toolbar__ou-code {
  display: inline-block;
  padding: 6px 8px; border: 1px solid #e3e8f0; border-radius: 0;
  background: #f6f8fc; color: #263352;
  font-size: 13px; font-family: inherit;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cap-toolbar__mode {
  display: inline-block;
  padding: 2px 0;
  font-size: 13px; font-weight: 500;
  color: #263352;
  background: transparent; border: 0;
  letter-spacing: 0;
}
.cap-toolbar__mode--tracker { color: #5a2b96; }
.cap-toolbar__mode--event   { color: #136436; }

.cap-sub {
  margin: 10px 14px 0 14px; color: #4a5768; font-size: 13px;
}
.cap-sub__code {
  background: #eef2f8; padding: 1px 6px; border-radius: 0;
  font-size: 12px; margin-inline: 4px;
}

.cap-strip {
  margin: 10px 14px 0 14px; padding: 8px 12px; border-radius: 0;
  font-size: 13px;
}
.cap-strip--ok  { background: #ecf7f0; color: #136436;
                  border: 1px solid #b7dcc7; }
.cap-strip--err { background: #fbeaea; color: #8a2525;
                  border: 1px solid #e0bcbc; }
.cap-strip--info{ background: #eaf3fc; color: #0a5497;
                  border: 1px solid #cfe1f4; }
.cap-strip--warn{ background: #fff4de; color: #A56518;
                  border: 1px solid #f4d7a2; }

.cap-toolbar__field--wf {
  min-width: 0;
}
.cap-wf-chips {
  display: inline;
  color: #263352; font-size: 13px; font-weight: 500;
}
.cap-wf-chip {
  display: inline;
  color: #5a2b96;
  background: transparent; border: 0; padding: 0;
  font-weight: 500;
}
.cap-wf-chip + .cap-wf-chip::before {
  content: ' · ';
  color: #9097a8; font-weight: 400;
}
.cap-wf-chip--more {
  color: #6e7a8a; font-weight: 400;
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
  border-left: 3px solid #147CD7;
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  font-size: 13px; line-height: 1.4;
}
.cap-dwf__banner-title { color: #0a5497; font-weight: 600; }
.cap-dwf__banner-meta { color: #4a5768; font-size: 12px; }
.cap-dwf__banner-meta em { color: #263352; font-style: normal;
  font-weight: 500; }
.cap-dwf__eyebrow {
  display: block;
  font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.1em; color: #6e7a8a;
  font-weight: 600;
}
.cap-dwf__title {
  margin: 4px 0 2px 0;
  font-size: 18px; font-weight: 600; color: #101a32;
  letter-spacing: -0.01em;
}
.cap-dwf__sub {
  margin: 4px 0 0 0;
  font-size: 13px; color: #4a5768; line-height: 1.5;
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
  font-size: 15px; color: #101a32; font-weight: 600;
}
.cap-dwf__row-meta {
  font-size: 11px; color: #6e7a8a;
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
  font-size: 13px; color: #4a5768;
}
.cap-dwf__step--mine {
  background: #ecf4fc;
  color: #101a32; font-weight: 500;
}
.cap-dwf__step-ord {
  min-width: 20px; height: 20px;
  display: inline-flex; align-items: center; justify-content: center;
  background: #e3e8f0; color: #263352;
  font-size: 11px; font-weight: 600;
}
.cap-dwf__step--mine .cap-dwf__step-ord {
  background: #147CD7; color: #fff;
}
.cap-dwf__step-name { flex: 1; }
.cap-dwf__step-flag {
  font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.08em; color: #0a5497; font-weight: 600;
}
.cap-dwf__actions {
  margin-top: 10px;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
}
.cap-dwf__defer {
  font-size: 11px; color: #6e7a8a;
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
  color: #4a5768; font-size: 13px; font-weight: 500;
  cursor: pointer; font-family: inherit; white-space: nowrap;
}
.cap-dwf__tab:hover { background: #eef2f8; }
.cap-dwf__tab--active {
  color: #0a5497; border-bottom-color: #147CD7;
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
  background: #fff4de; color: #A56518;
}
.cap-dwf__step--current .cap-dwf__step-ord {
  background: #F59E0B; color: #fff;
}
.cap-dwf__ctx {
  margin-top: 14px;
  padding: 10px 14px;
  background: #fafcff;
  border: 1px solid #e3e8f0;
}
.cap-dwf__ctx-title {
  margin: 0 0 8px 0;
  font-size: 12px; text-transform: uppercase;
  letter-spacing: 0.08em; color: #6e7a8a;
  font-weight: 600;
}
.cap-dwf__ctx-step {
  padding: 6px 0;
  border-top: 1px solid #eef0f3;
}
.cap-dwf__ctx-step:first-of-type { border-top: 0; }
.cap-dwf__ctx-step-title {
  margin: 0 0 4px 0;
  font-size: 12px; font-weight: 500; color: #263352;
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
  color: #6e7a8a; padding: 2px 0;
}
.cap-dwf__ctx-grid dd {
  margin: 0; color: #101a32; padding: 2px 0;
}
.cap-dwf__step-form {
  margin-top: 14px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid #c6d4e4;
}

.cap-empty {
  margin: 24px 14px; padding: 24px;
  border: 1px dashed #c6d4e4; border-radius: 0;
  background: #fafcff;
  display: flex; flex-direction: column; gap: 8px;
}
.cap-empty__title {
  margin: 0; font-size: 16px; font-weight: 600; color: #0a5497;
}
.cap-empty__body {
  margin: 0; color: #4a5768; font-size: 14px; max-width: 60ch;
}

.cap-section-head {
  margin: 20px 14px 10px 14px;
  display: flex; align-items: center; gap: 12px;
}
.cap-section-head__title {
  margin: 0; font-size: 12px; font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: #263352;
}
.cap-section-head__count {
  font-size: 12px; color: #7a8597; font-weight: 400;
}
.cap-section-head__rule {
  flex: 1; border-top: 1px solid #ecedf0;
}

/* Shared form engine styling — sections + typed inputs. Mirrors
 * the Data Entry app so operators feel at home. */
.cap-section-nav {
  position: sticky; top: 56px; z-index: 6;
  display: flex; gap: 6px; overflow-x: auto;
  padding: 6px 14px;
  background: #fafcff;
  border-bottom: 1px solid #e3e8f0;
  scrollbar-width: thin;
}
.cap-section-nav__chip {
  padding: 4px 12px; border-radius: 0;
  border: 1px solid #c6d4e4; background: #fff;
  color: #4a5768; font-size: 12px; font-weight: 500;
  white-space: nowrap; cursor: pointer; font-family: inherit;
}
.cap-section-nav__chip:hover { background: #eef2f8; }
.cap-section-nav__chip--active {
  background: #147CD7; color: #fff; border-color: #0a5497;
}
.cap-section-nav__chip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #147CD7;
}
.cap-form { padding: 0 14px 14px 14px;
            display: flex; flex-direction: column; gap: 14px; }
.cap-form-section {
  border: 1px solid #e3e8f0; border-radius: 0;
  padding: 10px 14px 12px 14px; background: #fcfdfe;
}
.cap-form-section__title {
  font-size: 12px; text-transform: uppercase;
  letter-spacing: 0.06em; color: #147CD7;
  padding: 0 6px; font-weight: 600;
}
.cap-form-section__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px 14px; margin-top: 8px;
}
.cap-input {
  display: flex; flex-direction: column; gap: 4px;
}
.cap-input__label {
  font-size: 12px; color: #263352; font-weight: 500;
}
.cap-input__req { color: #D32F2F; margin-left: 2px; }
.cap-input__ctl {
  padding: 6px 8px; border: 1px solid #aaa; border-radius: 0;
  font-size: 14px; background: #fff; font-family: inherit;
}
.cap-input__ctl:focus {
  outline: none; border-color: #147CD7;
  box-shadow: 0 0 0 2px rgba(20,124,215,0.2);
}
.cap-input__ctl--ro {
  background: #f3f5f8; color: #6e7a8a;
}
.cap-input__help {
  font-size: 11px; color: #6e7a8a;
}
.cap-field-warn {
  font-size: 11px; color: #A56518;
  padding: 3px 6px; border-radius: 0;
  background: #fff4de; border: 1px solid #f4d7a2;
}
.cap-field-warn--err {
  color: #8a2525;
  background: #fbeaea; border-color: #e0bcbc;
}

/* Sticky action footer — one row: save-state on the left, primary
 * actions on the right (§5.3 StickyActionBar). */
.cap-action-bar {
  position: sticky; bottom: 0; z-index: 5;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 10px 14px; margin: 0 -14px -14px -14px;
  background: #fff;
  border-top: 1px solid #e3e8f0;
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
  flex: 1; color: #6e7a8a; font-size: 12px;
}
.cap-action-bar__state strong { color: #263352; }
.cap-btn {
  padding: 7px 18px; border-radius: 0; font-size: 14px;
  font-weight: 500; cursor: pointer; border: 1px solid transparent;
  background: #fff;
}
.cap-btn--primary {
  background: #147CD7; color: #fff; border-color: #0a5497;
}
.cap-btn--primary:hover:not(:disabled) { background: #0a5497; }
.cap-btn--secondary {
  background: #fff; color: #263352; border-color: #c6d4e4;
}
.cap-btn--secondary:hover:not(:disabled) { background: #eef2f8; }
.cap-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.cap-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #147CD7;
}

/* Recent list — mirror the Data Entry chip aesthetic. */
.cap-list { margin: 0 14px 14px 14px; padding: 0; list-style: none; }
.cap-list__row {
  padding: 8px 10px; border-bottom: 1px solid #eef0f3;
  display: grid; grid-template-columns: 1fr auto; gap: 10px;
  font-size: 13px; color: #263352;
}
.cap-list__row:hover { background: #fafcff; }
.cap-list__row--clickable { cursor: pointer; }
.cap-list__row--clickable:focus {
  outline: none; background: #eef2f8;
  box-shadow: inset 2px 0 0 #147CD7;
}
.cap-list__row--active {
  background: #eaf3fc;
  box-shadow: inset 2px 0 0 #147CD7;
}
.cap-list__when { color: #6e7a8a; }

/* Flat chips — no background, no border; the colour alone
 * carries the semantic. Matches the user's 'no chips styles'
 * directive while still being scannable. */
.cap-chip {
  display: inline;
  padding: 0;
  font-size: 11px; font-weight: 500;
  background: transparent; color: #0a5497;
  border: 0;
  text-transform: uppercase; letter-spacing: 0.04em;
}
.cap-chip--warn { color: #A56518; }

.cap-identity-strip {
  margin: 10px 14px;
  padding: 10px 14px;
  background: #fafcff;
  border: 1px solid #e3e8f0;
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
  border: 1px solid #e3e8f0;
  border-radius: 0;
  align-self: start;
}
.cap-stage-rail__item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px;
  background: transparent; border: 0; border-radius: 0;
  cursor: pointer; font-family: inherit;
  font-size: 13px; color: #263352;
  text-align: left;
}
.cap-stage-rail__item:hover { background: #eef2f8; }
.cap-stage-rail__item--active {
  background: #eaf3fc; color: #0a5497; font-weight: 600;
  box-shadow: inset 2px 0 0 #147CD7;
}
.cap-stage-rail__name { flex: 1; }
.cap-stage-rail__count {
  min-width: 22px; padding: 1px 6px;
  text-align: center;
  background: #eef2f8; color: #6e7a8a;
  font-size: 11px; font-weight: 500;
  border-radius: 0;
  margin-left: 8px;
}
.cap-stage-rail__item--active .cap-stage-rail__count {
  background: #147CD7; color: #fff;
}
.cap-stage-pane {
  padding: 10px 14px;
  background: #fff;
  border: 1px solid #e3e8f0;
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
  background: #fff;
  border-radius: 0;
  border: 1px solid #d8dee8;
  display: flex; flex-direction: column;
  max-height: calc(100vh - 32px);
  overflow: hidden;
}
.cap-info__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e3e8f0;
}
.cap-info__title { margin: 0; font-size: 16px; font-weight: 600;
                   color: #0a5497; }
.cap-info__close {
  background: transparent; border: 0; color: #6e7a8a;
  cursor: pointer; font-size: 20px; line-height: 1; padding: 2px 6px;
}
.cap-info__body {
  padding: 16px 18px; overflow: auto;
  display: flex; flex-direction: column; gap: 12px;
  font-size: 14px; color: #263352; line-height: 1.5;
}
.cap-info__dl {
  margin: 0; display: grid; grid-template-columns: max-content 1fr;
  gap: 4px 12px; font-size: 13px;
}
.cap-info__dl > div {
  display: contents;
}
.cap-info__dl dt {
  color: #6e7a8a; font-weight: 500;
}
.cap-info__dl dd { margin: 0; color: #263352; }
.cap-info__note {
  margin: 0; padding: 10px; border-radius: 0;
  background: #eaf3fc; color: #0a5497; font-size: 13px;
}
.cap-info__dl kbd {
  display: inline-block;
  padding: 1px 6px; min-width: 20px;
  text-align: center;
  background: #f6f8fc; color: #263352;
  border: 1px solid #cfd7e4; border-bottom-width: 2px;
  border-radius: 0;
  font-size: 11px; font-family: ui-monospace, Menlo, monospace;
}
`;
