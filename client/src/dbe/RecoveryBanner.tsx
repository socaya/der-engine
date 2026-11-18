import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, NoticeBox } from '@dhis2/ui';

import { drainOfflineQueue } from '../offline/replay';
import { useContinuity } from './continuity';

/**
 * Pops up when the DER server comes back online with a non-empty
 * offline queue. Prompts the operator to confirm the drain so a
 * long-queued batch doesn't fire against central without them
 * seeing it first.
 *
 * <p>Auto-drain already fires on every online transition (see
 * {@code DerShell}'s {@code useEffect}); this banner is a
 * <em>visibility surface</em> rather than a separate trigger — it
 * makes the drain obvious to the operator and offers a Dismiss +
 * Retry affordance without the operator needing to open devtools.</p>
 *
 * <p>Detection logic: if we ever saw the server unreachable AND the
 * queue has entries, and now the server IS reachable, show the
 * banner until the operator dismisses OR the queue drains to 0.</p>
 */
export function RecoveryBanner(): JSX.Element | null {
  const snap = useContinuity();
  const [dismissed, setDismissed] = useState(false);
  const [draining, setDraining] = useState(false);
  const [drainError, setDrainError] = useState<string | null>(null);
  const sawOfflineAt = useRef<string | null>(null);

  useEffect(() => {
    if (!snap) return;
    // Track the moment we first noticed the server went away.
    if (!snap.serverReachable && sawOfflineAt.current === null) {
      sawOfflineAt.current = snap.collectedAt;
      setDismissed(false);
    }
    // Reset once the operator has drained a full recovery cycle.
    if (snap.serverReachable && snap.queued === 0) {
      sawOfflineAt.current = null;
    }
  }, [snap]);

  const handleDrain = useCallback(async () => {
    setDraining(true);
    setDrainError(null);
    try {
      await drainOfflineQueue();
    } catch (ex) {
      setDrainError((ex as Error).message);
    } finally {
      setDraining(false);
    }
  }, []);

  if (!snap) return null;
  if (!snap.serverReachable) return null;
  if (dismissed) return null;
  if (sawOfflineAt.current === null) return null;
  if (snap.queued === 0) return null;

  return (
    <NoticeBox warning title="DER server recovered — queued writes ready to drain">
      The DER server was unreachable while you were working. You
      have <strong>{snap.queued}</strong> queued submission{snap.queued === 1 ? '' : 's'}{' '}
      ready to replay.
      {drainError && (
        <p className="der-recovery-error">Drain failed: {drainError}</p>
      )}
      <div className="der-recovery-actions">
        <Button small primary loading={draining} onClick={handleDrain}>
          Drain now
        </Button>
        <Button small secondary onClick={() => setDismissed(true)}>
          Dismiss
        </Button>
      </div>
    </NoticeBox>
  );
}
