const JR = globalThis.__DER_SHELL_VENDOR__?.['react/jsx-runtime'];
if (!JR) throw new Error('@der/vendor/react-jsx-runtime: shell runtime not installed.');
export const jsx = JR.jsx;
export const jsxs = JR.jsxs;
export const Fragment = JR.Fragment;
export default JR.default ?? JR;
