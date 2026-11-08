import { createContext, useCallback, useContext, useEffect,
  useMemo, useState, type ReactNode } from 'react';

/**
 * Tiny context so a workflow deep in the tree (EventWorkflow,
 * TrackerStageEditor, …) can broadcast its dirty state to the
 * Capture shell's toolbar without prop-drilling. Only one
 * workflow is active at a time so the "any editor is dirty"
 * aggregation is just a per-contributor flag ORed together.
 *
 * <p>The provider's context value is memoised + its {@code set}
 * callback is {@code useCallback}-stable so consumers don't
 * re-render on every parent paint — avoids a cascading flicker
 * in TrackerWorkflow / EventWorkflow that re-fetched their
 * working lists every render.</p>
 */

interface DirtyRegistry {
  readonly anyDirty: boolean;
  readonly set: (id: string, dirty: boolean) => void;
}

const DirtyContext = createContext<DirtyRegistry | null>(null);

export function DirtyProvider({ children }: { children: ReactNode }):
    JSX.Element {
  const [map, setMap] = useState<Record<string, boolean>>({});
  const set = useCallback((id: string, dirty: boolean): void => {
    setMap((prev) => {
      if ((prev[id] ?? false) === dirty) return prev;
      const next = { ...prev };
      if (dirty) next[id] = true;
      else delete next[id];
      return next;
    });
  }, []);
  const anyDirty = useMemo(
    () => Object.values(map).some(Boolean),
    [map]);
  const value = useMemo(() => ({ anyDirty, set }), [anyDirty, set]);
  return (
    <DirtyContext.Provider value={value}>
      {children}
    </DirtyContext.Provider>
  );
}

/** Publish this consumer's dirty state into the shell. No-op when
 *  the component isn't wrapped (unit tests, isolated previews). */
export function usePublishDirty(id: string, dirty: boolean): void {
  const ctx = useContext(DirtyContext);
  const setter = ctx?.set;
  useEffect(() => {
    if (!setter) return;
    setter(id, dirty);
    // On unmount, clear so a closed editor stops holding the
    // shell's chip open.
    return () => setter(id, false);
  }, [id, dirty, setter]);
}

export function useAnyDirty(): boolean {
  const ctx = useContext(DirtyContext);
  return ctx?.anyDirty ?? false;
}
