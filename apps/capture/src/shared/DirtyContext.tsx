import { createContext, useContext, useEffect,
  useState, type ReactNode } from 'react';

/**
 * Tiny context so a workflow deep in the tree (EventWorkflow,
 * TrackerStageEditor, …) can broadcast its dirty state to the
 * Capture shell's toolbar without prop-drilling. Only one
 * workflow is active at a time so the "any editor is dirty"
 * aggregation is just a per-contributor flag ORed together.
 */

interface DirtyRegistry {
  readonly anyDirty: boolean;
  readonly set: (id: string, dirty: boolean) => void;
}

const DirtyContext = createContext<DirtyRegistry | null>(null);

export function DirtyProvider({ children }: { children: ReactNode }):
    JSX.Element {
  // Per-contributor dirty map. Kept as a plain object so React's
  // Object.is comparison forces re-render only when the shape
  // actually changes.
  const [map, setMap] = useState<Record<string, boolean>>({});
  const anyDirty = Object.values(map).some(Boolean);
  const value: DirtyRegistry = {
    anyDirty,
    set: (id, dirty) => setMap((prev) => {
      if ((prev[id] ?? false) === dirty) return prev;
      const next = { ...prev };
      if (dirty) next[id] = true;
      else delete next[id];
      return next;
    }),
  };
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
  useEffect(() => {
    if (!ctx) return;
    ctx.set(id, dirty);
    // On unmount, clear so a closed editor stops holding the
    // shell's chip open.
    return () => ctx.set(id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, dirty]);
}

export function useAnyDirty(): boolean {
  const ctx = useContext(DirtyContext);
  return ctx?.anyDirty ?? false;
}
