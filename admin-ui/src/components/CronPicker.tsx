import { useEffect, useMemo, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import { UiIcon } from './UiIcon';

/**
 * UI-10 — friendly cron editor.
 *
 * <p>Raw 6-field Quartz cron expressions are opaque for most
 * operators. This component wraps them with a preset dropdown
 * covering the frequencies DER operators actually pick ("Every
 * minute", "Every 5 minutes", "Every hour", "Every 4 hours",
 * "Every day at 03:00", "Weekdays at 09:00", …) plus a "Custom"
 * option that reveals the raw text field with live validation and
 * a next-3-fire-times preview powered by {@code
 * GET /edge-api/v1/admin/settings/cron-preview}.</p>
 *
 * <p>Value model stays a plain Quartz cron string so the server
 * never sees the preset abstraction — the component is pure UI.</p>
 */
export interface CronPreset {
  key: string;
  label: string;
  cron: string;
  hint?: string;
}

const PRESETS: ReadonlyArray<CronPreset> = [
  { key: 'minute',     label: 'Every minute',       cron: '0 * * * * ?',
    hint: 'Checks for new work every minute' },
  { key: 'five-min',   label: 'Every 5 minutes',    cron: '0 */5 * * * ?',
    hint: 'Common for drains + inbox polls' },
  { key: 'fifteen-min', label: 'Every 15 minutes',   cron: '0 */15 * * * ?' },
  { key: 'thirty-min', label: 'Every 30 minutes',   cron: '0 */30 * * * ?' },
  { key: 'hour',       label: 'Every hour',         cron: '0 0 * * * ?' },
  { key: 'four-hour',  label: 'Every 4 hours',      cron: '0 0 */4 * * ?' },
  { key: 'daily-3am',  label: 'Every day at 03:00', cron: '0 0 3 * * ?',
    hint: 'Good for compat refresh + nightly rotations' },
  { key: 'daily-mid',  label: 'Every day at 00:00', cron: '0 0 0 * * ?' },
  { key: 'weekday-9',  label: 'Weekdays at 09:00',  cron: '0 0 9 ? * MON-FRI' },
  { key: 'sunday-2am', label: 'Sundays at 02:00',   cron: '0 0 2 ? * SUN' },
];

export function CronPicker(
  { value, onChange, autoPreview = true }: {
    value: string;
    onChange: (cron: string) => void;
    autoPreview?: boolean;
  },
): JSX.Element {
  const matched = useMemo(
    () => PRESETS.find((p) => p.cron === value) ?? null,
    [value]);
  const [custom, setCustom] = useState<boolean>(matched === null);
  const [preview, setPreview] = useState<string[] | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);

  useEffect(() => {
    if (!autoPreview || !value) return;
    let alive = true;
    edgeApi.previewCron(value, 3)
      .then((r) => { if (alive) { setPreview(r.next); setPreviewErr(null); } })
      .catch((e) => { if (alive) {
        setPreview(null);
        setPreviewErr((e as Error).message ?? 'invalid cron');
      } });
    return () => { alive = false; };
  }, [value, autoPreview]);

  return (
    <div data-test="cron-picker"
         style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center',
                     flexWrap: 'wrap' }}>
        <select
          value={custom ? 'custom' : (matched?.key ?? 'custom')}
          onChange={(e) => {
            const k = e.target.value;
            if (k === 'custom') {
              setCustom(true);
              return;
            }
            setCustom(false);
            const p = PRESETS.find((x) => x.key === k);
            if (p) onChange(p.cron);
          }}
          data-test="cron-picker-preset"
          className="ea-input"
          style={{ minWidth: 220 }}>
          {PRESETS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
          <option value="custom">Custom cron expression…</option>
        </select>
        {!custom && matched?.hint && (
          <span className="ea-text-muted" style={{ fontSize: 12 }}>
            {matched.hint}
          </span>
        )}
      </div>
      {custom && (
        <input value={value}
               onChange={(e) => onChange(e.target.value)}
               data-test="cron-picker-custom"
               placeholder="0 * * * * ?"
               className="ea-input ea-mono"
               style={{ fontSize: 13 }} />
      )}
      {preview && preview.length > 0 && (
        <div className="ea-text-muted"
             data-test="cron-picker-preview"
             style={{ fontSize: 11,
                       display: 'flex', gap: 10, flexWrap: 'wrap',
                       alignItems: 'center' }}>
          <UiIcon icon="schedule" size={12} />
          <span>Next runs:</span>
          {preview.map((p, i) => (
            <code key={i}
                  style={{ padding: '1px 4px', fontSize: 11 }}>
              {new Date(p).toLocaleString()}
            </code>
          ))}
        </div>
      )}
      {previewErr && (
        <div className="ea-text-muted"
             role="alert"
             data-test="cron-picker-err"
             style={{ fontSize: 11, color: 'var(--der-danger-ink)' }}>
          {previewErr}
        </div>
      )}
    </div>
  );
}
