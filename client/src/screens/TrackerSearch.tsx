import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@dhis2/ui';
import { EmptyBlock, ErrorBlock, LoadingBlock, OfflineBanner } from '../components/ScreenStates';

export interface TrackerSearchProps {
  readonly search?: (program: string, orgUnit: string, attribute: string) =>
    Promise<readonly { tei: string; display: string }[]>;
}

/** DC-11 — tracker TEI search. Minimum viable: search by attribute UID + value. */
export function TrackerSearch({ search }: TrackerSearchProps = {}): JSX.Element {
  const { program = '' } = useParams();
  const [orgUnit, setOrgUnit] = useState('');
  const [attribute, setAttribute] = useState('');
  const [rows, setRows] = useState<readonly { tei: string; display: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function doSearch(): Promise<void> {
    setLoading(true); setError(null); setRows(null);
    const impl = search ?? (() => Promise.resolve([] as const));
    try {
      const results = await impl(program, orgUnit, attribute);
      setRows(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="der-tracker-search">
      <h1 data-test="tracker-search-heading">Tracker search — {program}</h1>
      <OfflineBanner testId="tracker-search-offline" />
      <label className="der-field"><span>Organisation unit UID</span><input data-test="tracker-search-orgunit" value={orgUnit} onChange={(e) => { setOrgUnit(e.target.value) }} /></label>
      <label className="der-field"><span>Attribute term (optional)</span><input data-test="tracker-search-attribute" value={attribute} onChange={(e) => { setAttribute(e.target.value) }} /></label>
      <Button dataTest="tracker-search-submit"
              onClick={() => { doSearch().catch(() => undefined); }}
              disabled={!orgUnit}>
        Search
      </Button>
      <Link to={`/tracker/${program}/enroll`} data-test="tracker-search-enroll">
        Enrol new TEI
      </Link>
      {loading && <LoadingBlock testId="tracker-search-loading" />}
      {error && <ErrorBlock title="Tracker search failed" testId="tracker-search-error">{error}</ErrorBlock>}
      {rows !== null && rows.length === 0 && !error && (
        <EmptyBlock title="No results" testId="tracker-search-empty">
          No tracked entities match locally. Try fewer terms or enrol a new TEI.
        </EmptyBlock>
      )}
      {rows !== null && rows.length > 0 && (
        <ul data-test="tracker-search-results">
          {rows.map((r) => (
            <li key={r.tei}>
              <Link to={`/tracker/${program}/tei/${r.tei}`} data-test={`tracker-tei-${r.tei}`}>
                {r.display}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
