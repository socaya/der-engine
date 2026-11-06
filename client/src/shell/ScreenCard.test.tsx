import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScreenCard, StatusPill } from './ScreenCard';

describe('ScreenCard', () => {
  it('renders a card with title + body', () => {
    render(<ScreenCard title="Home"><p>body</p></ScreenCard>);
    expect(screen.getByTestId('der-screen-card')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('renders without a head block when no title + actions supplied', () => {
    const { container } = render(<ScreenCard><span>only</span></ScreenCard>);
    expect(container.querySelector('.der-screen-card__head')).toBeNull();
    expect(screen.getByText('only')).toBeInTheDocument();
  });

  it('renders actions beside the title', () => {
    render(
      <ScreenCard title="Home" actions={<button>Go</button>}>
        <p>body</p>
      </ScreenCard>,
    );
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('renders an empty title slot (span) when only actions supplied', () => {
    const { container } = render(
      <ScreenCard actions={<button>Go</button>}><p>body</p></ScreenCard>,
    );
    expect(container.querySelector('.der-screen-card__head')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('honours a custom dataTest', () => {
    render(<ScreenCard dataTest="my-card"><span>x</span></ScreenCard>);
    expect(screen.getByTestId('my-card')).toBeInTheDocument();
  });
});

describe('StatusPill', () => {
  it.each(['success', 'warning', 'danger', 'info', 'neutral'] as const)(
    'renders the %s tone', (tone) => {
      render(<StatusPill tone={tone}>hello</StatusPill>);
      const el = screen.getByTestId(`der-status-pill-${tone}`);
      expect(el.className).toContain(`der-status-pill--${tone}`);
      expect(el.textContent).toBe('hello');
    },
  );

  it('honours a custom dataTest', () => {
    render(<StatusPill tone="info" dataTest="x">y</StatusPill>);
    expect(screen.getByTestId('x')).toBeInTheDocument();
  });
});
