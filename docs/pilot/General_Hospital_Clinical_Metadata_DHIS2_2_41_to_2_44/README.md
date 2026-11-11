# General Hospital Clinical Metadata - Edition 3.0

Clean clinical names without `DER EMR -` or `DER HOSP -` prefixes. Stable DHIS2 UIDs, stable 8-character service/type/sequence codes, and preserved option codes.

- `General_Hospital_Clinical_Metadata_Guide.md` and `.pdf`: hospital architecture, workflows and object references
- `Hospital_DHIS2_2_41_Clinical_Metadata.json` through `Hospital_DHIS2_2_44_Clinical_Metadata.json`: version-targeted reference imports
- `01_Shared_Foundation.json`, `02_Programs_and_Stages.json`, `03_Program_Rules_and_Indicators.json`: staged import packages
- `Metadata_Code_Registry.csv/.json`: governed object identifiers
- `Metadata_Name_Changes.csv`: complete name-change audit
- `Option_Code_Alias_Map.json`: nonbreaking option aliases
- `Validation_Manifest.json`: structural checks and important limitations

**Not production-certified.** Validate import against each DHIS2 version on staging and review clinical terminology, program rules and indicators before production.
