import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

/**
 * Validation findings for one workflow run (spec §36). Shows every
 * open issue the ProgressiveValidator has flagged, grouped by
 * severity.
 */
export interface RunValidationProps {
  api?: Pick<typeof edgeApi, 'runValidation'>;
  runId?: string;
}

export function RunValidation({ api = edgeApi, runId: propRunId }:
    RunValidationProps = {}): JSX.Element {
  const params = useParams();
  const runId = propRunId ?? params.runId ?? '';
  const [data, setData] = useState<
    { errorCount: number; issues: edgeApi.ValidationIssue[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    api.runValidation(runId)
      .then((r) => setData({ errorCount: r.errorCount, issues: r.issues }))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [api, runId]);

  if (error) {
    return <ErrorBlock title="Validation load failed"
                        testId="validation-error">{error}</ErrorBlock>;
  }
  if (data == null) {
    return <LoadingBlock testId="validation-loading" />;
  }
  const bySeverity = {
    ERROR: data.issues.filter((i) => i.severity === 'ERROR'),
    WARNING: data.issues.filter((i) => i.severity === 'WARNING'),
    INFO: data.issues.filter((i) => i.severity === 'INFO'),
  };

  return (
    <div className="ea-screen" data-test="validation-root">
      <header className="ea-screen-header">
        <div className="ea-screen-header-text">
          <h1 data-test="validation-heading">
            Validation · <code className="ea-mono">{runId.slice(0, 8)}</code>
          </h1>
        </div>
        <div className="ea-screen-header-right">
          <Link to="/workflows/queue" className="ea-btn ea-btn--ghost ea-btn--sm">
            ← Back to queue
          </Link>
        </div>
      </header>

      {data.issues.length === 0 ? (
        <EmptyBlock title="Nothing to flag" testId="validation-empty">
          The validator has no open findings on this run.
        </EmptyBlock>
      ) : (
        <div className="ea-validation-sections">
          <Section title="Errors" tone="error"
                    issues={bySeverity.ERROR} testIdPrefix="validation-error" />
          <Section title="Warnings" tone="warning"
                    issues={bySeverity.WARNING} testIdPrefix="validation-warning" />
          <Section title="Info" tone="info"
                    issues={bySeverity.INFO} testIdPrefix="validation-info" />
        </div>
      )}
    </div>
  );
}

function Section({ title, tone, issues, testIdPrefix }: {
    title: string;
    tone: 'error' | 'warning' | 'info';
    issues: edgeApi.ValidationIssue[];
    testIdPrefix: string;
}): JSX.Element | null {
  if (issues.length === 0) return null;
  return (
    <section className={`ea-validation-section ea-validation-section--${tone}`}
              data-test={`${testIdPrefix}-section`}>
      <h2>{title} ({issues.length})</h2>
      <ul>
        {issues.map((i) => (
          <li key={i.issueId} data-test={`${testIdPrefix}-${i.code.toLowerCase()}`}>
            <strong className="ea-mono" style={{ fontSize: 12 }}>{i.code}</strong>
            <span style={{ marginLeft: 8 }}>{i.message}</span>
            {i.fieldRef && (
              <span className="ea-text-muted" style={{ marginLeft: 8, fontSize: 12 }}>
                (field {i.fieldRef})
              </span>
            )}
            {i.suggestedValue != null && (
              <span className="ea-mono" style={{ marginLeft: 8, fontSize: 11,
                                                   color: '#2a7998' }}
                     data-test={`${testIdPrefix}-${i.code.toLowerCase()}-value`}>
                → {i.suggestedValue}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
