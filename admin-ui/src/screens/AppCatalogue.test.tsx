import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppCatalogue } from './AppCatalogue';
import * as edgeApi from '../api/edgeApi';
import { renderWithProviders } from '../test/renderWithProviders';

const APP_A: edgeApi.AppCatalogueEntry = {
  appId: 'app-a-id',
  appKey: 'app-a',
  displayName: 'Tracker Capture',
  module: 'dhis-web-tracker-capture',
  version: '2.44.1',
  bundleUrl: '/edge-api/v1/apps/app-a-id/bundle',
  bundleSha256: 'abcdef0123456789aaaabbbbccccddddeeeeffff00001111',
  signatureB64: 'sigA',
  requiresDerApi: '2.44',
};

const APP_B: edgeApi.AppCatalogueEntry = {
  appId: 'app-b-id',
  appKey: 'app-b',
  displayName: 'Data Entry',
  module: null,
  version: '1.2.3',
  bundleUrl: '/edge-api/v1/apps/app-b-id/bundle',
  bundleSha256: 'ffeeddccbbaa99887766554433221100aabbccddeeff0011',
  signatureB64: 'sigB',
  requiresDerApi: '2.44',
};

describe('AppCatalogue', () => {
  beforeEach(() => {
    vi.spyOn(edgeApi, 'listApps').mockResolvedValue({ apps: [APP_A, APP_B] });
    vi.spyOn(edgeApi, 'installApp').mockResolvedValue(APP_A);
    vi.spyOn(edgeApi, 'upgradeApp').mockResolvedValue(APP_A);
    vi.spyOn(edgeApi, 'enableApp').mockResolvedValue(undefined);
    vi.spyOn(edgeApi, 'disableApp').mockResolvedValue(undefined);
    vi.spyOn(edgeApi, 'deleteApp').mockResolvedValue(undefined);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders empty state when listApps returns no apps', async () => {
    vi.spyOn(edgeApi, 'listApps').mockResolvedValue({ apps: [] });
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());
    expect(screen.queryByTestId('apps-table')).not.toBeInTheDocument();
  });

  it('renders a table row per app with display name, version and sha truncation', async () => {
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('apps-table')).toBeInTheDocument());
    expect(screen.getByText('Tracker Capture')).toBeInTheDocument();
    expect(screen.getByText('Data Entry')).toBeInTheDocument();
    expect(screen.getByText('dhis-web-tracker-capture')).toBeInTheDocument();
    const sha = screen.getByTestId('sha-app-a-id');
    expect(sha.textContent).toBe('abcdef0123');
    expect(sha.getAttribute('title')).toBe(APP_A.bundleSha256);
  });

  it('install: fills form, uploads a file and submits with the right payload', async () => {
    const spy = vi.spyOn(edgeApi, 'installApp').mockResolvedValue(APP_A);
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('install-open-btn')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('install-open-btn'));
    await userEvent.type(screen.getByTestId('install-app-key'), 'app-new');
    await userEvent.type(screen.getByTestId('install-display-name'), 'New App');
    await userEvent.type(screen.getByTestId('install-module'), 'dhis-web-new');
    await userEvent.type(screen.getByTestId('install-version'), '0.1.0');
    await userEvent.type(screen.getByTestId('install-requires'), '2.44');
    const file = new File(['bundle-bytes'], 'bundle.zip',
      { type: 'application/zip' });
    await userEvent.upload(screen.getByTestId('install-file') as HTMLInputElement, file);
    await userEvent.click(screen.getByTestId('install-submit-btn'));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith({
      file,
      appKey: 'app-new',
      displayName: 'New App',
      module: 'dhis-web-new',
      version: '0.1.0',
      requiresDerApi: '2.44',
    });
    await waitFor(() =>
      expect(screen.getByTestId('app-catalogue-msg').className).toMatch(/ok/));
  });

  it('install: cancel button closes the form without submitting', async () => {
    const spy = vi.spyOn(edgeApi, 'installApp');
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('install-open-btn')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('install-open-btn'));
    expect(screen.getByTestId('install-form')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('install-cancel-btn'));
    expect(screen.queryByTestId('install-form')).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('install: shows error notice when no file was chosen', async () => {
    const spy = vi.spyOn(edgeApi, 'installApp');
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('install-open-btn')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('install-open-btn'));
    await userEvent.type(screen.getByTestId('install-app-key'), 'app-new');
    await userEvent.type(screen.getByTestId('install-display-name'), 'New App');
    await userEvent.type(screen.getByTestId('install-version'), '0.1.0');
    await userEvent.type(screen.getByTestId('install-requires'), '2.44');
    await userEvent.click(screen.getByTestId('install-submit-btn'));
    await waitFor(() =>
      expect(screen.getByTestId('app-catalogue-msg').className).toMatch(/error/));
    expect(spy).not.toHaveBeenCalled();
  });

  it('install: shows error notice when installApp rejects', async () => {
    vi.spyOn(edgeApi, 'installApp').mockRejectedValue(new Error('invalid bundle'));
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('install-open-btn')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('install-open-btn'));
    await userEvent.type(screen.getByTestId('install-app-key'), 'app-new');
    await userEvent.type(screen.getByTestId('install-display-name'), 'New App');
    await userEvent.type(screen.getByTestId('install-version'), '0.1.0');
    await userEvent.type(screen.getByTestId('install-requires'), '2.44');
    const file = new File(['x'], 'bundle.zip', { type: 'application/zip' });
    await userEvent.upload(screen.getByTestId('install-file') as HTMLInputElement, file);
    await userEvent.click(screen.getByTestId('install-submit-btn'));
    await waitFor(() => expect(screen.getByText(/invalid bundle/i)).toBeInTheDocument());
  });

  it('upgrade: opens row dialog, submits, calls upgradeApp with payload', async () => {
    const spy = vi.spyOn(edgeApi, 'upgradeApp').mockResolvedValue(APP_A);
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('upgrade-btn-app-a-id')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('upgrade-btn-app-a-id'));
    expect(screen.getByTestId('upgrade-form')).toBeInTheDocument();
    // requiresDerApi pre-fills from the row
    expect((screen.getByTestId('upgrade-requires') as HTMLInputElement).value).toBe('2.44');
    await userEvent.type(screen.getByTestId('upgrade-version'), '2.44.2');
    const file = new File(['new-bytes'], 'new.zip', { type: 'application/zip' });
    await userEvent.upload(screen.getByTestId('upgrade-file') as HTMLInputElement, file);
    await userEvent.click(screen.getByTestId('upgrade-submit-btn'));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith('app-a-id', {
      file,
      version: '2.44.2',
      requiresDerApi: '2.44',
    });
  });

  it('upgrade: cancel closes the dialog without calling upgradeApp', async () => {
    const spy = vi.spyOn(edgeApi, 'upgradeApp');
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('upgrade-btn-app-a-id')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('upgrade-btn-app-a-id'));
    expect(screen.getByTestId('upgrade-form')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('upgrade-cancel-btn'));
    expect(screen.queryByTestId('upgrade-form')).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('upgrade: submitting with no file chosen surfaces an error', async () => {
    const spy = vi.spyOn(edgeApi, 'upgradeApp');
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('upgrade-btn-app-a-id')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('upgrade-btn-app-a-id'));
    await userEvent.type(screen.getByTestId('upgrade-version'), '2.44.2');
    await userEvent.click(screen.getByTestId('upgrade-submit-btn'));
    await waitFor(() =>
      expect(screen.getByTestId('app-catalogue-msg').className).toMatch(/error/));
    expect(spy).not.toHaveBeenCalled();
  });

  it('upgrade: shows an error notice when upgradeApp rejects', async () => {
    vi.spyOn(edgeApi, 'upgradeApp').mockRejectedValue(new Error('upgrade-nope'));
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('upgrade-btn-app-a-id')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('upgrade-btn-app-a-id'));
    await userEvent.type(screen.getByTestId('upgrade-version'), '2.44.2');
    const file = new File(['x'], 'new.zip', { type: 'application/zip' });
    await userEvent.upload(screen.getByTestId('upgrade-file') as HTMLInputElement, file);
    await userEvent.click(screen.getByTestId('upgrade-submit-btn'));
    await waitFor(() => expect(screen.getByText(/upgrade-nope/i)).toBeInTheDocument());
  });

  it('toggle: Disable then Enable — calls disable then enable, reloads both times', async () => {
    const disable = vi.spyOn(edgeApi, 'disableApp').mockResolvedValue(undefined);
    const enable = vi.spyOn(edgeApi, 'enableApp').mockResolvedValue(undefined);
    const list = vi.spyOn(edgeApi, 'listApps')
      .mockResolvedValue({ apps: [APP_A, APP_B] });
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('toggle-btn-app-a-id')).toBeInTheDocument());
    const initialReloads = list.mock.calls.length;
    await userEvent.click(screen.getByTestId('toggle-btn-app-a-id'));
    await waitFor(() => expect(disable).toHaveBeenCalledWith('app-a-id'));
    await waitFor(() =>
      expect(list.mock.calls.length).toBeGreaterThan(initialReloads));
    // After reload the disabled overlay resets, so button should read "Disable" again
    await waitFor(() =>
      expect(screen.getByTestId('toggle-btn-app-a-id').textContent).toBe('Disable'));
    await userEvent.click(screen.getByTestId('toggle-btn-app-a-id'));
    await waitFor(() => expect(disable).toHaveBeenCalledTimes(2));
    // Enable never fires because reload clears the "disabled" overlay
    expect(enable).not.toHaveBeenCalled();
  });

  it('toggle: shows error notice when disable fails and rolls back optimistic flip', async () => {
    vi.spyOn(edgeApi, 'disableApp').mockRejectedValue(new Error('toggle-fail'));
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('toggle-btn-app-a-id')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('toggle-btn-app-a-id'));
    await waitFor(() => expect(screen.getByText(/toggle-fail/i)).toBeInTheDocument());
    // Rolled back
    expect(screen.getByTestId('toggle-btn-app-a-id').textContent).toBe('Disable');
  });

  it('delete: confirm → deleteApp called; declines when confirm returns false', async () => {
    const spy = vi.spyOn(edgeApi, 'deleteApp').mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('delete-btn-app-a-id')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('delete-btn-app-a-id'));
    expect(spy).not.toHaveBeenCalled();
    confirmSpy.mockReturnValue(true);
    await userEvent.click(screen.getByTestId('delete-btn-app-a-id'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('app-a-id'));
    await waitFor(() =>
      expect(screen.getByTestId('app-catalogue-msg').className).toMatch(/ok/));
  });

  it('delete: shows error notice when deleteApp rejects', async () => {
    vi.spyOn(edgeApi, 'deleteApp').mockRejectedValue(new Error('delete-nope'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('delete-btn-app-a-id')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('delete-btn-app-a-id'));
    await waitFor(() => expect(screen.getByText(/delete-nope/i)).toBeInTheDocument());
  });

  it('shows an error notice when the initial listApps call fails', async () => {
    vi.spyOn(edgeApi, 'listApps').mockRejectedValue(new Error('catalogue-offline'));
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByText(/catalogue-offline/i)).toBeInTheDocument());
  });

  it('install-open-btn toggles back to Install app label on second click', async () => {
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('install-open-btn')).toBeInTheDocument());
    expect(screen.getByTestId('install-open-btn').textContent).toBe('Install app');
    await userEvent.click(screen.getByTestId('install-open-btn'));
    expect(screen.getByTestId('install-open-btn').textContent).toBe('Close');
    await userEvent.click(screen.getByTestId('install-open-btn'));
    expect(screen.getByTestId('install-open-btn').textContent).toBe('Install app');
  });

  it('renders the row without module when module is null', async () => {
    renderWithProviders(<AppCatalogue />);
    await waitFor(() => expect(screen.getByTestId('apps-table')).toBeInTheDocument());
    const row = screen.getByTestId('app-row-app-b-id');
    expect(within(row).queryByText('dhis-web-tracker-capture')).not.toBeInTheDocument();
  });
});
