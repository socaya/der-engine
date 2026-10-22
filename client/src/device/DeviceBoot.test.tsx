import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CustomDataProvider } from '@dhis2/app-runtime';
import { AuthProvider } from '../auth/AuthContext';
import { EdgeApiError } from '../api/edgeApi';
import { DeviceBoot } from './DeviceBoot';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function wrap(ui: React.ReactElement,
    authApi: Parameters<typeof AuthProvider>[0]['api']): JSX.Element {
  return (
    <MemoryRouter initialEntries={['/']}>
      <CustomDataProvider data={{} as never}>
        <AuthProvider api={authApi}>{ui}</AuthProvider>
      </CustomDataProvider>
    </MemoryRouter>
  );
}

describe('DeviceBoot', () => {
  it('renders nothing when the session is anonymous', () => {
    render(wrap(<DeviceBoot />, {
      session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
      signIn: vi.fn(), signOut: vi.fn(),
    }));
    expect(screen.queryByTestId('device-banner')).toBeNull();
  });

  it('renders the PENDING banner', async () => {
    // Pre-populate the storage layer so the stored-status fallback is enough
    // (the actual enrol call fails without a mock, which is fine — swallowed).
    window.localStorage.setItem('der_device_id', '11111111-1111-1111-1111-111111111111');
    window.localStorage.setItem('der_device_status', 'PENDING');
    render(wrap(<DeviceBoot />, {
      session: vi.fn().mockResolvedValue({
        userId: 'u', username: 'a', displayName: 'A', roles: ['OPERATOR'], expiresAt: 'x',
      }),
      signIn: vi.fn(), signOut: vi.fn(),
    }));
    await waitFor(() => expect(screen.getByTestId('device-banner')).toBeInTheDocument());
    expect(screen.getByTestId('device-banner-status')).toHaveTextContent('PENDING');
  });

  it('renders nothing when the device is APPROVED', async () => {
    window.localStorage.setItem('der_device_id', '11111111-1111-1111-1111-111111111111');
    window.localStorage.setItem('der_device_status', 'APPROVED');
    render(wrap(<DeviceBoot />, {
      session: vi.fn().mockResolvedValue({
        userId: 'u', username: 'a', displayName: 'A', roles: ['OPERATOR'], expiresAt: 'x',
      }),
      signIn: vi.fn(), signOut: vi.fn(),
    }));
    await waitFor(() => expect(screen.queryByTestId('device-banner')).toBeNull());
  });

  it('renders the SUSPENDED copy', async () => {
    window.localStorage.setItem('der_device_id', '11111111-1111-1111-1111-111111111111');
    window.localStorage.setItem('der_device_status', 'SUSPENDED');
    render(wrap(<DeviceBoot />, {
      session: vi.fn().mockResolvedValue({
        userId: 'u', username: 'a', displayName: 'A', roles: ['OPERATOR'], expiresAt: 'x',
      }),
      signIn: vi.fn(), signOut: vi.fn(),
    }));
    await waitFor(() => expect(screen.getByText(/suspended by an admin/i)).toBeInTheDocument());
  });

  it('renders the REVOKED copy', async () => {
    window.localStorage.setItem('der_device_id', '11111111-1111-1111-1111-111111111111');
    window.localStorage.setItem('der_device_status', 'REVOKED');
    render(wrap(<DeviceBoot />, {
      session: vi.fn().mockResolvedValue({
        userId: 'u', username: 'a', displayName: 'A', roles: ['OPERATOR'], expiresAt: 'x',
      }),
      signIn: vi.fn(), signOut: vi.fn(),
    }));
    await waitFor(() => expect(screen.getByText(/revoked; contact an admin/i)).toBeInTheDocument());
  });
});
