import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('client App', () => {
  it('mounts without crashing and shows the client heading', () => {
    render(<App />);
    expect(screen.getByTestId('heading')).toHaveTextContent('DER Client');
  });

  it('renders every documented navigation entry', () => {
    render(<App />);
    for (const label of [
      'Application launcher',
      'Aggregate reporting',
      'Event capture',
      'Tracker',
      'Recent records',
      'Connection status',
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
