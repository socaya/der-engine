import { AppShell, type ShellProps } from './AppShell';

/**
 * DER administration console — Phase 00 scaffold.
 *
 * Navigation entries map 1:1 to the EA-* screen domains in
 * `docs/ui/02-screen-inventory.md`. No navigation entry performs real work in
 * this phase; each is a placeholder visual target rendered through {@link AppShell}
 * so acceptance tests have stable semantics to assert against.
 */

const navigation: readonly string[] = [
  'Overview',
  'Provisioning',
  'Synchronisation',
  'Conflicts',
  'Metadata',
  'Security',
  'Recovery',
  'Evaluation',
  'Settings',
] as const;

const props: ShellProps = {
  app: 'admin-ui',
  brand: 'DER Administration',
  heading: 'DER Administration',
  subheading: 'DHIS2 Edge Runtime • administrator console',
  navigation,
  version: __DER_VERSION__,
  dhis2ReferenceVersion: 'unknown',
};

export default function App(): JSX.Element {
  return <AppShell {...props} />;
}
