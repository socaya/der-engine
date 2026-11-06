// Passthrough facade — re-exports the SHELL's React instance
// (published on globalThis.__DER_SHELL_VENDOR__.react by
// src/apps/sdk-runtime.ts) so shell and DER-dispatched apps share
// ONE React reconciler + hook dispatcher. Two React instances
// breaks hooks ("Cannot read properties of null (reading
// 'useState')") + context lookups.
const R = globalThis.__DER_SHELL_VENDOR__?.react;
if (!R) {
  throw new Error(
    '@der/vendor/react: shell runtime is not installed. '
    + 'Apps can only load inside the DER device client.');
}

export const Children = R.Children;
export const Component = R.Component;
export const Fragment = R.Fragment;
export const Profiler = R.Profiler;
export const PureComponent = R.PureComponent;
export const StrictMode = R.StrictMode;
export const Suspense = R.Suspense;
export const cloneElement = R.cloneElement;
export const createContext = R.createContext;
export const createElement = R.createElement;
export const createFactory = R.createFactory;
export const createRef = R.createRef;
export const forwardRef = R.forwardRef;
export const isValidElement = R.isValidElement;
export const lazy = R.lazy;
export const memo = R.memo;
export const startTransition = R.startTransition;
export const useCallback = R.useCallback;
export const useContext = R.useContext;
export const useDebugValue = R.useDebugValue;
export const useDeferredValue = R.useDeferredValue;
export const useEffect = R.useEffect;
export const useId = R.useId;
export const useImperativeHandle = R.useImperativeHandle;
export const useInsertionEffect = R.useInsertionEffect;
export const useLayoutEffect = R.useLayoutEffect;
export const useMemo = R.useMemo;
export const useReducer = R.useReducer;
export const useRef = R.useRef;
export const useState = R.useState;
export const useSyncExternalStore = R.useSyncExternalStore;
export const useTransition = R.useTransition;
export const version = R.version;
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED =
  R.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
export default R.default ?? R;
