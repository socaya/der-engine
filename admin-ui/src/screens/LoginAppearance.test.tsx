import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginAppearance } from './LoginAppearance';
import * as edgeApi from '../api/edgeApi';
import { renderWithProviders } from '../test/renderWithProviders';

const EMPTY: edgeApi.SignInSettings = {
  layout: null, appTitle: null, appIntro: null, submitLabel: null,
  footerHtml: null, hasBackground: false, backgroundUrl: null,
  backgroundEtag: null,
};

describe('LoginAppearance', () => {
  beforeEach(() => {
    vi.spyOn(edgeApi, 'readSignInSettings').mockResolvedValue(EMPTY);
    vi.spyOn(edgeApi, 'updateSignInSettings').mockResolvedValue(EMPTY);
    vi.spyOn(edgeApi, 'uploadSignInBackground').mockResolvedValue(EMPTY);
    vi.spyOn(edgeApi, 'clearSignInBackground').mockResolvedValue(EMPTY);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('loads current settings on mount', async () => {
    const seeded: edgeApi.SignInSettings = {
      ...EMPTY, appTitle: 'My clinic', appIntro: 'Welcome',
      submitLabel: 'Enter', layout: 'hero',
    };
    vi.spyOn(edgeApi, 'readSignInSettings').mockResolvedValue(seeded);
    renderWithProviders(<LoginAppearance />);
    await waitFor(() => {
      const t = screen.getByTestId('app-title') as HTMLInputElement;
      expect(t.value).toBe('My clinic');
    });
    expect((screen.getByTestId('layout-select') as HTMLSelectElement).value).toBe('hero');
  });

  it('sends only non-blank fields on save', async () => {
    const spy = vi.spyOn(edgeApi, 'updateSignInSettings').mockResolvedValue(EMPTY);
    renderWithProviders(<LoginAppearance />);
    await waitFor(() => expect(screen.getByTestId('save-btn')).toBeInTheDocument());
    await userEvent.type(screen.getByTestId('app-title'), 'Hello');
    await userEvent.click(screen.getByTestId('save-btn'));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith({
      layout: null,
      appTitle: 'Hello',
      appIntro: null,
      submitLabel: null,
      footerHtml: null,
    });
  });

  it('sends the selected layout', async () => {
    const spy = vi.spyOn(edgeApi, 'updateSignInSettings').mockResolvedValue(EMPTY);
    renderWithProviders(<LoginAppearance />);
    await waitFor(() => expect(screen.getByTestId('save-btn')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByTestId('layout-select'), 'marketing');
    await userEvent.click(screen.getByTestId('save-btn'));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy.mock.calls[0][0].layout).toBe('marketing');
  });

  it('shows a success notice after save', async () => {
    renderWithProviders(<LoginAppearance />);
    await waitFor(() => expect(screen.getByTestId('save-btn')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('save-btn'));
    await waitFor(() => expect(screen.getByTestId('login-appearance-msg')).toBeInTheDocument());
    expect(screen.getByTestId('login-appearance-msg').className).toMatch(/ok/);
  });

  it('shows an error notice when save fails', async () => {
    vi.spyOn(edgeApi, 'updateSignInSettings').mockRejectedValue(new Error('boom'));
    renderWithProviders(<LoginAppearance />);
    await waitFor(() => expect(screen.getByTestId('save-btn')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('save-btn'));
    await waitFor(() => expect(screen.getByText(/boom/i)).toBeInTheDocument());
  });

  it('uploads the chosen file via POST multipart', async () => {
    const upload = vi.spyOn(edgeApi, 'uploadSignInBackground')
      .mockResolvedValue({ ...EMPTY, hasBackground: true,
        backgroundUrl: '/x', backgroundEtag: 'a' });
    renderWithProviders(<LoginAppearance />);
    await waitFor(() => expect(screen.getByTestId('bg-file')).toBeInTheDocument());
    const file = new File(['hi'], 'bg.png', { type: 'image/png' });
    const input = screen.getByTestId('bg-file') as HTMLInputElement;
    await userEvent.upload(input, file);
    await waitFor(() => expect(upload).toHaveBeenCalledWith(file));
  });

  it('renders the current background image when one is set', async () => {
    vi.spyOn(edgeApi, 'readSignInSettings').mockResolvedValue({
      ...EMPTY, hasBackground: true, backgroundUrl: '/x.png', backgroundEtag: 'abc',
    });
    renderWithProviders(<LoginAppearance />);
    await waitFor(() => {
      const img = screen.getByTestId('current-bg') as HTMLImageElement;
      expect(img.src).toContain('/x.png');
    });
  });

  it('clears the background via DELETE', async () => {
    vi.spyOn(edgeApi, 'readSignInSettings').mockResolvedValue({
      ...EMPTY, hasBackground: true, backgroundUrl: '/x.png', backgroundEtag: 'abc',
    });
    const clear = vi.spyOn(edgeApi, 'clearSignInBackground').mockResolvedValue(EMPTY);
    renderWithProviders(<LoginAppearance />);
    await waitFor(() => expect(screen.getByTestId('clear-bg-btn')).not.toBeDisabled());
    await userEvent.click(screen.getByTestId('clear-bg-btn'));
    await waitFor(() => expect(clear).toHaveBeenCalled());
  });

  it('shows an error when upload fails', async () => {
    vi.spyOn(edgeApi, 'uploadSignInBackground').mockRejectedValue(new Error('too big'));
    renderWithProviders(<LoginAppearance />);
    await waitFor(() => expect(screen.getByTestId('bg-file')).toBeInTheDocument());
    const file = new File(['hi'], 'bg.png', { type: 'image/png' });
    await userEvent.upload(screen.getByTestId('bg-file') as HTMLInputElement, file);
    await waitFor(() => expect(screen.getByText(/too big/i)).toBeInTheDocument());
  });

  it('shows an error when clear fails', async () => {
    vi.spyOn(edgeApi, 'readSignInSettings').mockResolvedValue({
      ...EMPTY, hasBackground: true, backgroundUrl: '/x.png', backgroundEtag: 'abc',
    });
    vi.spyOn(edgeApi, 'clearSignInBackground').mockRejectedValue(new Error('down'));
    renderWithProviders(<LoginAppearance />);
    await waitFor(() => expect(screen.getByTestId('clear-bg-btn')).not.toBeDisabled());
    await userEvent.click(screen.getByTestId('clear-bg-btn'));
    await waitFor(() => expect(screen.getByText(/down/i)).toBeInTheDocument());
  });

  it('shows an error when initial load fails', async () => {
    vi.spyOn(edgeApi, 'readSignInSettings').mockRejectedValue(new Error('offline'));
    renderWithProviders(<LoginAppearance />);
    await waitFor(() => expect(screen.getByText(/offline/i)).toBeInTheDocument());
  });

  it('renders the live preview iframe pointing at /sign-in', async () => {
    renderWithProviders(<LoginAppearance />);
    await waitFor(() => {
      const f = screen.getByTestId('login-preview') as HTMLIFrameElement;
      expect(f.src).toContain('/sign-in');
    });
  });
});
