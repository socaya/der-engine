import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useOrgUnitBinding } from '../orgunit/OrgUnitBindingContext';

/**
 * Lightweight branded header for the DER device-client.
 *
 * Replaces @dhis2/ui's HeaderBar — which fetches DHIS2-specific shell
 * endpoints the DER emulator does not implement (/api/44/me,
 * /api/44/systemSettings/applicationTitle,
 * /api/44/systemSettings/helpPageLink, /api/44/me/dashboard,
 * /dhis-web-commons/menu/getModules.action). On a capture-only device
 * client there is no need for the DHIS2 app menu; a plain banner
 * showing edge identity + bound OU + signed-in user is clearer and
 * avoids a long cascade of failing probes on every page load.
 */
export function DerHeader(): JSX.Element {
  const { state } = useAuth();
  const binding = useOrgUnitBinding();
  const user = state.status === 'AUTHENTICATED' ? state.user : null;
  const bound = binding.state.status === 'READY' && binding.state.binding.bound
    ? binding.state.binding
    : null;

  return (
    <header className="der-header" data-test="der-header">
      <Link to="/" className="der-header__brand" data-test="der-header-brand">
        <span>DER Edge Runtime</span>
      </Link>
      {bound ? (
        <span className="der-header__orgunit" data-test="der-header-orgunit">
          <strong>{bound.orgUnitDisplayName ?? bound.orgUnitId}</strong>
          <code>{bound.orgUnitId}</code>
        </span>
      ) : (
        <span className="der-header__orgunit der-header__orgunit--unbound"
               data-test="der-header-unbound">
          Not bound to an organisation unit
        </span>
      )}
      {user && (
        <span className="der-header__user" data-test="der-header-user">
          {user.displayName}
        </span>
      )}
    </header>
  );
}
