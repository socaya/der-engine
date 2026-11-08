/**
 * Shared design-token CSS for the unified Capture app. Palette +
 * sizing + focus halo match the Data Entry app so operators get
 * one consistent muscle memory across both modules (requirements
 * doc §5 "Modern DER Capture Design System" — reuse established
 * DER tokens from the real repository).
 */
export const CAPTURE_STYLES = `
.cap-toolbar {
  position: sticky; top: 0; z-index: 10;
  display: grid;
  grid-template-columns: minmax(280px, auto) 1fr 1fr auto;
  gap: 12px; align-items: end;
  padding: 10px 14px 12px 14px;
  background: #fff;
  border-bottom: 1px solid #e3e8f0;
}
.cap-toolbar__brand {
  display: flex; align-items: center; gap: 10px;
  padding-bottom: 1px;
}
.cap-toolbar__icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  background: #e8f0fa;
}
.cap-toolbar__title {
  margin: 0; font-size: 18px; font-weight: 600;
  color: #0a5497; letter-spacing: -0.01em;
}
.cap-toolbar__info-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%;
  background: transparent; border: 1px solid #c6d4e4;
  color: #147CD7; cursor: pointer; padding: 0;
}
.cap-toolbar__info-btn:hover { background: #eef2f8; }
.cap-toolbar__field, .cap-toolbar__ou {
  display: flex; flex-direction: column; gap: 4px;
  min-width: 0;
}
.cap-toolbar__field-label {
  font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.06em; color: #6e7a8a;
}
.cap-toolbar__select {
  padding: 6px 8px; border: 1px solid #aaa; border-radius: 3px;
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
  padding: 6px 8px; border: 1px solid #e3e8f0; border-radius: 3px;
  background: #f6f8fc; color: #263352;
  font-size: 13px; font-family: inherit;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cap-toolbar__mode {
  align-self: end; justify-self: end;
  padding: 4px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600; letter-spacing: 0.02em;
  border: 1px solid #c6d4e4; background: #eef2f8;
  color: #0a5497;
}
.cap-toolbar__mode--tracker {
  background: #f1e7fa; border-color: #d8c1ef; color: #5a2b96;
}
.cap-toolbar__mode--event {
  background: #ebf6f1; border-color: #bfe4d2; color: #136436;
}

.cap-sub {
  margin: 10px 14px 0 14px; color: #4a5768; font-size: 13px;
}
.cap-sub__code {
  background: #eef2f8; padding: 1px 6px; border-radius: 4px;
  font-size: 12px; margin-inline: 4px;
}

.cap-strip {
  margin: 10px 14px 0 14px; padding: 8px 12px; border-radius: 4px;
  font-size: 13px;
}
.cap-strip--ok  { background: #ecf7f0; color: #136436;
                  border: 1px solid #b7dcc7; }
.cap-strip--err { background: #fbeaea; color: #8a2525;
                  border: 1px solid #e0bcbc; }
.cap-strip--info{ background: #eaf3fc; color: #0a5497;
                  border: 1px solid #cfe1f4; }

.cap-empty {
  margin: 24px 14px; padding: 24px;
  border: 1px dashed #c6d4e4; border-radius: 8px;
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
  margin: 0; font-size: 12px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: #0a5497;
}
.cap-section-head__count {
  font-size: 12px; color: #6e7a8a; font-weight: 400;
}
.cap-section-head__rule {
  flex: 1; border-top: 1px solid #e3e8f0;
}

/* Shared form engine styling — sections + typed inputs. Mirrors
 * the Data Entry app so operators feel at home. */
.cap-form { padding: 0 14px 14px 14px;
            display: flex; flex-direction: column; gap: 14px; }
.cap-form-section {
  border: 1px solid #e3e8f0; border-radius: 6px;
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
  padding: 6px 8px; border: 1px solid #aaa; border-radius: 3px;
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

/* Sticky action footer — one row: save-state on the left, primary
 * actions on the right (§5.3 StickyActionBar). */
.cap-action-bar {
  position: sticky; bottom: 0; z-index: 5;
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; margin: 0 -14px -14px -14px;
  background: #fff;
  border-top: 1px solid #e3e8f0;
}
.cap-action-bar__state {
  flex: 1; color: #6e7a8a; font-size: 12px;
}
.cap-action-bar__state strong { color: #263352; }
.cap-btn {
  padding: 7px 18px; border-radius: 3px; font-size: 14px;
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

.cap-chip {
  display: inline-block;
  padding: 1px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 500;
  background: #eef2f8; color: #0a5497;
  border: 1px solid #cfe1f4;
}

.cap-identity-strip {
  margin: 10px 14px;
  padding: 10px 14px;
  background: #fafcff;
  border: 1px solid #e3e8f0;
  border-radius: 6px;
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
  border-radius: 6px;
  align-self: start;
}
.cap-stage-rail__item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px;
  background: transparent; border: 0; border-radius: 4px;
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
  border-radius: 999px;
  margin-left: 8px;
}
.cap-stage-rail__item--active .cap-stage-rail__count {
  background: #147CD7; color: #fff;
}
.cap-stage-pane {
  padding: 10px 14px;
  background: #fff;
  border: 1px solid #e3e8f0;
  border-radius: 6px;
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
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(10,30,56,0.28);
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
  margin: 0; padding: 10px; border-radius: 6px;
  background: #eaf3fc; color: #0a5497; font-size: 13px;
}
`;
