/**
 * Shared renderer for any "last-error / response body" field in the
 * admin UI. The server stores these raw — usually central DHIS2's
 * ImportSummary JSON, sometimes a plain-text error. The admin UI used
 * to inline these directly inside a table cell, which produced very
 * long horizontal-scrolling rows when central answered with the full
 * ImportSummary envelope (see the user-reported row on
 * /admin/data/aggregate/<id> with the 200 OK / zero-import body).
 *
 * This component:
 *   - pretty-prints if the body parses as JSON (2-space indent),
 *   - renders inside a monospace <pre> that wraps long tokens,
 *   - caps max-height with vertical scroll instead of horizontal.
 */

export interface ResponseBodyProps {
  readonly text: string | null | undefined;
  readonly dataTest?: string;
}

function tryPretty(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return raw;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return raw;
  }
}

export function ResponseBody(
  { text, dataTest }: ResponseBodyProps,
): JSX.Element {
  if (text == null || text === '') {
    return <span className="ea-text-muted" data-test={dataTest}>—</span>;
  }
  const pretty = tryPretty(text);
  return (
    <pre
      className="ea-response-body"
      data-test={dataTest}
      style={{
        margin: 0,
        padding: '6px 8px',
        fontSize: 11,
        lineHeight: 1.4,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        maxHeight: 240,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: '#f7f8fa',
        border: '1px solid #e0e4eb',
        borderRadius: 4,
      }}
    >
      {pretty}
    </pre>
  );
}
