/**
 * @der/app-sdk — public surface consumed by DER-dispatched apps.
 *
 * Apps built against this package are ESM bundles that run inside
 * the device-client shell (ADR-0037 C-UI-5b AppHost). They must not
 * ship their own React / React DOM / @der/app-sdk — the shell
 * provides each at a stable URL via a `<script type="importmap">`
 * block so every app shares the same React instance (hooks
 * require this) and the SDK can call into the shell's own auth
 * context, offline queue and routing.
 *
 * Build an app with Vite (see `apps/app-sdk/vite.config.template.ts`)
 * declaring these three bare specifiers as externals:
 *   - react
 *   - react-dom
 *   - react-router-dom
 *   - @der/app-sdk
 *
 * The bundle is a single ESM file with one default export, a React
 * component. The admin uploads it via the admin-ui "App catalogue"
 * screen; the server signs it (Ed25519) before storing, and the
 * client verifies on install.
 */

export interface DerAuth {
  /** Username of the signed-in operator. */
  readonly username: string;
  /** Display name — operator-facing. */
  readonly displayName: string;
  /** Granted authority codes (`der.sync.read` etc.). */
  readonly roles: readonly string[];
}

export interface DerOrgUnit {
  /** DHIS2 org-unit UID this edge is bound to. */
  readonly orgUnitUid: string;
  /** Human-readable OU path, e.g. `Uganda / Kampala / Mulago HC-III`. */
  readonly orgUnitPath: string;
  readonly bound: boolean;
}

export interface DerApi {
  /** Submit an aggregate data-value set envelope. Offline-safe. */
  readonly submitAggregate: (input: unknown) => Promise<unknown>;
  /** List the operator's drafts. */
  readonly listDrafts: () => Promise<unknown>;
  /** Fetch tracker-program events. */
  readonly listEvents: (program: string, pageSize?: number) => Promise<unknown>;
}

export interface DerOnline {
  readonly isOnline: boolean;
  /** Queue length pending at the edge. */
  readonly queuedCount: number;
}

/* ───── Hooks (runtime provided by the shell). ───────────────── */

/** The signed-in user. Null while the auth session probe is
 *  pending, throws if called outside the shell. */
export declare function useAuth(): DerAuth;

/** The bound org unit (single-OU locked per ADR-0015). */
export declare function useOrgUnitBinding(): DerOrgUnit;

/** True while the device has WAN + edge connectivity. */
export declare function useOnlineStatus(): DerOnline;

/** DER edge-API client, offline-safe, cookie-authenticated. */
export declare function useDerApi(): DerApi;

/* ───── Components. ──────────────────────────────────────────── */

export interface ScreenCardProps {
  readonly title?: string;
  readonly actions?: unknown;
  readonly children: unknown;
  readonly dataTest?: string;
}

export interface StatusPillProps {
  readonly tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  readonly children: unknown;
  readonly dataTest?: string;
}

export declare function ScreenCard(props: ScreenCardProps): unknown;
export declare function StatusPill(props: StatusPillProps): unknown;
