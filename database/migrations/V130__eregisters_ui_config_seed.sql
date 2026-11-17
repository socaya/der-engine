-- V130 — seed a valid-shape UI config for the eregisters app.
--
-- Rationale: eregisters' client calls GET /api/dataStore/eregisters/ui-config
-- at boot. Per its source (schemas.ts), the response must match the UIConfig
-- shape: {subsections, formLayouts?, reloadSignal:{app,metadata}}. If the
-- response is 404, eregisters catches it and falls back to its internal
-- `emptyUIConfig`. If the response is 200 with a shape MISSING reloadSignal,
-- a downstream useEffect in use-shell-state.ts crashes with
--   TypeError: Cannot read properties of undefined (reading 'metadata')
--   at uiConfig.reloadSignal.metadata?.timestamp
-- The crash propagates up and breaks the whole app boot.
--
-- An earlier dev session wrote an ad-hoc test payload
-- ({theme:'light', maxRows:100}) into this key. That payload crashes
-- eregisters as above. The row was deleted but Workbox SW caches in
-- operator browsers may have memoized the bad response. Seeding a
-- CORRECTLY-SHAPED default here means (a) fresh installs boot cleanly,
-- and (b) the DER dataStore always returns a safe shape when any client
-- probes this key. A future eregisters write via POST overwrites this seed
-- with the real operator config.
INSERT INTO der.app_data_store (namespace, data_key, value_json)
VALUES (
    'eregisters',
    'ui-config',
    '{"subsections":{},"formLayouts":{},"reloadSignal":{"app":null,"metadata":null}}'::jsonb
)
ON CONFLICT (namespace, data_key) DO NOTHING;
