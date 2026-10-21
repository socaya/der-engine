import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('admin-ui App', () => {
  it('mounts without crashing and shows the admin heading', () => {
    render(<App />);
    expect(screen.getByTestId('heading')).toHaveTextContent('DER Administration');
  });

  it('renders every documented navigation entry', () => {
    render(<App />);
    for (const label of [
      'Overview',
      'Provisioning',
      'Synchronisation',
      'Conflicts',
      'Metadata',
      'Security',
      'Recovery',
      'Evaluation',
      'Settings',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('reports the DER version from the build-time constant', () => {
    render(<App />);
    expect(screen.getByTestId('der-version')).toHaveTextContent(/^\d+\.\d+\.\d+/);
  });

  it('reports the DHIS2 reference version as "unknown" until Phase 01 pins it', () => {
    render(<App />);
    expect(screen.getByTestId('dhis2-reference')).toHaveTextContent('unknown');
  });
});
