import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetadataBrowser } from './MetadataBrowser';
import { renderWithProviders } from '../test/renderWithProviders';

const samplePage = {
  pager: { page: 1, pageSize: 25, total: 2, pageCount: 1 },
  organisationUnits: [
    { id: 'ou1', displayName: 'OU One', level: 2 },
    { id: 'ou2', name: 'OU Two (fallback)' },
  ],
};

describe('MetadataBrowser', () => {
  it('renders rows from the DER mirror', async () => {
    renderWithProviders(
      <MetadataBrowser
        resource="organisationUnits"
        title="Organisation units"
        extraColumns={[{ header: 'Level', field: 'level' }]}
      />,
      { dataProviderData: { organisationUnits: () => samplePage } },
    );
    await waitFor(() => expect(screen.getByTestId('browser-organisationUnits-heading')).toBeInTheDocument());
    expect(screen.getByTestId('browser-row-ou1')).toBeInTheDocument();
    expect(screen.getByText('OU One')).toBeInTheDocument();
    expect(screen.getByText('OU Two (fallback)')).toBeInTheDocument();
    // Each row renders a Locally committed sync-status pill.
    expect(screen.getAllByText(/Locally committed/).length).toBeGreaterThanOrEqual(2);
  });

  it('renders the empty-state row when the server returns no items', async () => {
    renderWithProviders(
      <MetadataBrowser resource="dataSets" title="Data sets" />,
      { dataProviderData: { dataSets: () => ({ pager: { page: 1, pageSize: 25, total: 0, pageCount: 0 }, dataSets: [] }) } },
    );
    await waitFor(() => expect(screen.getByText(/No rows\./)).toBeInTheDocument());
  });

  it('renders an error when the Data Engine rejects', async () => {
    renderWithProviders(
      <MetadataBrowser resource="programs" title="Programs" />,
      {
        dataProviderData: {
          programs: () => {
            throw new Error('data engine exploded');
          },
        },
      },
    );
    await waitFor(() => expect(screen.getByTestId('browser-error')).toBeInTheDocument());
  });
});
