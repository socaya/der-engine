// Hello DER — minimal C-UI-5b smoke bundle (no SDK, no imports).
// Upload via Admin UI → Settings → App catalogue → Install with:
//   appKey:         hello-der
//   displayName:    Hello DER
//   module:         Data
//   version:        1.0.0
//   requiresDerApi: 1.0.0
//   file:           this file
export default function HelloDer() {
  return {
    $$typeof: Symbol.for('react.element'),
    type: 'div',
    props: {
      style: { padding: 24, fontFamily: 'Roboto, sans-serif' },
      children: [
        { $$typeof: Symbol.for('react.element'), type: 'h1', key: 't',
          props: { style: { margin: 0, fontSize: 20 },
                   children: 'Hello from a DER-dispatched app' },
          ref: null },
        { $$typeof: Symbol.for('react.element'), type: 'p', key: 'p',
          props: { style: { marginTop: 8, color: '#6e7a8a' },
                   children: 'Signed with Ed25519, cached in IndexedDB, '
                             + 'mounted into the shell.' },
          ref: null },
      ],
    },
    ref: null, key: null,
  };
}
