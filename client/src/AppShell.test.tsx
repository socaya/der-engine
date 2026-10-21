import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppShell, type ShellProps } from './AppShell';

const baseProps: ShellProps = {
  app: 'client',
  brand: 'DER Client',
  heading: 'DER Client',
  subheading: 'DHIS2 Edge Runtime • local workflow shell',
  navigation: ['Application launcher', 'Tracker'],
  version: '0.1.0-SNAPSHOT',
  dhis2ReferenceVersion: 'unknown',
};

describe('client AppShell', () => {
  it('renders the brand, heading and subheading', () => {
    render(<AppShell {...baseProps} />);
    expect(screen.getByTestId('brand')).toHaveTextContent('DER Client');
    expect(screen.getByTestId('heading')).toHaveTextContent('DER Client');
    expect(screen.getByTestId('subheading')).toHaveTextContent('DHIS2 Edge Runtime');
  });

  it('exposes a Main navigation landmark with one button per entry', () => {
    render(<AppShell {...baseProps} />);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    for (const label of baseProps.navigation) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('surfaces the version from props', () => {
    render(<AppShell {...baseProps} version="9.9.9" />);
    expect(screen.getByTestId('der-version')).toHaveTextContent('9.9.9');
  });

  it('surfaces the pinned DHIS2 reference version', () => {
    render(<AppShell {...baseProps} dhis2ReferenceVersion="2.43.1" />);
    expect(screen.getByTestId('dhis2-reference')).toHaveTextContent('2.43.1');
  });

  it('never claims "Synchronised" at Phase 00', () => {
    render(<AppShell {...baseProps} />);
    expect(screen.queryByText(/synchronised/i)).toBeNull();
  });

  it('tags the shell with the application identity for e2e locators', () => {
    const { container } = render(<AppShell {...baseProps} app="admin-ui" />);
    expect(container.querySelector('.shell')).toHaveAttribute('data-der-app', 'admin-ui');
  });

  it('renders optional children between the status notice and the build banner', () => {
    render(
      <AppShell {...baseProps}>
        <div data-testid="extra">custom slot</div>
      </AppShell>,
    );
    expect(screen.getByTestId('extra')).toBeInTheDocument();
  });

  it('nav buttons are keyboard-reachable', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(
      <AppShell {...baseProps} navigation={['Only']}>
        <button type="button" onClick={() => spy()}>
          probe
        </button>
      </AppShell>,
    );
    await user.tab();
    expect(document.activeElement?.textContent).toBe('Only');
    expect(spy).not.toHaveBeenCalled();
  });
});
