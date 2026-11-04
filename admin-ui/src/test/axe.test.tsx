import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders } from './renderWithProviders';
import { runAxe, formatAxeViolations } from './axe';
import * as edgeApi from '../api/edgeApi';
import { MockupSupportBundle, MockupConfigEditor,
         MockupOperationalReport, MockupUserScope,
         MockupSiteConfig, MockupDecommission } from '../screens/MoreScreens';
import { LocalVsCentralBadge } from '../screens/shared';

/* ─────────────────────────────────────────────────────────────────
 * NFR-26 — axe-core smoke across the admin surfaces shipped this
 * session (FR-15-06..10, NFR-25, FR-01-07, FR-01-10). These screens
 * carry fresh markup so axe runs here are the fastest way to catch
 * regressions as more UI lands. Each screen stubs its API dep so
 * the component mounts in its loaded state (where the most mark-up
 * renders) rather than its loading state.
 * ───────────────────────────────────────────────────────────────── */

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

describe('NFR-26 — axe smoke on shipped admin surfaces', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  async function assertClean(container: Element): Promise<void> {
    /* Flush the initial useEffect + microtasks so any state-driven
     * markup is in place before axe inspects the DOM. */
    await new Promise((r) => setTimeout(r, 0));
    const violations = await runAxe(container);
    expect(violations, formatAxeViolations(violations)).toEqual([]);
  }

  it('LocalVsCentralBadge (both variants) is accessible', async () => {
    const { container, rerender } =
      renderWithProviders(<LocalVsCentralBadge state="CENTRAL_ACCEPTED" />);
    await assertClean(container);
    rerender(<LocalVsCentralBadge state="PENDING" />);
    await assertClean(container);
  });

  it('MockupConfigEditor is accessible', async () => {
    vi.spyOn(edgeApi, 'readOpsSettings').mockResolvedValue({
      settings: { 'der.backup.enabled': 'true' },
    });
    vi.spyOn(edgeApi, 'securityAuditEvents').mockResolvedValue([]);
    const { container } = renderWithProviders(<MockupConfigEditor />, { authApi });
    await assertClean(container);
  });

  it('MockupSupportBundle is accessible', async () => {
    const { container } = renderWithProviders(<MockupSupportBundle />, { authApi });
    await assertClean(container);
  });

  it('MockupOperationalReport is accessible', async () => {
    vi.spyOn(edgeApi, 'fetchOperationalReport').mockResolvedValue({
      generatedAt: '2026-11-04T10:00:00Z',
      byState: { PENDING: 1, CENTRAL_ACCEPTED: 2 },
      centralConfirmed: 2, localOnly: 1,
      note: 'Local-only totals never claim central authoritative acceptance.',
    });
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([]);
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      enabled: true, probeTimestamp: 'now', backlog: {},
    } as unknown as edgeApi.WorkerHealth);
    const { container } = renderWithProviders(<MockupOperationalReport />, { authApi });
    await assertClean(container);
  });

  it('MockupUserScope is accessible', async () => {
    vi.spyOn(edgeApi, 'fetchUserScope').mockResolvedValue({
      generatedAt: 'now',
      users: [
        { userId: 'u-a', username: 'alice', displayName: 'A',
          roles: ['ADMIN'], origin: 'LOCAL', disabled: false,
          createdAt: 'now', updatedAt: 'now', permissionAgeHours: 1 },
      ],
    });
    const { container } = renderWithProviders(<MockupUserScope />, { authApi });
    await assertClean(container);
  });

  it('MockupSiteConfig is accessible', async () => {
    vi.spyOn(edgeApi, 'readSiteConfig').mockResolvedValue({
      values: { 'site.displayName': 'DER edge' },
      defaults: { 'site.displayName': 'DER edge' },
      updatedBy: null, updatedAt: null,
    });
    const { container } = renderWithProviders(<MockupSiteConfig />, { authApi });
    await assertClean(container);
  });

  it('MockupDecommission (pre-confirm view) is accessible', async () => {
    const { container } = renderWithProviders(<MockupDecommission />, { authApi });
    await assertClean(container);
  });
});
