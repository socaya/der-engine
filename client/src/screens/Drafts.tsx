import { useEffect, useState } from 'react';
import { Button, DataTable, DataTableBody, DataTableCell, DataTableColumnHeader, DataTableHead, DataTableRow } from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import type { DraftRow } from '../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock, OfflineBanner } from '../components/ScreenStates';

export interface DraftsProps {
  readonly api?: Pick<typeof edgeApi, 'listDrafts' | 'deleteDraft'>;
}

/** DC-17 — list the signed-in user's drafts. */
export function Drafts({ api = edgeApi }: DraftsProps = {}): JSX.Element {
  const [drafts, setDrafts] = useState<DraftRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const resp = await api.listDrafts();
      setDrafts(resp.drafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => { reload().catch(() => undefined); }, [api]);

  async function remove(draftId: string): Promise<void> {
    try {
      await api.deleteDraft(draftId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (error) return <ErrorBlock title="Drafts error" testId="drafts-error">{error}</ErrorBlock>;
  if (drafts === null) return <LoadingBlock testId="drafts-loading" />;

  return (
    <div className="der-drafts">
      <h1 data-test="drafts-heading">My drafts</h1>
      <OfflineBanner testId="drafts-offline" />
      {drafts.length === 0 ? (
        <EmptyBlock title="No drafts" testId="drafts-empty">
          Drafts you save while filling in events / enrolments show up here.
        </EmptyBlock>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableColumnHeader>Title</DataTableColumnHeader>
              <DataTableColumnHeader>Kind</DataTableColumnHeader>
              <DataTableColumnHeader>Updated</DataTableColumnHeader>
              <DataTableColumnHeader>Action</DataTableColumnHeader>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {drafts.map((d) => (
              <DataTableRow key={d.draftId}>
                <DataTableCell>
                  <span data-test={`draft-title-${d.draftId}`}>{d.title}</span>
                </DataTableCell>
                <DataTableCell>{d.kind}</DataTableCell>
                <DataTableCell>{d.updatedAt}</DataTableCell>
                <DataTableCell>
                  <Button
                    small
                    destructive
                    dataTest={`draft-delete-${d.draftId}`}
                    onClick={() => { remove(d.draftId).catch(() => undefined); }}
                  >
                    Discard
                  </Button>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </div>
  );
}
