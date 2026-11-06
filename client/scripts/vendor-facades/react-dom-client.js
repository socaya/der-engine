const RDC = globalThis.__DER_SHELL_VENDOR__?.['react-dom/client'];
if (!RDC) throw new Error('@der/vendor/react-dom-client: shell runtime not installed.');
export const createRoot = RDC.createRoot;
export const hydrateRoot = RDC.hydrateRoot;
export default RDC.default ?? RDC;
