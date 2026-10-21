import { AppShell, type ShellProps } from './AppShell';

/**
 * DER device-client application — Phase 00 scaffold.
 *
 * Navigation entries correspond to the DC-* screens in
 * `docs/ui/02-screen-inventory.md`. Real DHIS2 workflow execution is a Phase 03
 * deliverable; this shell exists so acceptance tests can bind to stable DOM.
 */

const navigation: readonly string[] = [
  'Application launcher',
  'Aggregate reporting',
  'Event capture',
  'Tracker',
  'Recent records',
  'Connection status',
] as const;

const props: ShellProps = {
  app: 'client',
  brand: 'DER Client',
  heading: 'DER Client',
  subheading: 'DHIS2 Edge Runtime • local workflow shell',
  navigation,
  version: __DER_VERSION__,
  dhis2ReferenceVersion: 'unknown',
};

export default function App(): JSX.Element {
  return <AppShell {...props} />;
}
