import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertProvider, useAlert } from './AlertStack';

/* AlertStack is a React context with a global toast stack. Tests
 * cover push/dismiss/dismissAll, auto-dismiss timer, permanent
 * alerts, kind-based roles, and the useAlert guard. */

function Trigger({
  args, onRef,
}: {
  args: Parameters<ReturnType<typeof useAlert>['show']>[0];
  onRef?: (id: string) => void;
}): JSX.Element {
  const api = useAlert();
  return (
    <>
      <button type="button" data-test="push"
              onClick={() => { const id = api.show(args); onRef?.(id); }}>
        push
      </button>
      <button type="button" data-test="dismiss-all"
              onClick={() => api.dismissAll()}>all</button>
    </>
  );
}

describe('AlertStack', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('useAlert outside a provider throws', () => {
    function Probe(): JSX.Element {
      useAlert();
      return <></>;
    }
    expect(() => render(<Probe />)).toThrow(/useAlert must be called/);
  });

  it('pushes an alert + auto-dismisses after the default timeout', () => {
    render(
      <AlertProvider>
        <Trigger args={{ kind: 'info', message: 'hello' }} />
      </AlertProvider>,
    );
    expect(screen.getByTestId('alert-stack').children.length).toBe(0);
    fireEvent.click(screen.getByTestId('push'));
    expect(screen.getByText('hello')).toBeInTheDocument();
    /* Advance past the default 6000 ms timeout. */
    act(() => { vi.advanceTimersByTime(7000); });
    expect(screen.queryByText('hello')).toBeNull();
  });

  it('permanent alert does NOT auto-dismiss', () => {
    render(
      <AlertProvider>
        <Trigger args={{ kind: 'warning', message: 'stays',
                           permanent: true }} />
      </AlertProvider>,
    );
    fireEvent.click(screen.getByTestId('push'));
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByText('stays')).toBeInTheDocument();
  });

  it('custom timeoutMs overrides the default', () => {
    render(
      <AlertProvider>
        <Trigger args={{ kind: 'info', message: 'quick', timeoutMs: 1000 }} />
      </AlertProvider>,
    );
    fireEvent.click(screen.getByTestId('push'));
    act(() => { vi.advanceTimersByTime(900); });
    expect(screen.getByText('quick')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByText('quick')).toBeNull();
  });

  it('close button dismisses the alert', () => {
    render(
      <AlertProvider>
        <Trigger args={{ kind: 'info', message: 'close me',
                           permanent: true }} />
      </AlertProvider>,
    );
    fireEvent.click(screen.getByTestId('push'));
    expect(screen.getByText('close me')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('alert-dismiss'));
    expect(screen.queryByText('close me')).toBeNull();
  });

  it('dismissAll empties the stack', () => {
    render(
      <AlertProvider>
        <Trigger args={{ kind: 'info', message: 'a', permanent: true }} />
      </AlertProvider>,
    );
    fireEvent.click(screen.getByTestId('push'));
    fireEvent.click(screen.getByTestId('push'));
    fireEvent.click(screen.getByTestId('push'));
    expect(screen.getAllByText('a').length).toBe(3);
    fireEvent.click(screen.getByTestId('dismiss-all'));
    expect(screen.queryByText('a')).toBeNull();
  });

  it('critical kind gets role="alert", other kinds get role="status"', () => {
    const { rerender } = render(
      <AlertProvider>
        <Trigger args={{ kind: 'critical', message: 'oops',
                           permanent: true }} />
      </AlertProvider>,
    );
    fireEvent.click(screen.getByTestId('push'));
    /* An element with role=alert surfaces (the card). */
    expect(screen.getByRole('alert')).toBeInTheDocument();
    /* Rerender with an info kind — role=status surfaces. */
    rerender(
      <AlertProvider>
        <Trigger args={{ kind: 'info', message: 'fyi',
                           permanent: true }} />
      </AlertProvider>,
    );
    fireEvent.click(screen.getByTestId('push'));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('title is rendered when supplied', () => {
    render(
      <AlertProvider>
        <Trigger args={{ kind: 'info', message: 'body',
                           title: 'Hey!', permanent: true }} />
      </AlertProvider>,
    );
    fireEvent.click(screen.getByTestId('push'));
    expect(screen.getByText('Hey!')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('show returns the generated id', () => {
    let returnedId: string | null = null;
    render(
      <AlertProvider>
        <Trigger args={{ kind: 'info', message: 'returns-id' }}
                 onRef={(id) => { returnedId = id; }} />
      </AlertProvider>,
    );
    fireEvent.click(screen.getByTestId('push'));
    expect(returnedId).toMatch(/\d+-\w+/);
  });
});
