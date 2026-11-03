import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NetworkLegend } from './NetworkLegend';

describe('NetworkLegend', () => {
  it('renders a labelled legend with the five entries', () => {
    render(<NetworkLegend />);
    const list = screen.getByRole('list', { name: 'Topology legend' });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText('Sync')).toBeInTheDocument();
    expect(screen.getByText('Ethernet')).toBeInTheDocument();
    expect(screen.getByText('Wi-Fi')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('Degraded')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });
});
