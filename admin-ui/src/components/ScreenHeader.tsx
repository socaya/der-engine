/**
 * UX-B: ScreenHeader superseded by PageHeader. This file is now a
 * thin re-export so any straggler imports keep compiling until they
 * get swept in a follow-up pass. Call-sites should import PageHeader
 * directly.
 */
export { PageHeader as ScreenHeader } from './PageHeader';
export type { PageHeaderProps as ScreenHeaderProps } from './PageHeader';
