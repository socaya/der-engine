import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetadataPicker } from './MetadataPicker';
import * as edgeApi from '../api/edgeApi';

/* MetadataPicker lazy-loads a resource list from the local mirror on
 * first focus, caches it, filters by id or displayName, and offers
 * a plain-text UID fallback when the mirror call fails or is empty. */

function item(id: string, name = `Name ${id}`): edgeApi.MetadataListItem {
  return { id, displayName: name } as unknown as edgeApi.MetadataListItem;
}

describe('MetadataPicker', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders closed with the placeholder derived from resource', () => {
    render(<MetadataPicker resource="dataSets" value=""
             onChange={() => undefined} dataTest="dp" />);
    const input = screen.getByTestId('dp') as HTMLInputElement;
    expect(input.placeholder).toBe('Search dataSets…');
  });

  it('first focus lazy-loads the mirror + opens the dropdown', async () => {
    vi.spyOn(edgeApi, 'metadataList').mockResolvedValue({
      resource: 'dataSets',
      dataSets: [item('ds-1'), item('ds-2', 'Monthly report')],
      serverTotal: 2,
    } as never);
    render(<MetadataPicker resource="dataSets" value=""
             onChange={() => undefined} dataTest="dp" />);
    fireEvent.focus(screen.getByTestId('dp'));
    await waitFor(() =>
      expect(screen.getByText('Monthly report')).toBeInTheDocument());
    expect(screen.getByText('ds-1')).toBeInTheDocument();
  });

  it('typing filters by id or displayName and surfaces "No matches."', async () => {
    vi.spyOn(edgeApi, 'metadataList').mockResolvedValue({
      resource: 'dataSets',
      dataSets: [item('ABC'), item('XYZ')],
      serverTotal: 2,
    } as never);
    render(<MetadataPicker resource="dataSets" value=""
             onChange={() => undefined} dataTest="dp" />);
    const input = screen.getByTestId('dp') as HTMLInputElement;
    fireEvent.focus(input);
    await waitFor(() =>
      expect(screen.getByText('Name ABC')).toBeInTheDocument());
    fireEvent.change(input, { target: { value: 'abc' } });
    await waitFor(() =>
      expect(screen.queryByText('Name XYZ')).toBeNull());
    expect(screen.getByText('Name ABC')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'nomatch' } });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/No matches\./));
  });

  it('clicking a row fires onChange + closes the dropdown', async () => {
    vi.spyOn(edgeApi, 'metadataList').mockResolvedValue({
      resource: 'dataElements',
      dataElements: [item('DE-1', 'Weight')],
      serverTotal: 1,
    } as never);
    const onChange = vi.fn();
    render(<MetadataPicker resource="dataElements" value=""
             onChange={onChange} dataTest="dp" />);
    const input = screen.getByTestId('dp');
    fireEvent.focus(input);
    await waitFor(() =>
      expect(screen.getByText('Weight')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByText('Weight'));
    expect(onChange).toHaveBeenCalledWith('DE-1');
  });

  it('selected value renders the resolved displayName sub-label when closed', async () => {
    vi.spyOn(edgeApi, 'metadataList').mockResolvedValue({
      resource: 'programs',
      programs: [item('prog-1', 'Immunization')],
      serverTotal: 1,
    } as never);
    render(<MetadataPicker resource="programs" value="prog-1"
             onChange={() => undefined} dataTest="dp" />);
    const input = screen.getByTestId('dp') as HTMLInputElement;
    fireEvent.focus(input);
    await waitFor(() =>
      expect(screen.getByText('Immunization')).toBeInTheDocument());
    fireEvent.blur(input);
    await new Promise((r) => setTimeout(r, 200));
    /* After close, selectedName sub-label is still visible. */
    expect(screen.getByText('Immunization')).toBeInTheDocument();
  });

  it('empty mirror surfaces "Nothing in the local mirror yet."', async () => {
    vi.spyOn(edgeApi, 'metadataList').mockResolvedValue({
      resource: 'dataSets', dataSets: [], serverTotal: 0,
    } as never);
    render(<MetadataPicker resource="dataSets" value=""
             onChange={() => undefined} dataTest="dp" />);
    fireEvent.focus(screen.getByTestId('dp'));
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/Nothing in the local mirror yet\./));
  });

  it('metadataList rejection renders the error branch', async () => {
    vi.spyOn(edgeApi, 'metadataList').mockRejectedValue(
      new Error('mirror cold'));
    render(<MetadataPicker resource="dataSets" value=""
             onChange={() => undefined} dataTest="dp" />);
    fireEvent.focus(screen.getByTestId('dp'));
    await waitFor(() =>
      expect(screen.getByText(/mirror cold/)).toBeInTheDocument());
    /* "paste a UID directly" footer appears alongside the error. */
    expect(screen.getByText(/paste a UID directly/)).toBeInTheDocument();
  });

  it('resource field with non-array response → items set to []', async () => {
    vi.spyOn(edgeApi, 'metadataList').mockResolvedValue({
      resource: 'dataSets',
      /* Intentionally not an array — exercises the "else setItems([])" arm. */
      dataSets: undefined,
      serverTotal: 0,
    } as never);
    render(<MetadataPicker resource="dataSets" value=""
             onChange={() => undefined} dataTest="dp" />);
    fireEvent.focus(screen.getByTestId('dp'));
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/Nothing in the local mirror yet\./));
  });

  it('disabled prop prevents the input from accepting focus', () => {
    render(<MetadataPicker resource="dataSets" value=""
             onChange={() => undefined} dataTest="dp" disabled />);
    expect((screen.getByTestId('dp') as HTMLInputElement).disabled).toBe(true);
  });

  it('custom placeholder overrides the resource default', () => {
    render(<MetadataPicker resource="dataSets" value=""
             onChange={() => undefined} dataTest="dp"
             placeholder="Choose a dataset" />);
    const input = screen.getByTestId('dp') as HTMLInputElement;
    expect(input.placeholder).toBe('Choose a dataset');
  });
});
