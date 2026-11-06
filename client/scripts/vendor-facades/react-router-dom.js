// react-router-dom already ships proper named ESM exports; the
// facade just re-exports them and provides a default for any
// consumer that uses `import ReactRouterDOM from 'react-router-dom'`.
export * from 'react-router-dom';
import * as ReactRouterDOM from 'react-router-dom';
export default ReactRouterDOM;
