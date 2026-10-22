import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, type RenderResult } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthContext';
import type * as edgeApi from '../api/edgeApi';

/**
 * Admin-ui test harness. Mirrors the client's helper but without
 * `@dhis2/app-runtime`'s CustomDataProvider — admin-ui's EA screens use
 * `edgeApi` directly, not the DHIS2 Data Engine.
 */
export interface RenderOptions {
  readonly route?: string;
  readonly authApi?: Pick<typeof edgeApi, 'session' | 'signIn' | 'signOut'>;
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions = {},
): RenderResult {
  const route = options.route ?? '/';
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider api={options.authApi}>{children}</AuthProvider>
    </MemoryRouter>
  );
  return render(ui, { wrapper });
}
