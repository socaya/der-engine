// Hello DER (SDK v2) — C-UI-5c slice 2 smoke bundle.
//
// Uses bare imports resolved by the shell's importmap:
//   react        -> /vendor/react.js
//   @der/app-sdk -> /vendor/der-app-sdk.js
//
// Upload via Admin UI → Settings → App catalogue → Install with:
//   appKey:         hello-sdk
//   displayName:    Hello (SDK)
//   module:         Data
//   version:        2.0.0
//   requiresDerApi: 1.0.0
//   file:           this file
import { useState, createElement as h } from 'react';
import {
  useAuth, useOrgUnitBinding, useOnlineStatus,
  ScreenCard, StatusPill,
} from '@der/app-sdk';

export default function HelloDerSdk() {
  const auth = useAuth();
  const ou = useOrgUnitBinding();
  const online = useOnlineStatus();
  const [clicks, setClicks] = useState(0);

  return h(ScreenCard, {
    title: 'Hello from @der/app-sdk',
    actions: h(StatusPill,
      { tone: online.isOnline ? 'success' : 'warning' },
      online.isOnline ? 'online' : `offline (${online.queuedCount} queued)`),
    children: h('div', null,
      h('p', null, 'Signed-in: ', h('strong', null, auth.displayName ?? '—')),
      h('p', null, 'Bound OU: ', h('code', null, ou.orgUnitPath ?? '—')),
      h('button',
        { type: 'button', onClick: () => setClicks((c) => c + 1),
          style: { marginTop: 8 } },
        `Clicked ${clicks} time${clicks === 1 ? '' : 's'}`)),
  });
}
