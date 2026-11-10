/**
 * MoreScreens — thin barrel.
 *
 * The original 4700-LOC MoreScreens.tsx housed ~22 unrelated screens
 * (drift inspector, worker health, device fleet, backups, audit, …).
 * The screens have since been split into per-module files under
 * `screens/{dhis2,sync,devices,data,system,access}/`. This barrel
 * re-exports every screen under its original name so consumers
 * (App.tsx, axe.test.tsx, MoreScreens.test.tsx) keep importing from
 * `./MoreScreens` without churn. See each target module for the
 * actual implementation.
 */

export { DriftInspector } from './dhis2/DriftInspector';
export { CompatInspector } from './dhis2/CompatInspector';
export { ConflictList } from './sync/AttentionList';
export { AttentionDetailScreen } from './sync/AttentionDetail';
export { WorkerHealthScreen } from './sync/WorkerHealth';
export { DeviceFleet } from './devices/DeviceFleet';
export { DeviceDetail } from './devices/DeviceDetail';
export { ApprovalQueue, ApprovalDetail } from './devices/Approvals';
export { ReferralInbox, ReferralDetail } from './data/Referrals';
export { BackupList, RestoreList } from './system/BackupRestore';
export {
  Decommission,
  SiteConfig,
  ConfigEditor,
  OperationalReport,
  SupportBundle,
} from './system/SystemOps';
export { OperatorMetrics, FacilityAnalytics } from './system/MetricsAnalytics';
export { Dhis2Mappings } from './access/Dhis2Mappings';
export { UserScope } from './access/UserScope';
export { AuditEvents, SecurityAuditTrail } from './access/AuditLog';
export { fmtBytes } from './shared';
