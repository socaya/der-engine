const RD = globalThis.__DER_SHELL_VENDOR__?.['react-dom'];
if (!RD) throw new Error('@der/vendor/react-dom: shell runtime not installed.');
export const createPortal = RD.createPortal;
export const flushSync = RD.flushSync;
export const hydrate = RD.hydrate;
export const render = RD.render;
export const unmountComponentAtNode = RD.unmountComponentAtNode;
export const version = RD.version;
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED =
  RD.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
export default RD.default ?? RD;
