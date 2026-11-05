import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SyncStatusBar } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { WorkflowPeers } from './WorkflowPeers';
import { WorkflowImportInbox } from './WorkflowImportInbox';

/**
 * §2.3.58 — admin surface for distributing workflow DEFINITIONS
 * (not patients) between DER edges. Merges the previously separate
 * Peers (outbound) + Import inbox (inbound) nav items into a
 * single screen with two tabs since they are two sides of the
 * same handshake.
 *
 * Lives under Network (§2.3.59 / ADR) because it rides the same
 * peer-registry transport as the WireGuard peer list; the inner
 * two components (WorkflowPeers, WorkflowImportInbox) already
 * carry their own SyncStatusBars when rendered standalone, so
 * they're wrapped in {@code embedded} mode here to suppress the
 * duplicate chrome.
 */

type Tab = 'outbound' | 'inbound';

export function WorkflowPeerExchange(): JSX.Element {
  const [active, setActive] = useState<Tab>('outbound');
  return (
    <div className="ea-screen" data-test="peer-exchange-root">
      <SyncStatusBar
        tone="info"
        title="Workflow sharing"
        statusLabel={active === 'outbound' ? 'Outbound peers' : 'Inbound inbox'}
        actions={
          <>
            <Link to="/workflows/manage"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Workflows"
                  data-test="peer-exchange-open-catalogue">
              <UiIcon icon="metadata" size={14} />
              <span>Workflow catalogue</span>
            </Link>
            <Link to="/network/peers"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Network"
                  data-test="peer-exchange-open-wg-peers">
              <UiIcon icon="peer" size={14} />
              <span>WireGuard peers</span>
            </Link>
          </>
        }
      />
      <h1 className="ea-visually-hidden" data-test="peer-exchange-heading">
        Workflow sharing
      </h1>

      <nav className="ea-section-tabs" role="tablist"
           aria-label="Workflow sharing direction">
        <button type="button" role="tab" aria-selected={active === 'outbound'}
                 className={'ea-section-tab'
                   + (active === 'outbound' ? ' ea-section-tab--active' : '')}
                 data-test="peer-exchange-tab-outbound"
                 onClick={() => setActive('outbound')}>
          Outbound · Peers
        </button>
        <button type="button" role="tab" aria-selected={active === 'inbound'}
                 className={'ea-section-tab'
                   + (active === 'inbound' ? ' ea-section-tab--active' : '')}
                 data-test="peer-exchange-tab-inbound"
                 onClick={() => setActive('inbound')}>
          Inbound · Import inbox
        </button>
      </nav>

      <div hidden={active !== 'outbound'}>
        <WorkflowPeers embedded />
      </div>
      <div hidden={active !== 'inbound'}>
        <WorkflowImportInbox embedded />
      </div>
    </div>
  );
}
