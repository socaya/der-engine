import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SignIn } from './SignIn';
import { AuthProvider } from '../auth/AuthContext';
import * as edgeApi from '../api/edgeApi';
import { EdgeApiError, type SignInResponse } from '../api/edgeApi';

const EMPTY_SETTINGS: edgeApi.SignInSettings = {
  layout: null, appTitle: null, appIntro: null, submitLabel: null,
  footerHtml: null, hasBackground: false, backgroundUrl: null,
  backgroundEtag: null,
};

beforeEach(() => {
  vi.spyOn(edgeApi, 'readSignInSettings').mockResolvedValue(EMPTY_SETTINGS);
});
afterEach(() => { vi.restoreAllMocks(); });

function user(name = 'alice'): SignInResponse {
  return {
    userId: 'u1',
    username: name,
    displayName: name,
    roles: ['ADMIN'],
    expiresAt: '2099-01-01T00:00:00Z',
  };
}

function renderAt(route: string, api: {
  session: () => Promise<SignInResponse>;
  signIn: (u: string, p: string) => Promise<SignInResponse>;
  signOut: () => Promise<void>;
}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider api={api}>
        <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/" element={<div data-test="landed-home">home</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function usernameInput(): HTMLInputElement {
  return screen.getByTestId('sign-in-username-field')
    .querySelector('input') as HTMLInputElement;
}

function passwordInput(): HTMLInputElement {
  return screen.getByTestId('sign-in-password-field')
    .querySelector('input') as HTMLInputElement;
}

function submitButton(): HTMLButtonElement {
  return screen.getByTestId('sign-in-submit')
    .querySelector('button') as HTMLButtonElement;
}

describe('SignIn (Atlaskit)', () => {
  it('renders the sign-in form', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockResolvedValue(user()),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    expect(screen.getByTestId('sign-in-username-field')).toBeInTheDocument();
    expect(screen.getByTestId('sign-in-password-field')).toBeInTheDocument();
    expect(screen.getByTestId('sign-in-submit')).toBeInTheDocument();
    expect(usernameInput()).toBeInTheDocument();
    expect(passwordInput()).toBeInTheDocument();
  });

  it('submits and navigates on success', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockResolvedValue(user()),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    fireEvent.change(usernameInput(), { target: { value: 'alice' } });
    fireEvent.change(passwordInput(), { target: { value: 'password' } });
    fireEvent.click(submitButton());
    await waitFor(() => expect(screen.getByTestId('landed-home')).toBeInTheDocument());
    expect(api.signIn).toHaveBeenCalledWith('alice', 'password');
  });

  it('renders invalid-credentials error', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'bad creds')),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    fireEvent.change(usernameInput(), { target: { value: 'alice' } });
    fireEvent.change(passwordInput(), { target: { value: 'wrong' } });
    fireEvent.click(submitButton());
    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error')).toHaveTextContent(/invalid/i));
  });

  it('surfaces non-EdgeApi failure as generic error', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockRejectedValue(new Error('boom')),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    fireEvent.change(usernameInput(), { target: { value: 'a' } });
    fireEvent.change(passwordInput(), { target: { value: 'p' } });
    fireEvent.click(submitButton());
    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error')).toHaveTextContent(/sign-in failed/i));
  });

  it('surfaces EDGE_UNREACHABLE from signIn', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockRejectedValue(
        new EdgeApiError(0, 'EDGE_UNREACHABLE', 'down')),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    fireEvent.change(usernameInput(), { target: { value: 'a' } });
    fireEvent.change(passwordInput(), { target: { value: 'p' } });
    fireEvent.click(submitButton());
    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error')).toHaveTextContent(/unreachable/i));
  });

  it('EDGE_DOWN state from session probe surfaces the edge-down banner', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(0, 'EDGE_UNREACHABLE', 'down')),
      signIn: vi.fn().mockResolvedValue(user()),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() =>
      expect(screen.getByTestId('sign-in-edge-down'))
        .toBeInTheDocument());
    expect(screen.getByTestId('sign-in-edge-down-inner'))
      .toHaveTextContent(/DER server/);
  });

  it('empty credentials — submit does not navigate when both blank', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockResolvedValue(user()),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() =>
      expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    /* Click submit with empty fields — handler short-circuits without
     * calling signIn. */
    fireEvent.click(submitButton());
    expect(api.signIn).not.toHaveBeenCalled();
  });
});

describe('SignIn — signin-settings wiring', () => {
  const api = () => ({
    session: vi.fn().mockRejectedValue(
      new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
    signIn: vi.fn().mockResolvedValue(user()),
    signOut: vi.fn().mockResolvedValue(undefined),
  });

  it('applies the server-provided title + intro + submit label + footer', async () => {
    vi.spyOn(edgeApi, 'readSignInSettings').mockResolvedValue({
      ...EMPTY_SETTINGS,
      appTitle: 'Nakawa HC-III',
      appIntro: 'Health district signin',
      submitLabel: 'Enter',
      footerHtml: '<a href="mailto:ops@x.org">Contact ops</a>',
    });
    renderAt('/sign-in', api());
    await waitFor(() => expect(screen.getByTestId('sign-in-title'))
      .toHaveTextContent('Nakawa HC-III'));
    expect(screen.getByTestId('sign-in-sub')).toHaveTextContent('Health district signin');
    expect(screen.getByTestId('sign-in-submit-btn')).toHaveTextContent('Enter');
    const footer = screen.getByTestId('sign-in-footer');
    expect(footer.querySelector('a')).not.toBeNull();
  });

  it('falls back to defaults when no settings are set', async () => {
    renderAt('/sign-in', api());
    await waitFor(() => expect(screen.getByTestId('sign-in-title'))
      .toHaveTextContent(/DER Administration/i));
    expect(screen.getByTestId('sign-in-sub')).toHaveTextContent(/administration console/i);
    expect(screen.getByTestId('sign-in-submit-btn')).toHaveTextContent('Sign in');
    expect(screen.queryByTestId('sign-in-footer')).toBeNull();
  });

  it('applies the uploaded background as inline style', async () => {
    vi.spyOn(edgeApi, 'readSignInSettings').mockResolvedValue({
      ...EMPTY_SETTINGS,
      hasBackground: true,
      backgroundUrl: '/edge-api/v1/public/signin-settings/background',
      backgroundEtag: 'abc',
    });
    renderAt('/sign-in', api());
    await waitFor(() => {
      const root = screen.getByTestId('sign-in');
      expect(root.style.backgroundImage).toContain(
        '/edge-api/v1/public/signin-settings/background');
    });
  });

  it('keeps rendering when the settings fetch fails', async () => {
    vi.spyOn(edgeApi, 'readSignInSettings').mockRejectedValue(new Error('offline'));
    renderAt('/sign-in', api());
    await waitFor(() => expect(screen.getByTestId('sign-in-title'))
      .toHaveTextContent(/DER Administration/i));
  });
});
