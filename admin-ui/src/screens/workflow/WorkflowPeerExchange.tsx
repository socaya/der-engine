import { useState } from 'react';
import { HeroHeader } from '../../components/HeroHeader';
import { WorkflowPeers } from './WorkflowPeers';
import { WorkflowImportInbox } from './WorkflowImportInbox';

/**
 * §2.3.58 — admin surface for distributing workflow DEFINITIONS
 * (not patients) between DER edges. Merges the previously separate
 * Peers (outbound) + Import inbox (inbound) nav items into a
 * single screen with two tabs since they are two sides of the
 * same handshake.
 */

type Tab = 'outbound' | 'inbound';

export function WorkflowPeerExchange(): JSX.Element {
  const [active, setActive] = useState<Tab>('outbound');
  return (
    <div className="ea-screen" data-test="peer-exchange-root">
      <HeroHeader
        title="Peer exchange"
        subtitle="Share workflow definitions with other DER edges"
      />
      <h1 className="ea-visually-hidden" data-test="peer-exchange-heading">
        Peer exchange
      </h1>

      <div className="ea-section-tabs" role="tablist"
            style={{ marginBottom: 12 }}>
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
      </div>

      <div hidden={active !== 'outbound'}>
        <WorkflowPeers embedded />
      </div>
      <div hidden={active !== 'inbound'}>
        <WorkflowImportInbox embedded />
      </div>
    </div>
  );
}
