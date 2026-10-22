import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CustomDataProvider } from '@dhis2/app-runtime';
import { render, type RenderResult } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthContext';
import type * as edgeApi from '../api/edgeApi';

export interface RenderOptions {
  readonly route?: string;
  readonly dataProviderData?: Record<string, unknown>;
  readonly authApi?: Pick<typeof edgeApi, 'session' | 'signIn' | 'signOut'>;
}

/**
 * Helper that wraps a UI tree in the same providers the real app uses:
 *   MemoryRouter → CustomDataProvider (deterministic responses) → AuthProvider.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions = {},
): RenderResult {
  const data = options.dataProviderData ?? {};
  const route = options.route ?? '/';
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <MemoryRouter initialEntries={[route]}>
      {/* CustomDataProvider typing requires CustomData which is more
          specific than Record<string,unknown>; the cast is safe because
          test fixtures supply the shape the runtime expects. */}
      <CustomDataProvider data={data as never}>
        <AuthProvider api={options.authApi}>{children}</AuthProvider>
      </CustomDataProvider>
    </MemoryRouter>
  );
  return render(ui, { wrapper });
}
