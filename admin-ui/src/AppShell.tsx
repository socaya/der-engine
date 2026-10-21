import type { ReactNode } from 'react';

export interface ShellProps {
  readonly app: 'admin-ui' | 'client';
  readonly brand: string;
  readonly heading: string;
  readonly subheading: string;
  readonly navigation: readonly string[];
  readonly version: string;
  readonly dhis2ReferenceVersion: string;
  readonly children?: ReactNode;
}

/**
 * Reusable shell used by both `admin-ui` and `client` applications so a single
 * component owns the Phase 00 contract: honest status disclosure, navigation
 * landmarks, version banner, and no false claims of sync/compat state.
 *
 * Every acceptance-critical label is a `data-testid` so Playwright and Vitest
 * can assert without colour-coupling.
 */
export function AppShell(props: ShellProps): JSX.Element {
  const { brand, heading, subheading, navigation, version, dhis2ReferenceVersion, app, children } = props;

  return (
    <div className="shell" data-der-app={app}>
      <aside aria-label="Primary navigation">
        <div className="brand" data-testid="brand">
          {brand}
        </div>
        <nav aria-label="Main navigation">
          <ul className="nav-list">
            {navigation.map((item) => (
              <li className="nav-item" key={item}>
                <button type="button" data-testid={`nav-${item}`}>
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main>
        <header>
          <h1 data-testid="heading">{heading}</h1>
          <p data-testid="subheading">{subheading}</p>
        </header>
        <section className="notice" aria-labelledby="status-heading">
          <h2 id="status-heading">Implementation status</h2>
          <p>
            This is a runnable Phase 00 interface shell. DHIS2 workflow execution, authentication, durable
            change capture and central synchronisation are <strong>not</strong> implemented at this release.
          </p>
          <p>
            Pinned DHIS2 reference: <code data-testid="dhis2-reference">{dhis2ReferenceVersion}</code>. The
            version pin is decided in Phase 01; shown as <code>unknown</code> until then.
          </p>
        </section>
        {children}
        <footer className="build-banner" data-testid="build-banner">
          DER <span data-testid="der-version">{version}</span>
        </footer>
      </main>
    </div>
  );
}
