# Java package organisation

`web/` contains the real health endpoint. Create further packages **only when implemented**: `provisioning`, `identity`, `metadata`, `journal`, `sync`, `conflicts`, `recovery`, `security`, and `observability`. Keep controller, domain, service and persistence responsibilities separate. Add unit and integration tests for every new capability.
