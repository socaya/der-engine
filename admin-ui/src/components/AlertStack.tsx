import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * C1: global alert stack. Any screen can push a toast via useAlert().
 * Alerts auto-dismiss after their timeoutMs (default 6000) unless
 * marked permanent. Rendered at the AdminShell root above all content
 * so operators see errors even when scrolled deep into a table.
 */
export type AlertKind = 'info' | 'success' | 'warning' | 'critical';

export interface AlertEntry {
  id: string;
  kind: AlertKind;
  message: string;
  title?: string;
  permanent?: boolean;
  timeoutMs?: number;
}

export interface AlertApi {
  show: (a: Omit<AlertEntry, 'id'>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const AlertContext = createContext<AlertApi | null>(null);

export function useAlert(): AlertApi {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error('useAlert must be called inside <AlertProvider>');
  }
  return ctx;
}

export function AlertProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);

  const dismiss = useCallback((id: string): void => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const show = useCallback(
    (a: Omit<AlertEntry, 'id'>): string => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setAlerts((prev) => [...prev, { id, ...a }]);
      return id;
    },
    [],
  );

  const dismissAll = useCallback((): void => setAlerts([]), []);

  const value = useMemo<AlertApi>(() => ({ show, dismiss, dismissAll }), [show, dismiss, dismissAll]);

  return (
    <AlertContext.Provider value={value}>
      {children}
      <div className="ea-alert-stack" role="region" aria-live="polite" data-test="alert-stack">
        {alerts.map((a) => (
          <AlertCard key={a.id} alert={a} onDismiss={dismiss} />
        ))}
      </div>
    </AlertContext.Provider>
  );
}

function AlertCard({ alert, onDismiss }: {
  alert: AlertEntry; onDismiss: (id: string) => void;
}): JSX.Element {
  useEffect(() => {
    if (alert.permanent) return undefined;
    const ms = alert.timeoutMs ?? 6000;
    const t = setTimeout(() => onDismiss(alert.id), ms);
    return () => clearTimeout(t);
  }, [alert, onDismiss]);
  return (
    <div
      className={`ea-alert ea-alert--${alert.kind}`}
      data-test={`alert-${alert.id}`}
      data-test-kind={alert.kind}
      role={alert.kind === 'critical' ? 'alert' : 'status'}
    >
      <div className="ea-alert-body">
        {alert.title && <strong>{alert.title}</strong>}
        <span>{alert.message}</span>
      </div>
      <button
        type="button"
        className="ea-alert-close"
        aria-label="Dismiss alert"
        onClick={() => onDismiss(alert.id)}
        data-test="alert-dismiss"
      >
        ✕
      </button>
    </div>
  );
}
