# General Hospital Clinical Metadata and Workflow Implementation Manual

**Edition 3.0 | 10 November 2026 | DHIS2 2.41, 2.42, 2.43 and 2.44**

> **Deployment status:** Version-specific metadata payloads are structurally checked reference candidates; no successful live server import or clinical acceptance test has been performed. Retain a backup and run `importMode=VALIDATE` in staging before committing.

## Clinical naming governance (edition 3.0)

All human-visible metadata names use concise clinical terminology without a product or implementation prefix. The names describe the clinical concept or business activity, while ownership and type are encoded in the stable `SSTTNNNN` metadata code and the registry. Examples: `Patient`, `Outpatient Consultation`, `Systolic Blood Pressure`, `Medication Administration`, `Laboratory Test Result`, and `Stock Receipt`.

Use recognised medical terminology and local clinical policy to review each concept before production. This catalogue has not been assigned verified SNOMED CT, LOINC, ICD-11, ATC, or UCUM codes automatically; external mappings must be clinically validated and licensed where applicable. Short names should remain readable in DHIS2 Capture. Avoid changing existing option value codes and preserve all 11-character metadata UIDs.

The accompanying `Metadata_Name_Changes.csv` records each exact UID, code, prior name and updated name. Codes and UIDs remain unchanged. Some similar clinical phrases may still refer to different measurement contexts; do not merge them without a semantic and dependency review.

## 1. Metadata coding specification

The approved format is **`SSTTNNNN`**, exactly eight uppercase alphanumeric characters. `SS` is the owner service or cross-cutting domain, `TT` is the two-letter metadata object type, and `NNNN` is a zero-padded four-digit sequence from 0001 through 9999. Codes never change when names change; sequences must not be recycled. An 11-character DHIS2 UID remains the authoritative reference.

| Example code | Meaning |
|---|---|
| `OPPG0001` | Outpatient program |
| `IPPS0001` | Inpatient program stage |
| `VSDE0001` | Shared vital-sign data element |
| `PTTA0001` | Patient tracked entity attribute |
| `LBOS0001` | Laboratory option set |
| `OPPR0001` | Outpatient program rule |
| `OPPI0001` | Outpatient program indicator |

**Metadata type dictionary:** `TE` tracked entity type; `TA` tracked entity attribute; `OS` option set; `OP` option; `DE` data element; `PG` program; `PS` program stage; `SC` program stage section; `PV` program rule variable; `PR` program rule; `PA` program rule action; `PI` program indicator; `RT` relationship type.

**Cross-cutting domain dictionary:** `GN` general/shared, `PT` patient identity, `VS` vital signs, `DX` diagnosis, `MD` medicines, `AL` allergies, `RF` referral, `WF` workflow, `BL` billing, `LB` laboratory, `AU` audit, `SC` screening, `HS` clinical history. These are governed ownership prefixes rather than statements that a field is physically stored in every program.

**Service ownership prefixes:** `OP` Integrated Outpatient EMR, `IP` Integrated Inpatient EMR, `IV` Inventory and Supplies Tracker, `ER` Emergency and Resuscitation, `AN` Maternal Antenatal Care, `MT` Maternity Labour and Delivery, `PN` Postnatal and Newborn Follow-up, `IM` Child Health and Immunisation, `HV` HIV Care and ART, `TB` Tuberculosis and Leprosy Care, `NC` NCD Diabetes and Hypertension, `ON` Cancer and Oncology, `MH` Mental Health and Psychiatry, `SU` Surgical and Theatre Services, `DN` Dental and Oral Health, `EY` Eye and Vision Care, `EN` ENT Services, `RH` Rehabilitation and Physiotherapy, `RN` Renal Care and Dialysis, `FP` Family Planning and Reproductive Health, `LB` Laboratory Diagnostics, `RD` Imaging and Radiology, `BB` Blood Bank and Transfusion, `NU` Nutrition and Dietetics, `EQ` Facility Equipment and Maintenance, `IC` Hospital Infection Prevention and Control.

### 1.1 Cross-cutting metadata and reusable definitions

A data element or option set is classed as cross-cutting when referenced by multiple programs or owned by an explicitly shared clinical domain. Reuse is based on equivalent semantic definition, value type, unit, and option set, not on a similar label alone. See `Metadata_Code_Registry.csv` for each exact UID, code, classification and actual program use.

### 1.2 Option code preservation and patient data safety

**Exception:** DHIS2 option `code` values are clinical data values, so existing options retain their original DHIS2 codes. Each option also receives an eight-character **DER catalogue alias** (`SSOPNNNN`) stored in `Option_Code_Alias_Map.json`, but not substituted for the option code in import metadata. Otherwise historical data and rules could break. New option sets may adopt the DER code as the actual option code only before any values have been recorded and after integration review.

### 1.3 DHIS2 metadata references

All original UIDs are retained. Program, stage, variable, rule, indicator, data element, tracked entity type, tracked entity attribute, and option-set metadata receive an eight-character `code`. Foreign-key relationships remain UID-based. Option values are intentionally unchanged. Any external API or ETL using legacy metadata codes must be migrated deliberately, by UID lookup or the registry’s previous-code mapping.

## 2. Package composition and counts

| Metadata type | Count |
|---|---:|
| trackedEntityTypes | 3 |
| trackedEntityAttributes | 16 |
| optionSets | 61 |
| options | 316 |
| dataElements | 624 |
| programs | 26 |
| programStages | 163 |
| programRuleVariables | 8 |
| programRules | 8 |
| programRuleActions | 8 |
| programIndicators | 26 |

Total registry entries: **1259**. Cross-cutting registry entries: **172**. Preserved option data codes: **316**.

## 3. Program ownership and code index

| Code | Program | Stage count |
|---|---|---:|
| `OPPG0001` | Integrated Outpatient EMR | 18 |
| `IPPG0001` | Integrated Inpatient EMR | 35 |
| `IVPG0001` | Inventory and Supplies Tracker | 13 |
| `ERPG0001` | Emergency and Resuscitation | 6 |
| `ANPG0001` | Antenatal Care | 5 |
| `MTPG0001` | Labour and Delivery Care | 6 |
| `PNPG0001` | Postnatal and Newborn Follow-up | 4 |
| `IMPG0001` | Child Health and Immunisation | 6 |
| `HVPG0001` | HIV Care and Antiretroviral Therapy | 5 |
| `TBPG0001` | Tuberculosis and Leprosy Care | 6 |
| `NCPG0001` | Diabetes and Hypertension Care | 5 |
| `ONPG0001` | Cancer and Oncology | 6 |
| `MHPG0001` | Mental Health and Psychiatry | 4 |
| `SUPG0001` | Surgical and Theatre Services | 5 |
| `DNPG0001` | Dental and Oral Health | 3 |
| `EYPG0001` | Eye and Vision Care | 3 |
| `ENPG0001` | Ear, Nose and Throat Services | 3 |
| `RHPG0001` | Rehabilitation and Physiotherapy | 3 |
| `RNPG0001` | Renal Care and Dialysis | 3 |
| `FPPG0001` | Family Planning and Reproductive Health | 3 |
| `LBPG0001` | Laboratory Diagnostics | 5 |
| `RDPG0001` | Imaging and Radiology | 3 |
| `BBPG0001` | Blood Bank and Transfusion | 3 |
| `NUPG0001` | Nutrition and Dietetics | 3 |
| `EQPG0001` | Facility Equipment and Maintenance | 4 |
| `ICPG0001` | Hospital Infection Prevention and Control | 3 |

## 4. Service-point stage coding and workflow references

Each program stage is an event capture point, not a new tracked entity. The complete workflow specification follows this index. Linked medication orders, stock changes, payment transactions, and device handoffs remain transactionally controlled in their authoritative DER services.

### Integrated Outpatient EMR (`OPPG0001`)
- **`OPPS0016` - Registration Verification** (repeatable): Identity Verified, Registration Notes.
- **`OPPS0018` - Visit Check-in** (repeatable): Visit Reference, Requested Service, Check-in Time, Queue Number, Visit Payment Category.
- **`OPPS0017` - Triage and Vital Signs** (repeatable): Visit Reference, Triage Category, Temperature Celsius, Systolic Blood Pressure, Diastolic Blood Pressure, Heart Rate, Respiratory Rate, Oxygen Saturation Percent, Weight Kg, Height Cm.
- **`OPPS0004` - Clinical Consultation** (repeatable): Visit Reference, Reason for Visit, History of Present Illness, Clinical Examination, Provisional Diagnosis, Final Diagnosis, Clinical Plan.
- **`OPPS0009` - Laboratory Request** (repeatable): Visit Reference, Order Reference, Laboratory Test Requested, Order Priority, Specimen Type, Request Indication, Request Status.
- **`OPPS0011` - Laboratory Specimen Collection** (repeatable): Visit Reference, Order Reference, Specimen Identifier, Collection Date Time, Specimen Received Date Time, Specimen Notes.
- **`OPPS0010` - Laboratory Results** (repeatable): Visit Reference, Order Reference, Laboratory Test Name, Laboratory Result Value, Laboratory Result Interpretation, Laboratory Result Units, Laboratory Reference Range, Laboratory Report Date Time, Critical Result Escalated.
- **`OPPS0008` - Imaging Request** (repeatable): Visit Reference, Order Reference, Imaging Modality, Imaging Body Site, Imaging Clinical Indication, Order Priority.
- **`OPPS0007` - Imaging Report** (repeatable): Visit Reference, Order Reference, Imaging Findings, Imaging Impression, Imaging Performed Date Time.
- **`OPPS0014` - Procedure and Treatment** (repeatable): Visit Reference, Order Reference, Procedure Name, Procedure Date Time, Procedure Outcome, Adverse Event.
- **`OPPS0013` - Prescription** (repeatable): Visit Reference, Order Reference, Medicine Prescribed, Prescribed Dose, Dose Unit, Route of Administration, Frequency, Duration Days, Quantity Prescribed.
- **`OPPS0012` - Pharmacy Dispensing** (repeatable): Visit Reference, Order Reference, Medicine Dispensed, Quantity Dispensed, Dispensing Date Time, Dispensing Notes.
- **`OPPS0001` - Billing Charge** (repeatable): Visit Reference, Invoice Reference, Charge Line Reference, Charge Service Category, Charge Description, Charge Quantity, Charge Unit Price UGX, Charge Gross Amount UGX, Charge Discount Amount UGX, Charge Net Amount UGX.
- **`OPPS0003` - Billing Payment** (repeatable): Visit Reference, Invoice Reference, Payment Reference, Payment Method, Payment Amount UGX, Payment Date Time, Payment Status, External Transaction Reference, Payment Notes.
- **`OPPS0002` - Billing Clearance** (repeatable): Visit Reference, Invoice Reference, Billing Balance UGX, Billing Clearance Granted, Billing Clearance Reason, Billing Clearance Date Time.
- **`OPPS0005` - Clinical Review and Disposition** (repeatable): Visit Reference, Disposition, Clinical Outcome, Discharge Summary, Follow-up Date, Return Precautions.
- **`OPPS0015` - Referral and Transfer** (repeatable): Visit Reference, Referral Type, Referral Destination, Referral Reason, Referral Date, Referral Status.
- **`OPPS0006` - Follow-up Encounter** (repeatable): Visit Reference, Follow-up Findings, Clinical Outcome, Follow-up Date.

### Integrated Inpatient EMR (`IPPG0001`)
- **`IPPS0002` - Admission Request and Bed Booking** (once per enrollment): Admission Request ID, Originating OPD Event ID, Proposed Admission Type, Requested Ward, Bed Request Time, Booking Outcome.
- **`IPPS0003` - Admission and Identity Verification** (once per enrollment): Admission ID, Admission Date and Time, Referred From, Admission Source, Reason for Admission, Admission Diagnosis, Admitting Clinician, Assigned Ward, Assigned Bed, Encounter ID.
- **`IPPS0015` - Initial Nursing Assessment** (repeatable): Encounter ID, Assessment Time, Presenting Concerns, Temperature Celsius, Pulse Per Minute, Respiratory Rate Per Minute, Systolic BP, Diastolic BP, Oxygen Saturation Percent, Pain Score.
- **`IPPS0001` - Admission History and Physical** (repeatable): Encounter ID, History of Present Illness, Past Medical History, Surgical History, Allergy Description, Current Medicines, Physical Examination, Working Diagnosis, Care Plan, Clinical Priority.
- **`IPPS0024` - Patient Problems and Diagnoses** (repeatable): Encounter ID, Diagnosis Code, Diagnosis Description, Diagnosis Classification, Diagnosis Onset Date, Diagnosis Status, Responsible Clinician.
- **`IPPS0035` - Ward Round and Clinical Progress** (repeatable): Encounter ID, Round Time, Progress SOAP Subjective, Progress SOAP Objective, Progress SOAP Assessment, Progress SOAP Plan, Consultant ID, Workflow Status.
- **`IPPS0033` - Vital Signs and Early Warning** (repeatable): Encounter ID, Measurement Time, Temperature Celsius, Pulse Per Minute, Respiratory Rate Per Minute, Systolic BP, Diastolic BP, Oxygen Saturation Percent, Oxygen Delivery, Glasgow Coma Score.
- **`IPPS0022` - Medication Reconciliation** (repeatable): Encounter ID, Medication Name, Home Medication Dose, Home Medication Frequency, Medication Reconciliation Action, Reconciliation Reason, Reviewed By.
- **`IPPS0021` - Medication Prescription** (repeatable): Encounter ID, Prescription ID, Medication Order ID, Medicine Code, Medicine Name, Dose, Dose Unit, Route, Frequency, Start Date Time.
- **`IPPS0026` - Pharmacy Verification and Issue** (repeatable): Encounter ID, Prescription ID, Medication Order ID, Dispensing ID, Medicine Code, Quantity Issued, Batch Number, Expiry Date, Pharmacist ID, Workflow Status.
- **`IPPS0020` - Medication Administration Record** (repeatable): Encounter ID, Medication Order ID, Scheduled Dose Time, Actual Administration Time, Dose Administered, Dose Unit, Route, Administration Outcome, Omission Reason, Administered By.
- **`IPPS0017` - Intravenous Fluids and Infusions** (repeatable): Encounter ID, Infusion Order ID, Fluid Type, Total Volume ML, Infusion Rate ML Per Hour, Start Date Time, End Date Time, Administration Outcome, Recorded By.
- **`IPPS0018` - Laboratory Investigation Request** (repeatable): Encounter ID, Laboratory Request ID, Test Order ID, Test Code, Test Name, Sample Type, Clinical Indication, Clinical Priority, Request Time, Workflow Status.
- **`IPPS0031` - Specimen Collection and Handover** (repeatable): Encounter ID, Laboratory Request ID, Specimen ID, Collection Time, Sample Type, Collector ID, Specimen Condition, Handover Time, Workflow Status.
- **`IPPS0019` - Laboratory Results and Validation** (repeatable): Encounter ID, Laboratory Request ID, Test Order ID, Specimen ID, Test Code, Result Value, Result Unit, Reference Range, Result Interpretation, Result Time.
- **`IPPS0013` - Imaging and Diagnostics Request** (repeatable): Encounter ID, Imaging Request ID, Imaging Modality, Body Region, Clinical Indication, Clinical Priority, Request Time, Workflow Status.
- **`IPPS0012` - Imaging Result and Report** (repeatable): Encounter ID, Imaging Request ID, Study Reference, Study Date Time, Report Findings, Report Impression, Reporting Clinician, Critical Result Alert, Workflow Status.
- **`IPPS0029` - Procedure and Intervention** (repeatable): Encounter ID, Procedure ID, Procedure Code, Procedure Name, Procedure Date Time, Consent Status, Procedure Notes, Procedure Outcome, Procedure Clinician, Complications.
- **`IPPS0032` - Surgery and Operating Theatre** (repeatable): Encounter ID, Surgery ID, Surgical Procedure, Preoperative Diagnosis, Surgery Start Time, Surgery End Time, Surgeon ID, Anesthesia Type, Safety Checklist Complete, Operation Notes.
- **`IPPS0027` - Post Anaesthesia and Recovery** (repeatable): Encounter ID, Surgery ID, Recovery Start Time, Recovery Score, Airway Status, Pain Score, Complications, Recovery Disposition, Receiving Staff.
- **`IPPS0023` - Nursing Care Plan and Interventions** (repeatable): Encounter ID, Nursing Problem, Nursing Intervention, Care Goal, Intervention Date Time, Response to Care, Responsible Nurse, Workflow Status.
- **`IPPS0016` - Intake Output and Fluid Balance** (repeatable): Encounter ID, Observation Time, Intake Type, Intake Volume ML, Output Type, Output Volume ML, Shift, Fluid Balance Note.
- **`IPPS0006` - Blood and Transfusion** (repeatable): Encounter ID, Transfusion Order ID, Blood Product Code, Blood Unit Identifier, Compatibility Result, Transfusion Start, Transfusion End, Transfusion Outcome, Adverse Reaction.
- **`IPPS0007` - Consultation and Specialty Review** (repeatable): Encounter ID, Consultation Request ID, Specialty, Reason for Consultation, Consultation Date Time, Clinical Opinion, Recommendations, Consultant ID, Workflow Status.
- **`IPPS0034` - Ward Bed Transfer and Handover** (repeatable): Encounter ID, Transfer ID, From Ward, From Bed, To Ward, To Bed, Transfer Reason, Transfer Time, Handover Summary, Receiving Staff.
- **`IPPS0008` - Critical Care and Escalation** (repeatable): Encounter ID, Escalation Time, Escalation Trigger, Escalation Level, Critical Care Plan, Responsible Clinician, Workflow Status.
- **`IPPS0004` - Allied Health and Rehabilitation** (repeatable): Encounter ID, Service Category, Assessment Summary, Intervention, Session Date Time, Progress Note, Follow Up Required.
- **`IPPS0014` - Infection Prevention and Isolation** (repeatable): Encounter ID, Infection Risk, Isolation Type, Isolation Start, Isolation End, Infection Control Action, Infection Control Review.
- **`IPPS0005` - Billing Charge and Claims** (repeatable): Encounter ID, Charge ID, Charge Source Event ID, Charge Item Code, Charge Amount, Currency Code, Payer Type, Claim Reference, Payment Status.
- **`IPPS0025` - Payment and Financial Clearance** (repeatable): Encounter ID, Invoice ID, Payment Reference, Payment Amount, Currency Code, Payment Method, Payment Status, Waiver or Exemption, Financial Clearance Status.
- **`IPPS0010` - Discharge Planning and Education** (repeatable): Encounter ID, Estimated Discharge Date, Discharge Education, Home Medicines, Follow Up Appointment, Discharge Barriers, Caregiver Instructions, Workflow Status.
- **`IPPS0011` - Discharge Summary and Disposition** (once per enrollment): Encounter ID, Discharge Date Time, Final Diagnosis, Secondary Diagnoses, Treatment Summary, Procedures Summary, Discharge Medicines, Discharge Condition, Disposition, Follow Up Plan.
- **`IPPS0030` - Referral Transfer Out and Continuity** (repeatable): Encounter ID, Referral ID, Receiving Facility, Referral Reason, Referral Priority, Transfer Time, Receiving Contact, Handover Completed, Referral Status.
- **`IPPS0009` - Death and Mortuary Handover** (once per enrollment): Encounter ID, Date Time of Death, Death Certification Reference, Cause of Death Summary, Certifying Clinician, Mortuary Transfer Reference, Family Notified.
- **`IPPS0028` - Post Discharge Follow-up and Readmission** (repeatable): Encounter ID, Follow Up Date, Follow Up Outcome, Complication Identified, Readmission Reference, Follow Up Plan.

### Inventory and Supplies Tracker (`IVPG0001`)
- **`IVPS0006` - INV - Opening Balance and Stocktake** (repeatable): INV - Opening Quantity, INV - Count Date, INV - Stock Location, INV - Batch or Lot Number, INV - Expiry Date, INV - Count Reference, INV - Approved By.
- **`IVPS0004` - INV - Goods Receipt** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID.
- **`IVPS0005` - INV - Issue to Service Point** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID.
- **`IVPS0002` - INV - Department Receipt** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID.
- **`IVPS0007` - INV - Patient Dispensing** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID.
- **`IVPS0001` - INV - Clinical Consumption** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID.
- **`IVPS0009` - INV - Return and Quarantine** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID.
- **`IVPS0013` - INV - Stock Transfer Dispatch** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID.
- **`IVPS0003` - INV - Expiry Damage and Disposal** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID.
- **`IVPS0010` - INV - Stock Adjustment** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID.
- **`IVPS0012` - INV - Stock Reservation** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID.
- **`IVPS0011` - INV - Stock Requisition** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID.
- **`IVPS0008` - INV - Procurement and Replenishment** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID.

### Emergency and Resuscitation (`ERPG0001`)
- **`ERPS0001` - Arrival and Emergency Registration** (repeatable): Arrival mechanism, Urgency, Presenting complaint, Encounter reference.
- **`ERPS0005` - Emergency Triage** (repeatable): Clinical acuity, Systolic BP (mmHg), Heart rate (per min), SpO2 (%), Red flag finding.
- **`ERPS0006` - Primary Survey and Resuscitation** (repeatable): Airway status, Breathing status, Circulation status, Resuscitation intervention, Time of intervention.
- **`ERPS0002` - Emergency Consultation and Orders** (repeatable): Clinical note, Diagnosis code, Order reference, Prescription reference.
- **`ERPS0004` - Emergency Procedures and Observation** (repeatable): Procedure code, Procedure status, Clinical result, Observation note.
- **`ERPS0003` - Emergency Disposition and Handover** (repeatable): Encounter disposition, Referral reference, Handover recipient, Handover time.

### Antenatal Care (`ANPG0001`)
- **`ANPS0003` - ANC Registration and Pregnancy Dating** (once per enrollment): Last menstrual period, Estimated delivery date, Gravidity, Parity, Pregnancy risk history.
- **`ANPS0005` - ANC Visit and Risk Assessment** (repeatable): Gestational age weeks, Systolic BP (mmHg), Diastolic BP (mmHg), Weight (kg), Danger signs.
- **`ANPS0004` - ANC Screening and Diagnostics** (repeatable): HIV test result, Syphilis screening, Haemoglobin (g/dL), Ultrasound order reference, Clinical result.
- **`ANPS0001` - ANC Preventive Care and Counselling** (repeatable): Preventive intervention, Supplement issued, Counselling note, Follow-up appointment.
- **`ANPS0002` - ANC Referral and Outcome** (repeatable): Referral reference, Pregnancy outcome, Outcome date.

### Labour and Delivery Care (`MTPG0001`)
- **`MTPS0002` - Labour Admission** (once per enrollment): Gestational age weeks, Labour onset time, Maternal risk note.
- **`MTPS0003` - Labour Monitoring** (repeatable): Cervical dilatation cm, Fetal heart rate, Contraction frequency, Systolic BP (mmHg).
- **`MTPS0005` - Obstetric Intervention** (repeatable): Procedure code, Intervention indication, Procedure status.
- **`MTPS0001` - Delivery and Birth Record** (repeatable): Birth mode, Birth date and time, Birth outcome, Birth weight (g), Newborn linked patient identifier.
- **`MTPS0006` - Postpartum Immediate Care** (repeatable): Estimated blood loss (mL), Postpartum complication, Maternal disposition.
- **`MTPS0004` - Maternity Discharge and Handover** (once per enrollment): Discharge date, Follow-up appointment, Referral reference.

### Postnatal and Newborn Follow-up (`PNPG0001`)
- **`PNPS0003` - Postnatal Enrollment** (once per enrollment): Delivery date, Delivery facility, Mother linked patient identifier.
- **`PNPS0004` - Postnatal Maternal Assessment** (repeatable): Systolic BP (mmHg), Danger signs, Breastfeeding counselling.
- **`PNPS0001` - Newborn Assessment** (repeatable): Birth weight (g), Weight (kg), Newborn danger signs, Jaundice assessment.
- **`PNPS0002` - Postnatal Counselling and Referral** (repeatable): Counselling note, Referral reference, Follow-up status.

### Child Health and Immunisation (`IMPG0001`)
- **`IMPS0003` - Child Registration and Eligibility** (once per enrollment): Caregiver identifier, Birth date verified, Vaccination card reference.
- **`IMPS0004` - Growth and Nutrition Assessment** (repeatable): Weight (kg), Height (cm), MUAC (mm), Nutrition classification.
- **`IMPS0005` - Immunisation Due Assessment** (repeatable): Vaccine antigen code, Dose sequence, Vaccination status, Due date.
- **`IMPS0006` - Vaccination Administration** (repeatable): Vaccine antigen code, Dose sequence, Vaccine lot number, Administration date, Vaccinator identifier.
- **`IMPS0001` - Adverse Event Following Immunisation** (repeatable): AEFI onset, AEFI severity, AEFI clinical description, Referral reference.
- **`IMPS0002` - Child Clinical Review and Referral** (repeatable): Clinical note, Diagnosis code, Referral reference.

### HIV Care and Antiretroviral Therapy (`HVPG0001`)
- **`HVPS0004` - HIV Enrollment and Baseline** (once per enrollment): Confirmed diagnosis date, ART start date, Baseline clinical stage, Treatment regimen code.
- **`HVPS0002` - HIV Clinical Follow-up** (repeatable): Weight (kg), Clinical note, Treatment adherence, Next review date.
- **`HVPS0005` - HIV Laboratory Monitoring** (repeatable): Viral load copies/mL, CD4 count, Specimen reference, Clinical result.
- **`HVPS0001` - ART Prescription and Dispensing** (repeatable): Prescription reference, Treatment regimen code, Quantity, Stock transaction reference.
- **`HVPS0003` - HIV Differentiated Service and Referral** (repeatable): Service delivery model, Referral reference, Follow-up status.

### Tuberculosis and Leprosy Care (`TBPG0001`)
- **`TBPS0003` - TB/Leprosy Screening and Classification** (once per enrollment): Disease classification, Symptoms duration days, Diagnosis code, Index case reference.
- **`TBPS0002` - Microbiology and Diagnostic Workup** (repeatable): Specimen reference, Molecular test result, Smear result.
- **`TBPS0005` - Treatment Initiation** (once per enrollment): Treatment start date, Treatment regimen code, Treatment phase.
- **`TBPS0004` - Treatment Adherence and Follow-up** (repeatable): Treatment adherence, Weight (kg), Treatment adverse effect.
- **`TBPS0001` - Contact Tracing and Referral** (repeatable): Contact patient identifier, Screening result, Referral reference.
- **`TBPS0006` - Treatment Outcome** (once per enrollment): TB outcome, Outcome date.

### Diabetes and Hypertension Care (`NCPG0001`)
- **`NCPS0003` - NCD Enrollment and Risk Profile** (once per enrollment): Diabetes type, Hypertension diagnosis, Cardiovascular risk factors.
- **`NCPS0004` - NCD Review and Vitals** (repeatable): Systolic BP (mmHg), Diastolic BP (mmHg), Weight (kg), Clinical note.
- **`NCPS0001` - Diabetes Laboratory Monitoring** (repeatable): HbA1c (%), Fasting glucose (mmol/L), Urine albumin result.
- **`NCPS0002` - NCD Complications Screening** (repeatable): Foot exam result, Retinal screening result, Renal risk note.
- **`NCPS0005` - NCD Treatment and Review** (repeatable): Prescription reference, Treatment adherence, Follow-up appointment.

### Cancer and Oncology (`ONPG0001`)
- **`ONPS0002` - Oncology Registration and Diagnosis** (once per enrollment): Primary cancer site code, Histology terminology code, Diagnosis date, Stage at diagnosis.
- **`ONPS0001` - Multidisciplinary Tumour Board** (repeatable): Decision date, Clinical note, Care plan status.
- **`ONPS0006` - Systemic Therapy Plan and Cycle** (repeatable): Protocol code, Cycle number, Treatment administration date, Treatment adverse effect.
- **`ONPS0005` - Surgery and Radiation Coordination** (repeatable): Procedure code, Radiotherapy course reference, Procedure status.
- **`ONPS0003` - Oncology Response and Survivorship** (repeatable): Treatment response code, Clinical note, Follow-up appointment.
- **`ONPS0004` - Palliative Oncology and Outcome** (repeatable): Pain score (0-10), Palliative intervention, Outcome date.

### Mental Health and Psychiatry (`MHPG0001`)
- **`MHPS0001` - Mental Health Intake and Consent** (once per enrollment): Presenting concern, Consent status, Mental health risk.
- **`MHPS0003` - Mental Status and Risk Assessment** (repeatable): Mental state examination, Suicide risk note, Mental health risk.
- **`MHPS0002` - Mental Health Treatment Planning** (repeatable): Diagnosis code, Care plan status, Prescription reference.
- **`MHPS0004` - Psychotherapy and Follow-up** (repeatable): Therapy session summary, Follow-up status, Referral reference.

### Surgical and Theatre Services (`SUPG0001`)
- **`SUPS0004` - Surgical Booking and Consent** (once per enrollment): Planned procedure code, Surgery date, Consent status.
- **`SUPS0003` - Preoperative Assessment** (repeatable): Anaesthesia risk classification, Preoperative findings, Procedure status.
- **`SUPS0005` - Theatre Safety Checklist** (repeatable): Sign-in completed, Time-out completed, Sign-out completed.
- **`SUPS0001` - Operative Record** (repeatable): Procedure code, Procedure start time, Procedure end time, Operative note, Wound classification.
- **`SUPS0002` - Postoperative and Surgical Review** (repeatable): Pain score (0-10), Postoperative complication, Follow-up appointment.

### Dental and Oral Health (`DNPG0001`)
- **`DNPS0001` - Dental Assessment** (repeatable): Tooth notation system, Tooth identifier, Dental finding code, Pain score (0-10).
- **`DNPS0003` - Dental Procedure and Treatment** (repeatable): Tooth identifier, Procedure code, Procedure status, Prescription reference.
- **`DNPS0002` - Dental Follow-up** (repeatable): Clinical note, Follow-up appointment.

### Eye and Vision Care (`EYPG0001`)
- **`EYPS0003` - Ophthalmology Screening** (repeatable): Visual acuity left, Visual acuity right, Presenting symptom.
- **`EYPS0002` - Ophthalmology Examination** (repeatable): Intraocular pressure left, Intraocular pressure right, Eye finding code.
- **`EYPS0001` - Eye Procedure and Referral** (repeatable): Procedure code, Referral reference, Follow-up appointment.

### Ear, Nose and Throat Services (`ENPG0001`)
- **`ENPS0001` - ENT Assessment** (repeatable): ENT chief complaint, Otoscopy finding, Hearing screening result.
- **`ENPS0002` - ENT Investigation and Procedure** (repeatable): Order reference, Procedure code, Clinical result.
- **`ENPS0003` - ENT Review and Referral** (repeatable): Clinical note, Referral reference.

### Rehabilitation and Physiotherapy (`RHPG0001`)
- **`RHPS0001` - Rehabilitation Intake** (once per enrollment): Functional baseline scale, Therapy goal.
- **`RHPS0003` - Rehabilitation Session** (repeatable): Therapy intervention code, Session duration minutes, Functional outcome score.
- **`RHPS0002` - Rehabilitation Reassessment and Discharge** (repeatable): Functional outcome score, Discharge recommendation.

### Renal Care and Dialysis (`RNPG0001`)
- **`RNPS0003` - Renal Assessment and Access** (once per enrollment): Renal diagnosis code, Vascular access type, Baseline renal function note.
- **`RNPS0002` - Dialysis Session** (repeatable): Dialysis session status, Pre dialysis weight kg, Post dialysis weight kg, Dialysis duration minutes.
- **`RNPS0001` - Dialysis Complication and Review** (repeatable): Complication note, Referral reference, Follow-up appointment.

### Family Planning and Reproductive Health (`FPPG0001`)
- **`FPPS0002` - Family Planning Counselling** (repeatable): Method preference, Counselling note, Consent status.
- **`FPPS0001` - Contraceptive Service** (repeatable): Contraceptive method code, Quantity, Procedure code, Service date.
- **`FPPS0003` - Family Planning Follow-up** (repeatable): Adverse effect note, Follow-up status.

### Laboratory Diagnostics (`LBPG0001`)
- **`LBPS0002` - Laboratory Order Intake** (repeatable): Order reference, Encounter reference, Test catalogue code, Specimen reference, Order status.
- **`LBPS0005` - Specimen Collection and Accession** (repeatable): Specimen reference, Specimen status, Collection date and time.
- **`LBPS0004` - Laboratory Test Processing** (repeatable): Test catalogue code, Analyzer reference, Quality control result, Clinical result.
- **`LBPS0003` - Laboratory Results and Validation** (repeatable): Order reference, Result value text, Result units, Reference interval, Result authorised by.
- **`LBPS0001` - Laboratory Critical Result Communication** (repeatable): Critical result alert, Notified clinician ID, Notification time.

### Imaging and Radiology (`RDPG0001`)
- **`RDPS0003` - Imaging Request and Scheduling** (repeatable): Order reference, Modality code, Body site code, Appointment date.
- **`RDPS0001` - Imaging Acquisition** (repeatable): Imaging study identifier, Contrast administered, Procedure status.
- **`RDPS0002` - Imaging Reporting and Communication** (repeatable): Imaging study identifier, Radiology report, Clinical result, Reported date.

### Blood Bank and Transfusion (`BBPG0001`)
- **`BBPS0003` - Transfusion Request and Eligibility** (repeatable): Order reference, Blood component code, Units requested, Clinical indication.
- **`BBPS0001` - Crossmatch and Component Issue** (repeatable): Blood unit identifier, Blood compatibility, Issue date and time.
- **`BBPS0002` - Transfusion Administration and Monitoring** (repeatable): Blood unit identifier, Start date and time, End date and time, Transfusion reaction.

### Nutrition and Dietetics (`NUPG0001`)
- **`NUPS0003` - Nutrition Screening** (repeatable): Weight (kg), Height (cm), MUAC (mm), Nutrition classification.
- **`NUPS0002` - Nutrition Plan and Counselling** (repeatable): Diet plan reference, Counselling note, Care plan status.
- **`NUPS0001` - Nutrition Monitoring** (repeatable): Weight (kg), Nutrition response, Follow-up appointment.

### Facility Equipment and Maintenance (`EQPG0001`)
- **`EQPS0003` - Equipment Registration** (once per enrollment): Asset identifier, Equipment category, Manufacturer, Serial number, Equipment location.
- **`EQPS0004` - Preventive Maintenance** (repeatable): Maintenance date, Maintenance outcome, Next maintenance date.
- **`EQPS0001` - Equipment Breakdown and Repair** (repeatable): Fault reported at, Repair action, Equipment return to service.
- **`EQPS0002` - Equipment Decommissioning** (once per enrollment): Decommission date, Decommission reason.

### Hospital Infection Prevention and Control (`ICPG0001`)
- **`ICPS0002` - IPC Incident Notification** (repeatable): Incident reference, Incident date, IPC event classification, Service point.
- **`ICPS0003` - IPC Investigation and Measures** (repeatable): Investigation findings, Intervention action, Care plan status.
- **`ICPS0001` - IPC Closure and Review** (repeatable): Closure date, Lessons learned.

## 5. Metadata code and integration acceptance checklist

1. Export current DHIS2 metadata and patient data backup; verify none of the candidate UIDs collides with unrelated objects.
2. Review `Metadata_Code_Registry.csv` for external code dependencies, and compare all pre-existing codes with third-party mappings.
3. Apply shared foundation first, then programs/stages, then program rules/indicators; only proceed when each import report has no critical errors.
4. Validate program rules, rule variables, rule actions, option codes, and program indicators against the target DHIS2 release in a staging instance.
5. Validate clinical data values, units, permissible value ranges, terminology catalogue and the configured national health reporting package.
6. Confirm users, organisation units, sharing configuration and program access levels.
7. Run offline and WAN recovery scenarios, with event/relationship reconciliation and duplicate financial and stock transaction prevention.
8. Reconcile clinical indicators against authoritative hospital registers before production activation.

## 6. Complete hospital workflow documentation (preserved from edition 1)

# DER General Hospital: Integrated DHIS2 Tracker and Operational Architecture
**Reference implementation specification | Revision 1.0 | 10 November 2026**

**Scope:** General hospital with OPD, emergency, IPD, maternity, specialised clinics, diagnostic services, pharmacy, inventory, billing, and governance. **Targets:** DHIS2 2.41, 2.42, 2.43 and 2.44. **Status:** locally generated reference metadata; no successful live metadata import or program-rule validation has been performed.

> **Clinical safety and deployment boundary:** This is an implementation baseline, not a certified EMR, a national clinical terminology package, a complete prescribing engine, or approval to run clinical care. Clinical protocols, drug catalogues, controlled vocabularies, national reporting requirements, patient consent and regulated workflows must be validated and approved locally before deployment.

## 1. Architecture, authority and data boundaries
A single **shared Patient Tracked Entity Type** and stable patient identifier are used across OPD, IPD, emergency and specialty programs. One patient can have separate enrollments in different programs. OPD is longitudinal; IPD is episode-based (one enrollment per admission). Emergency and referral pathways may launch linked encounters. A new program enrollment is **not** a new patient.

| Layer | DHIS2 representation | Authoritative service |
|---|---|---|
| Identity | Patient tracked entity + attributes | Master patient index / trusted identity governance |
| Clinical programs | Tracker programs, stages, events | Configured clinical capture and approved record source |
| Visit or admission | OPD encounter reference; IPD enrollment | DER encounter coordinator |
| Orders and fulfilment | Order/result event references and eligible native relationships | DER order engine or LIS/RIS/pharmacy system |
| Inventory | Commodity Tracker reporting plus movement references | DER inventory ledger or designated eLMIS |
| Billing | Clinical charge/payment summary events | Financial ledger, payment gateway or HIS |
| Reporting | Program indicators and aggregate reporting | DHIS2 analytics and nationally approved HMIS indicators |
| Files and images | Identifiers or metadata references | PACS, DMS or secure attachment storage |

### Identity and data-model constraints
- Do not create an unrelated Patient TE type for every clinic. The Inventory package retains a separate commodity TE; Equipment uses an equipment TE. These are not persons.
- Reuse existing patient identifiers and, after MPI review, link duplicate candidates through a controlled merge workflow; do not auto-merge by name.
- Separate **patient**, **program enrollment**, **visit/encounter**, **service event**, **order**, **result**, **prescription**, **administration**, **dispensing**, **stock movement** and **charge/payment** identities.
- Use reference identifiers inside event fields only for retrieval and interoperability. A text reference alone is **not** a DHIS2 native relationship. Configure eligible native relationshipTypes on the target instance and mirror operational references in DER.
- Multi-test orders and multi-item prescriptions are collections in a transactional DER/LIS/pharmacy model; Tracker repeatable events are derived interoperable representations where appropriate.

## 2. Hospital patient pathways
### 2.1 OPD pathway
Patient identity search -> visit check-in -> triage/vitals -> consultation -> parallel laboratory, imaging, procedures, pharmacy and billing -> clinician review -> disposition/referral/follow-up. Billing charges may arise at each service point; emergency care must not be blocked for payment.

### 2.2 Emergency pathway
Arrival -> acuity triage -> resuscitation if indicated -> clinical decision and orders -> observation or procedure -> home / urgent referral / hospital admission / transfer. Emergent life-saving care bypasses routine payment clearance.

### 2.3 IPD pathway
Decision to admit -> bed request and admission -> initial physician/nursing assessment -> daily rounds/medication administration/orders/procedures and multidisciplinary reviews -> transfers and intensive care where needed -> discharge medication/billing/summary/follow-up. A new IPD enrollment is created for a new admission, not for every ward round.

### 2.4 Specialty pathways
Each specialty has its own longitudinal enrollment when care requires specific longitudinal context (HIV, NCD, oncology, TB, ANC) or encounter-cycle enrollment when episodic care requires separate episodes (surgery, emergency, childbirth). Internal stages serve as service-point milestones, not independent copies of the patient.

## 3. Program catalogue and stage-by-stage workflows
The lists below specify purpose and data collection points for every generated specialty program. Existing OPD/IPD/inventory stage details remain in their accompanying specifications, preserved and referenced in the package. Actual clinical decisions must use approved clinical guidance.

### Emergency and Resuscitation
**Enrollment policy:** repeatable episode-based enrollment. **Tracked entity:** shared patient.

**1. Arrival and Emergency Registration** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Arrival mechanism, Urgency, Presenting complaint, Encounter reference. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Emergency Triage** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Clinical acuity, Systolic BP (mmHg), Heart rate (per min), SpO2 (%), Red flag finding. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Primary Survey and Resuscitation** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Airway status, Breathing status, Circulation status, Resuscitation intervention, Time of intervention. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**4. Emergency Consultation and Orders** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Clinical note, Diagnosis code, Order reference, Prescription reference. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**5. Emergency Procedures and Observation** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Procedure code, Procedure status, Clinical result, Observation note. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**6. Emergency Disposition and Handover** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Encounter disposition, Referral reference, Handover recipient, Handover time. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Maternal Antenatal Care
**Enrollment policy:** repeatable episode-based enrollment. **Tracked entity:** shared patient.

**1. ANC Registration and Pregnancy Dating** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Last menstrual period, Estimated delivery date, Gravidity, Parity, Pregnancy risk history. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. ANC Visit and Risk Assessment** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Gestational age weeks, Systolic BP (mmHg), Diastolic BP (mmHg), Weight (kg), Danger signs. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. ANC Screening and Diagnostics** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture HIV test result, Syphilis screening, Haemoglobin (g/dL), Ultrasound order reference, Clinical result. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**4. ANC Preventive Care and Counselling** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Preventive intervention, Supplement issued, Counselling note, Follow-up appointment. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**5. ANC Referral and Outcome** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Referral reference, Pregnancy outcome, Outcome date. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Maternity Labour and Delivery
**Enrollment policy:** repeatable episode-based enrollment. **Tracked entity:** shared patient.

**1. Labour Admission** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Gestational age weeks, Labour onset time, Maternal risk note. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Labour Monitoring** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Cervical dilatation cm, Fetal heart rate, Contraction frequency, Systolic BP (mmHg). Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Obstetric Intervention** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Procedure code, Intervention indication, Procedure status. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**4. Delivery and Birth Record** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Birth mode, Birth date and time, Birth outcome, Birth weight (g), Newborn linked patient identifier. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**5. Postpartum Immediate Care** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Estimated blood loss (mL), Postpartum complication, Maternal disposition. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**6. Maternity Discharge and Handover** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Discharge date, Follow-up appointment, Referral reference. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Postnatal and Newborn Follow-up
**Enrollment policy:** repeatable episode-based enrollment. **Tracked entity:** shared patient.

**1. Postnatal Enrollment** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Delivery date, Delivery facility, Mother linked patient identifier. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Postnatal Maternal Assessment** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Systolic BP (mmHg), Danger signs, Breastfeeding counselling. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Newborn Assessment** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Birth weight (g), Weight (kg), Newborn danger signs, Jaundice assessment. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**4. Postnatal Counselling and Referral** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Counselling note, Referral reference, Follow-up status. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Child Health and Immunisation
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. Child Registration and Eligibility** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Caregiver identifier, Birth date verified, Vaccination card reference. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Growth and Nutrition Assessment** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Weight (kg), Height (cm), MUAC (mm), Nutrition classification. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Immunisation Due Assessment** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Vaccine antigen code, Dose sequence, Vaccination status, Due date. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**4. Vaccination Administration** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Vaccine antigen code, Dose sequence, Vaccine lot number, Administration date, Vaccinator identifier. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**5. Adverse Event Following Immunisation** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture AEFI onset, AEFI severity, AEFI clinical description, Referral reference. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**6. Child Clinical Review and Referral** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Clinical note, Diagnosis code, Referral reference. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### HIV Care and ART
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. HIV Enrollment and Baseline** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Confirmed diagnosis date, ART start date, Baseline clinical stage, Treatment regimen code. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. HIV Clinical Follow-up** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Weight (kg), Clinical note, Treatment adherence, Next review date. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. HIV Laboratory Monitoring** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Viral load copies/mL, CD4 count, Specimen reference, Clinical result. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**4. ART Prescription and Dispensing** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Prescription reference, Treatment regimen code, Quantity, Stock transaction reference. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**5. HIV Differentiated Service and Referral** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Service delivery model, Referral reference, Follow-up status. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Tuberculosis and Leprosy Care
**Enrollment policy:** repeatable episode-based enrollment. **Tracked entity:** shared patient.

**1. TB/Leprosy Screening and Classification** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Disease classification, Symptoms duration days, Diagnosis code, Index case reference. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Microbiology and Diagnostic Workup** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Specimen reference, Molecular test result, Smear result. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Treatment Initiation** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Treatment start date, Treatment regimen code, Treatment phase. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**4. Treatment Adherence and Follow-up** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Treatment adherence, Weight (kg), Treatment adverse effect. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**5. Contact Tracing and Referral** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Contact patient identifier, Screening result, Referral reference. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**6. Treatment Outcome** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture TB outcome, Outcome date. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### NCD Diabetes and Hypertension
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. NCD Enrollment and Risk Profile** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Diabetes type, Hypertension diagnosis, Cardiovascular risk factors. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. NCD Review and Vitals** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Systolic BP (mmHg), Diastolic BP (mmHg), Weight (kg), Clinical note. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Diabetes Laboratory Monitoring** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture HbA1c (%), Fasting glucose (mmol/L), Urine albumin result. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**4. NCD Complications Screening** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Foot exam result, Retinal screening result, Renal risk note. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**5. NCD Treatment and Review** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Prescription reference, Treatment adherence, Follow-up appointment. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Cancer and Oncology
**Enrollment policy:** repeatable episode-based enrollment. **Tracked entity:** shared patient.

**1. Oncology Registration and Diagnosis** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Primary cancer site code, Histology terminology code, Diagnosis date, Stage at diagnosis. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Multidisciplinary Tumour Board** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Decision date, Clinical note, Care plan status. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Systemic Therapy Plan and Cycle** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Protocol code, Cycle number, Treatment administration date, Treatment adverse effect. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**4. Surgery and Radiation Coordination** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Procedure code, Radiotherapy course reference, Procedure status. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**5. Oncology Response and Survivorship** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Treatment response code, Clinical note, Follow-up appointment. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**6. Palliative Oncology and Outcome** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Pain score (0-10), Palliative intervention, Outcome date. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Mental Health and Psychiatry
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. Mental Health Intake and Consent** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Presenting concern, Consent status, Mental health risk. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Mental Status and Risk Assessment** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Mental state examination, Suicide risk note, Mental health risk. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Mental Health Treatment Planning** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Diagnosis code, Care plan status, Prescription reference. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**4. Psychotherapy and Follow-up** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Therapy session summary, Follow-up status, Referral reference. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Surgical and Theatre Services
**Enrollment policy:** repeatable episode-based enrollment. **Tracked entity:** shared patient.

**1. Surgical Booking and Consent** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Planned procedure code, Surgery date, Consent status. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Preoperative Assessment** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Anaesthesia risk classification, Preoperative findings, Procedure status. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Theatre Safety Checklist** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Sign-in completed, Time-out completed, Sign-out completed. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**4. Operative Record** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Procedure code, Procedure start time, Procedure end time, Operative note, Wound classification. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**5. Postoperative and Surgical Review** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Pain score (0-10), Postoperative complication, Follow-up appointment. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Dental and Oral Health
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. Dental Assessment** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Tooth notation system, Tooth identifier, Dental finding code, Pain score (0-10). Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Dental Procedure and Treatment** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Tooth identifier, Procedure code, Procedure status, Prescription reference. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Dental Follow-up** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Clinical note, Follow-up appointment. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Eye and Vision Care
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. Ophthalmology Screening** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Visual acuity left, Visual acuity right, Presenting symptom. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Ophthalmology Examination** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Intraocular pressure left, Intraocular pressure right, Eye finding code. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Eye Procedure and Referral** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Procedure code, Referral reference, Follow-up appointment. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### ENT Services
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. ENT Assessment** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture ENT chief complaint, Otoscopy finding, Hearing screening result. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. ENT Investigation and Procedure** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Order reference, Procedure code, Clinical result. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. ENT Review and Referral** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Clinical note, Referral reference. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Rehabilitation and Physiotherapy
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. Rehabilitation Intake** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Functional baseline scale, Therapy goal. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Rehabilitation Session** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Therapy intervention code, Session duration minutes, Functional outcome score. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Rehabilitation Reassessment and Discharge** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Functional outcome score, Discharge recommendation. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Renal Care and Dialysis
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. Renal Assessment and Access** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Renal diagnosis code, Vascular access type, Baseline renal function note. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Dialysis Session** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Dialysis session status, Pre dialysis weight kg, Post dialysis weight kg, Dialysis duration minutes. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Dialysis Complication and Review** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Complication note, Referral reference, Follow-up appointment. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Family Planning and Reproductive Health
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. Family Planning Counselling** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Method preference, Counselling note, Consent status. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Contraceptive Service** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Contraceptive method code, Quantity, Procedure code, Service date. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Family Planning Follow-up** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Adverse effect note, Follow-up status. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Laboratory Diagnostics
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. Laboratory Order Intake** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Order reference, Encounter reference, Test catalogue code, Specimen reference, Order status. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Specimen Collection and Accession** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Specimen reference, Specimen status, Collection date and time. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Laboratory Test Processing** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Test catalogue code, Analyzer reference, Quality control result, Clinical result. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**4. Laboratory Results and Validation** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Order reference, Result value text, Result units, Reference interval, Result authorised by. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**5. Laboratory Critical Result Communication** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Critical result alert, Notified clinician ID, Notification time. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Imaging and Radiology
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. Imaging Request and Scheduling** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Order reference, Modality code, Body site code, Appointment date. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Imaging Acquisition** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Imaging study identifier, Contrast administered, Procedure status. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Imaging Reporting and Communication** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Imaging study identifier, Radiology report, Clinical result, Reported date. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Blood Bank and Transfusion
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. Transfusion Request and Eligibility** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Order reference, Blood component code, Units requested, Clinical indication. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Crossmatch and Component Issue** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Blood unit identifier, Blood compatibility, Issue date and time. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Transfusion Administration and Monitoring** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Blood unit identifier, Start date and time, End date and time, Transfusion reaction. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Nutrition and Dietetics
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. Nutrition Screening** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Weight (kg), Height (cm), MUAC (mm), Nutrition classification. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Nutrition Plan and Counselling** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Diet plan reference, Counselling note, Care plan status. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Nutrition Monitoring** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Weight (kg), Nutrition response, Follow-up appointment. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Facility Equipment and Maintenance
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** equipment.

**1. Equipment Registration** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Asset identifier, Equipment category, Manufacturer, Serial number, Equipment location. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. Preventive Maintenance** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Maintenance date, Maintenance outcome, Next maintenance date. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. Equipment Breakdown and Repair** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Fault reported at, Repair action, Equipment return to service. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**4. Equipment Decommissioning** Typically once per enrollment. Service point responsibilities: identify and verify the encounter or order context; capture Decommission date, Decommission reason. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

### Hospital Infection Prevention and Control
**Enrollment policy:** longitudinal / single enrollment (baseline; subject to clinical review). **Tracked entity:** shared patient.

**1. IPC Incident Notification** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Incident reference, Incident date, IPC event classification, Service point. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**2. IPC Investigation and Measures** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Investigation findings, Intervention action, Care plan status. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

**3. IPC Closure and Review** Repeatable. Service point responsibilities: identify and verify the encounter or order context; capture Closure date, Lessons learned. Record responsible user, timestamp, source service point, relevant consent and onward handoff as DER operational context. Check identity, required values, configured access rights and local approvals before completion.

## 4. Cross-cutting order, result, medication and stock workflows
**Lab:** consultation/ward request -> one order with one or more tests -> specimen accession -> individual observations/results -> verification -> critical-value notification -> clinician acknowledgment. Preserve specimen and order identifiers; do not place multiple analytes in a single unstructured result field.

**Imaging:** request -> scheduling -> study acquisition/PACS storage -> report -> clinical review. DICOM data remains in PACS; only identifiers and selected report content belong in Tracker.

**Medication:** prescription item(s) -> pharmacist clinical verification -> reservation -> dispensing (lot and quantity) -> medication administration record when IPD -> stock deduction exactly once -> patient record and billing update. Prescribing, dispensing and administration are distinct events. Maintain allergy checks, interactions and dosing alerts in a governed medication engine; generic sample metadata is not sufficient for medication safety.

**Blood products:** request -> consent/eligibility -> component reservation and crossmatch -> issue -> two-person bedside verification -> administration/monitoring -> traceability and haemovigilance. Include national rules for blood donation and transfusion identifiers.

**Stock:** purchases/receipts -> put-away -> transfer -> available-to-promise -> issue/consumption/dispensing -> reconciliation, returns, quarantine, expiry and recall. Ledger posting is transactional and idempotent. Clients with no connection to a common DER server must not independently decrement shared stock without controlled allocations.

**Billing:** capture itemised charge-source references, exemptions, payers, refunds and reconciliation within a dedicated financial service. DHIS2 summary events are informational; do not treat them as an authoritative double-entry financial ledger.

## 5. DHIS2 program relationships and DER associations
| Relationship | Scope | Integration strategy |
|---|---|---|
| Mother–newborn | Patient to/from patient | Native TE–TE when configured; consent and child-protection restrictions |
| OPD consultation–IPD admission | Event to/from enrollment | Configured native relation where supported, plus encounter transition mapping |
| Request–result | Event to/from event | Native only where constraints allow; operational order IDs otherwise |
| Prescription–dispense–administration | Event to/from event | Validate eligible stage constraints; DER lifecycle owns each item |
| Patient–contact | Patient to/from patient | Controlled contact tracing and consent/authorisation |
| Service-point handoff | DER task to/from event | DER-only workflow link, never falsely exported as native |
| Commodity movement–dispensing | Inventory ledger to/from clinical event | Reference and idempotency mapping, not a patient-to-stock relationship |

## 6. Metadata components and counts
| Metadata type | Count |
|---|---:|
| trackedEntityTypes | 3 |
| trackedEntityAttributes | 16 |
| optionSets | 61 |
| options | 316 |
| dataElements | 624 |
| programs | 26 |
| programStages | 163 |
| programRuleVariables | 8 |
| programRules | 8 |
| programRuleActions | 8 |
| programIndicators | 26 |

### 6.1 Option sets
Each of the following locally authored option sets contains named values and stable option codes. The sets are NOT authoritative ICD, LOINC, SNOMED, ATC or WHO package imports.
- **Visit Status:** Scheduled, Arrived, In progress, Completed, Cancelled, Did not attend.
- **Referral Priority:** Routine, Urgent, Emergency.
- **Encounter Disposition:** Home, Admitted, Transferred, Referred, Left against advice, Deceased.
- **Clinical Acuity:** Immediate, Very urgent, Urgent, Standard, Non urgent.
- **Order Status:** Requested, Accepted, In progress, Completed, Cancelled, Rejected.
- **Clinical Result:** Normal, Abnormal, Critical, Indeterminate, Not performed.
- **Care Plan Status:** Planned, Active, On hold, Completed, Cancelled.
- **Treatment Adherence:** Good, Partial, Poor, Unknown.
- **TB Treatment Outcome:** Cured, Treatment completed, Treatment failed, Died, Lost to follow up, Not evaluated.
- **Pregnancy Outcome:** Live birth, Stillbirth, Miscarriage, Termination, Ectopic, Unknown.
- **Birth Mode:** Spontaneous vaginal, Assisted vaginal, Caesarean.
- **Vaccination Status:** Due, Administered, Deferred, Contraindicated, Refused.
- **Wound Classification:** Clean, Clean-contaminated, Contaminated, Dirty.
- **Mental Health Risk:** Low, Moderate, High, Imminent.
- **Screening Outcome:** Negative, Positive, Indeterminate, Not done.
- **Nutrition Classification:** Normal, Moderate acute malnutrition, Severe acute malnutrition, Overweight, Obesity.
- **Procedure Status:** Planned, Started, Completed, Abandoned, Cancelled.
- **Renal Session Status:** Planned, Active, Completed, Interrupted, Cancelled.
- **Blood Compatibility:** Compatible, Incompatible, Not determined.
- **Follow-up Status:** Due, Completed, Missed, Rescheduled.
- **Payment Status:** Unbilled, Pending, Partially paid, Paid, Exempt, Deferred.
- **Consent Status:** Given, Declined, Withdrawn, Not applicable.
- **Yes No Unknown:** Yes, No, Unknown.
- **Specimen Status:** Requested, Collected, Received, Rejected, Processed, Reported.

### 6.2 Program rules and indicators
The package contains 8 deliberately limited, event-local warning rules, linked program rule variables and actions. Their expressions use current-event numeric fields and **must** be validated through the target DHIS2 API because rule evaluation and available action semantics vary across versions and applications.

There is one event-count indicator per included program (26 total). These are operational baselines, not WHO-standard coverage or clinical quality indicators. Numerator/denominator indicators (e.g. ANC retention, viral suppression, TB outcomes, maternal mortality, bed occupancy, stock-out rate) require approved case definitions, denominator populations, code lists and analytics validation before release.

### 6.3 Examples of locally approved indicator definitions
| Indicator | Numerator | Denominator | Safeguards |
|---|---|---|---|
| Inpatient mortality proportion | IPD discharge episodes with death disposition | All completed IPD discharge episodes | Case-mix and referral interpretation required |
| ANC first-contact coverage | First ANC contacts among resident pregnancies | Estimated eligible pregnancies in catchment | National ANC definition and population source |
| HIV viral suppression | Patients with latest eligible viral load below approved threshold | Eligible ART clients with reported viral load | Use national guidelines; missing tests handled explicitly |
| TB treatment success | Cured + treatment completed cohort | Defined treatment-start cohort | Cohort closure and transfer-out rules |
| Stock-out days | Days with zero available usable quantity | Days product expected in stock | Stock location, reporting completeness |
| Emergency median door-to-triage | Arrival-to-triage minutes per eligible visit | Eligible emergency arrivals | Compute in DER analytics; not generic event count |
| Bed occupancy | Occupied bed-days | Available staffed bed-days | Requires operational bed census, not only Tracker events |

## 7. International standards and terminology governance
- **WHO ICD-11**: classification for diagnoses where adopted by national policy. Use an authoritative versioned release and validated code service; do not manufacture clinical diagnosis option lists.
- **SNOMED CT**: detailed clinical concepts where licensing/usage arrangements permit. Map coded diagnoses, findings, procedures and problems through a terminology service.
- **LOINC**: laboratory test and observation identifiers; use controlled units and reference ranges appropriate to the laboratory and test method.
- **UCUM**: standard units of measure and explicit conversions; prevent dose/unit confusion.
- **WHO ATC/DDD or national essential medicines catalogue**: medication classification/catalogue mapping; use appropriate medicine product identifiers and national formulary as separate governed data.
- **HL7 FHIR R4/R5 profiles as nationally adopted**: Patient, Encounter, Condition, Observation, ServiceRequest, Specimen, DiagnosticReport, MedicationRequest, MedicationDispense, MedicationAdministration, Procedure, Immunization, Appointment, Claim/Invoice (as profiled). Map semantics; DHIS2 does not automatically implement all these resources.
- **DICOM**: imaging assets remain in imaging infrastructure, referenced by accession/study identifiers.
- **WHO SMART Guidelines / DHIS2 health data toolkit**: reconcile programme indicators with national health information standards, not placeholder definitions.
- **Data protections**: patient consent, RBAC/ABAC, purpose limitation, sensitive clinic segmentation, auditing, retention policies, encryption, backup and restoration and breach response must be configured for Ugandan law and hospital governance.

## 8. Version profiles: DHIS2 2.41, 2.42, 2.43, 2.44
The four JSON files intentionally use **one conservative common metadata schema and stable identifiers**. They are separate labelled import candidates for each version, not four independently tested exports. Newer features should be introduced only after target-server metadata inspection, expression validation and dry-run import. Do not mix alternate-version bundles on the same server.

| Target | Package | Required gate |
|---|---|---|
| 2.41 | `DER_General_Hospital_DHIS2_2_41_Metadata.json` | Dry-run import, program-rule description validation, Tracker capture tests, permissions, analytics |
| 2.42 | `DER_General_Hospital_DHIS2_2_42_Metadata.json` | Dry-run import, program-rule description validation, Tracker capture tests, permissions, analytics |
| 2.43 | `DER_General_Hospital_DHIS2_2_43_Metadata.json` | Dry-run import, program-rule description validation, Tracker capture tests, permissions, analytics |
| 2.44 | `DER_General_Hospital_DHIS2_2_44_Metadata.json` | Dry-run import, program-rule description validation, Tracker capture tests, permissions, analytics |

**Recommended import order for split layers:** shared catalogue -> programs and program stages -> rule variables/rules/actions and indicators. Treat partial imports cautiously; referential integrity and permissions are server-owned. The complete version JSON is the reference bundle.

### Compatibility test protocol
1. Back up the DHIS2 database; use a staging clone. Confirm exact DHIS2 patch version and installed applications.
2. GET existing `/api/metadata` (or targeted `/api/programs`, `/api/trackedEntityTypes`, `/api/dataElements`, `/api/optionSets`) and compare UIDs, codes, names, conflicts, categories and ownership.
3. First use `POST /api/metadata?importMode=VALIDATE&importStrategy=CREATE` (or version-supported dry-run endpoint/parameters); capture complete import report. Exact parameters must be checked against server version.
4. Resolve duplicate objects, invalid fields, option-set constraints and program stage associations; do not modify existing national metadata blindly.
5. Validate every program-rule condition and action expression through the instance’s expression-description endpoints, and check evaluated rules in Capture and Tracker importer.
6. Verify clinical data fixtures against `/api/tracker` with `importMode=VALIDATE`; test TE, enrollment, event and eligible relationship references, including offline replay.
7. Rebuild analytics and validate program-indicator expressions and reported data against independent hand-calculated fixtures.
8. Configure organisation unit assignments, program access levels, program stage sharing, data protection, patient search permissions, user groups and service-point roles.
9. Test clinical scenarios and safety conditions with locally authorised clinicians and administrators before any production deployment.

## 9. DER Server and Client requirements
**Client:** App launcher (Capture / Patient Search / Emergency / OPD / IPD / Specialist Clinics / Laboratory / Pharmacy / Inventory / Billing / Administration), contextual work queues, dedicated list and detail pages, metadata-driven forms with clear sections, patient timeline, clinical tasks, related-record drawer, accessible tablets/desktop, structured search, autosave drafts, and offline status. Do not place a full list and a full data-entry form on the same page.

**Server:** federated patient identity mapping, site-level shared records, authorization and consent checks, order lifecycle, durable outbox/inbox journal, idempotency keys, optimistic concurrency, conflict classification, central DHIS2 interoperability, local-to-central UID mapping, terminology service, attachment references, central sync observability, transactional inventory and financial adapters.

**Cross-service workflow:** clinician signs a lab order -> lab queue shows the order -> collector records specimen accession -> analyser/result reviewer finalises test -> clinician sees and acknowledges result. Other services run in parallel; the client shows clear responsibility and next step without duplicating identifiers.

**Safety:** emergency care never blocked by billing; critical values notified and acknowledged; unsynchronised edits clearly visible; clinical conflicts require role-authorised resolution; offline medicine and stock changes are serialised by a site ledger or allocated quotas; LWW is prohibited for clinical or stock conflicts.

## 10. Roles, minimum permissions and audit
| Role | Default scope | Sensitive controls |
|---|---|---|
| Registration | Identity lookup/verification and visit initiation | No unrestricted clinical access |
| Nurse/midwife | Triage, nursing, maternity forms | Stage- and facility-scoped |
| Clinician | Assessment, diagnosis, orders and discharge | Signed records; reasoned amendments |
| Lab technologist | Orders, accession and validation | No unrelated patient chart browsing |
| Radiologist | Study/report access | PACS and restricted reports |
| Pharmacist | Verification, dispense and stock | Separation from prescribing where needed |
| Stock officer | Receipts, transfers, counts | No clinical diagnosis disclosure |
| Billing officer | Charges, payment reconciliation | No unrelated confidential clinical content |
| Administrator | Metadata/users/operations | No automatic clinical content access |
| Auditor | Authorised read-only trails | Immutable logs and export approvals |

## 11. Testing, known limitations and acceptance criteria
- **Static validation:** UID syntax, uniqueness, internal references, option-set codes, stage-field references, variable-field references, reproducibility and version manifest consistency.
- **Integration validation:** all four target DHIS2 versions require their own actual import tests; no such tests are represented as complete here.
- **Clinical fixtures:** patient repeat visits; multi-encounter IPD; ANC-to-delivery; maternal/newborn links; child vaccine doses; TB regimen outcomes; HIV viral load; oncology cycles; urgent lab results; pharmacy partial fills; stock adjustments; emergency admission; financial reconciliation.
- **Offline:** WAN outage and restoration, client restart, duplicate event replay, concurrent changes across devices, metadata drift, rejected central edits, patient merge and recovery.
- **Reporting:** indicators validated with reference calculations and data access controls; no derived indicator should be treated as nationally approved by default.
- **Explicit limitations:** this metadata does not bundle exhaustive coded clinical vocabularies, therapeutic dose rules, DICOM binary assets, actual national reporting datasets, bed capacity ledger, or financial accounting. These require separately governed integration modules.

## 12. Source references and implementation further reading
- DHIS2 metadata API, 2.41: https://docs.dhis2.org/en/develop/using-the-api/dhis-core-version-241/metadata.html
- DHIS2 metadata API, 2.42: https://docs.dhis2.org/en/develop/using-the-api/dhis-core-version-242/metadata.html
- DHIS2 Tracker API: https://docs.dhis2.org/en/develop/using-the-api/dhis-core-version-master/tracker.html
- DHIS2 health data toolkit: https://dhis2.org/health-data-toolkit/
- DHIS2 and FHIR interoperability: https://dhis2.org/integration/fhir/
- WHO ICD-11: https://icd.who.int/
- LOINC: https://loinc.org/
- SNOMED International: https://www.snomed.org/
- HL7 FHIR: https://hl7.org/fhir/
- UCUM: https://ucum.org/

## Appendix A. Existing source programmes
### Integrated Outpatient EMR
- **Registration Verification** (repeatable): Identity Verified, Registration Notes.
- **Visit Check-in** (repeatable): Visit Reference, Requested Service, Check-in Time, Queue Number, Visit Payment Category.
- **Triage and Vital Signs** (repeatable): Visit Reference, Triage Category, Temperature Celsius, Systolic Blood Pressure, Diastolic Blood Pressure, Heart Rate, Respiratory Rate, Oxygen Saturation Percent, Weight Kg, Height Cm, Triage Complaint.
- **Clinical Consultation** (repeatable): Visit Reference, Reason for Visit, History of Present Illness, Clinical Examination, Provisional Diagnosis, Final Diagnosis, Clinical Plan.
- **Laboratory Request** (repeatable): Visit Reference, Order Reference, Laboratory Test Requested, Order Priority, Specimen Type, Request Indication, Request Status.
- **Laboratory Specimen Collection** (repeatable): Visit Reference, Order Reference, Specimen Identifier, Collection Date Time, Specimen Received Date Time, Specimen Notes.
- **Laboratory Results** (repeatable): Visit Reference, Order Reference, Laboratory Test Name, Laboratory Result Value, Laboratory Result Interpretation, Laboratory Result Units, Laboratory Reference Range, Laboratory Report Date Time, Critical Result Escalated.
- **Imaging Request** (repeatable): Visit Reference, Order Reference, Imaging Modality, Imaging Body Site, Imaging Clinical Indication, Order Priority.
- **Imaging Report** (repeatable): Visit Reference, Order Reference, Imaging Findings, Imaging Impression, Imaging Performed Date Time.
- **Procedure and Treatment** (repeatable): Visit Reference, Order Reference, Procedure Name, Procedure Date Time, Procedure Outcome, Adverse Event.
- **Prescription** (repeatable): Visit Reference, Order Reference, Medicine Prescribed, Prescribed Dose, Dose Unit, Route of Administration, Frequency, Duration Days, Quantity Prescribed.
- **Pharmacy Dispensing** (repeatable): Visit Reference, Order Reference, Medicine Dispensed, Quantity Dispensed, Dispensing Date Time, Dispensing Notes.
- **Billing Charge** (repeatable): Visit Reference, Invoice Reference, Charge Line Reference, Charge Service Category, Charge Description, Charge Quantity, Charge Unit Price UGX, Charge Gross Amount UGX, Charge Discount Amount UGX, Charge Net Amount UGX, Charge Source Reference, Payer Category, Charge Status.
- **Billing Payment** (repeatable): Visit Reference, Invoice Reference, Payment Reference, Payment Method, Payment Amount UGX, Payment Date Time, Payment Status, External Transaction Reference, Payment Notes.
- **Billing Clearance** (repeatable): Visit Reference, Invoice Reference, Billing Balance UGX, Billing Clearance Granted, Billing Clearance Reason, Billing Clearance Date Time.
- **Clinical Review and Disposition** (repeatable): Visit Reference, Disposition, Clinical Outcome, Discharge Summary, Follow-up Date, Return Precautions.
- **Referral and Transfer** (repeatable): Visit Reference, Referral Type, Referral Destination, Referral Reason, Referral Date, Referral Status.
- **Follow-up Encounter** (repeatable): Visit Reference, Follow-up Findings, Clinical Outcome, Follow-up Date.
### Integrated Inpatient EMR
- **Admission Request and Bed Booking** (single): Admission Request ID, Originating OPD Event ID, Proposed Admission Type, Requested Ward, Bed Request Time, Booking Outcome.
- **Admission and Identity Verification** (single): Admission ID, Admission Date and Time, Referred From, Admission Source, Reason for Admission, Admission Diagnosis, Admitting Clinician, Assigned Ward, Assigned Bed, Encounter ID, Identity Verified, Consent Status, Next of Kin Contact.
- **Initial Nursing Assessment** (repeatable): Encounter ID, Assessment Time, Presenting Concerns, Temperature Celsius, Pulse Per Minute, Respiratory Rate Per Minute, Systolic BP, Diastolic BP, Oxygen Saturation Percent, Pain Score, Fall Risk, Pressure Injury Risk, Nursing Care Needs.
- **Admission History and Physical** (repeatable): Encounter ID, History of Present Illness, Past Medical History, Surgical History, Allergy Description, Current Medicines, Physical Examination, Working Diagnosis, Care Plan, Clinical Priority.
- **Patient Problems and Diagnoses** (repeatable): Encounter ID, Diagnosis Code, Diagnosis Description, Diagnosis Classification, Diagnosis Onset Date, Diagnosis Status, Responsible Clinician.
- **Ward Round and Clinical Progress** (repeatable): Encounter ID, Round Time, Progress SOAP Subjective, Progress SOAP Objective, Progress SOAP Assessment, Progress SOAP Plan, Consultant ID, Workflow Status.
- **Vital Signs and Early Warning** (repeatable): Encounter ID, Measurement Time, Temperature Celsius, Pulse Per Minute, Respiratory Rate Per Minute, Systolic BP, Diastolic BP, Oxygen Saturation Percent, Oxygen Delivery, Glasgow Coma Score, Early Warning Score, Escalation Action.
- **Medication Reconciliation** (repeatable): Encounter ID, Medication Name, Home Medication Dose, Home Medication Frequency, Medication Reconciliation Action, Reconciliation Reason, Reviewed By.
- **Medication Prescription** (repeatable): Encounter ID, Prescription ID, Medication Order ID, Medicine Code, Medicine Name, Dose, Dose Unit, Route, Frequency, Start Date Time, End Date Time, Quantity Ordered, Prescriber, Workflow Status.
- **Pharmacy Verification and Issue** (repeatable): Encounter ID, Prescription ID, Medication Order ID, Dispensing ID, Medicine Code, Quantity Issued, Batch Number, Expiry Date, Pharmacist ID, Workflow Status.
- **Medication Administration Record** (repeatable): Encounter ID, Medication Order ID, Scheduled Dose Time, Actual Administration Time, Dose Administered, Dose Unit, Route, Administration Outcome, Omission Reason, Administered By, Witnessed By.
- **Intravenous Fluids and Infusions** (repeatable): Encounter ID, Infusion Order ID, Fluid Type, Total Volume ML, Infusion Rate ML Per Hour, Start Date Time, End Date Time, Administration Outcome, Recorded By.
- **Laboratory Investigation Request** (repeatable): Encounter ID, Laboratory Request ID, Test Order ID, Test Code, Test Name, Sample Type, Clinical Indication, Clinical Priority, Request Time, Workflow Status.
- **Specimen Collection and Handover** (repeatable): Encounter ID, Laboratory Request ID, Specimen ID, Collection Time, Sample Type, Collector ID, Specimen Condition, Handover Time, Workflow Status.
- **Laboratory Results and Validation** (repeatable): Encounter ID, Laboratory Request ID, Test Order ID, Specimen ID, Test Code, Result Value, Result Unit, Reference Range, Result Interpretation, Result Time, Verified By, Critical Result Alert.
- **Imaging and Diagnostics Request** (repeatable): Encounter ID, Imaging Request ID, Imaging Modality, Body Region, Clinical Indication, Clinical Priority, Request Time, Workflow Status.
- **Imaging Result and Report** (repeatable): Encounter ID, Imaging Request ID, Study Reference, Study Date Time, Report Findings, Report Impression, Reporting Clinician, Critical Result Alert, Workflow Status.
- **Procedure and Intervention** (repeatable): Encounter ID, Procedure ID, Procedure Code, Procedure Name, Procedure Date Time, Consent Status, Procedure Notes, Procedure Outcome, Procedure Clinician, Complications.
- **Surgery and Operating Theatre** (repeatable): Encounter ID, Surgery ID, Surgical Procedure, Preoperative Diagnosis, Surgery Start Time, Surgery End Time, Surgeon ID, Anesthesia Type, Safety Checklist Complete, Operation Notes, Postoperative Diagnosis.
- **Post Anaesthesia and Recovery** (repeatable): Encounter ID, Surgery ID, Recovery Start Time, Recovery Score, Airway Status, Pain Score, Complications, Recovery Disposition, Receiving Staff.
- **Nursing Care Plan and Interventions** (repeatable): Encounter ID, Nursing Problem, Nursing Intervention, Care Goal, Intervention Date Time, Response to Care, Responsible Nurse, Workflow Status.
- **Intake Output and Fluid Balance** (repeatable): Encounter ID, Observation Time, Intake Type, Intake Volume ML, Output Type, Output Volume ML, Shift, Fluid Balance Note.
- **Blood and Transfusion** (repeatable): Encounter ID, Transfusion Order ID, Blood Product Code, Blood Unit Identifier, Compatibility Result, Transfusion Start, Transfusion End, Transfusion Outcome, Adverse Reaction.
- **Consultation and Specialty Review** (repeatable): Encounter ID, Consultation Request ID, Specialty, Reason for Consultation, Consultation Date Time, Clinical Opinion, Recommendations, Consultant ID, Workflow Status.
- **Ward Bed Transfer and Handover** (repeatable): Encounter ID, Transfer ID, From Ward, From Bed, To Ward, To Bed, Transfer Reason, Transfer Time, Handover Summary, Receiving Staff.
- **Critical Care and Escalation** (repeatable): Encounter ID, Escalation Time, Escalation Trigger, Escalation Level, Critical Care Plan, Responsible Clinician, Workflow Status.
- **Allied Health and Rehabilitation** (repeatable): Encounter ID, Service Category, Assessment Summary, Intervention, Session Date Time, Progress Note, Follow Up Required.
- **Infection Prevention and Isolation** (repeatable): Encounter ID, Infection Risk, Isolation Type, Isolation Start, Isolation End, Infection Control Action, Infection Control Review.
- **Billing Charge and Claims** (repeatable): Encounter ID, Charge ID, Charge Source Event ID, Charge Item Code, Charge Amount, Currency Code, Payer Type, Claim Reference, Payment Status.
- **Payment and Financial Clearance** (repeatable): Encounter ID, Invoice ID, Payment Reference, Payment Amount, Currency Code, Payment Method, Payment Status, Waiver or Exemption, Financial Clearance Status.
- **Discharge Planning and Education** (repeatable): Encounter ID, Estimated Discharge Date, Discharge Education, Home Medicines, Follow Up Appointment, Discharge Barriers, Caregiver Instructions, Workflow Status.
- **Discharge Summary and Disposition** (single): Encounter ID, Discharge Date Time, Final Diagnosis, Secondary Diagnoses, Treatment Summary, Procedures Summary, Discharge Medicines, Discharge Condition, Disposition, Follow Up Plan, Authorising Clinician.
- **Referral Transfer Out and Continuity** (repeatable): Encounter ID, Referral ID, Receiving Facility, Referral Reason, Referral Priority, Transfer Time, Receiving Contact, Handover Completed, Referral Status.
- **Death and Mortuary Handover** (single): Encounter ID, Date Time of Death, Death Certification Reference, Cause of Death Summary, Certifying Clinician, Mortuary Transfer Reference, Family Notified.
- **Post Discharge Follow-up and Readmission** (repeatable): Encounter ID, Follow Up Date, Follow Up Outcome, Complication Identified, Readmission Reference, Follow Up Plan.
### Inventory and Supplies Tracker
- **INV - Opening Balance and Stocktake** (repeatable): INV - Opening Quantity, INV - Count Date, INV - Stock Location, INV - Batch or Lot Number, INV - Expiry Date, INV - Count Reference, INV - Approved By.
- **INV - Goods Receipt** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID, INV - Linked Order ID, INV - Reason, INV - Performed By User ID, INV - Transaction Status, INV - Supplier Name, INV - Goods Received Note, INV - Purchase Order Reference, INV - Unit Cost.
- **INV - Issue to Service Point** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID, INV - Linked Order ID, INV - Reason, INV - Performed By User ID, INV - Transaction Status, INV - Destination Stock Location, INV - Requisition ID.
- **INV - Department Receipt** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID, INV - Linked Order ID, INV - Reason, INV - Performed By User ID, INV - Transaction Status, INV - Dispatch Reference, INV - Source Stock Location.
- **INV - Patient Dispensing** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID, INV - Linked Order ID, INV - Reason, INV - Performed By User ID, INV - Transaction Status, INV - Prescription ID, INV - Patient Reference Token.
- **INV - Clinical Consumption** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID, INV - Linked Order ID, INV - Reason, INV - Performed By User ID, INV - Transaction Status, INV - Service Event ID, INV - Consumption Context.
- **INV - Return and Quarantine** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID, INV - Linked Order ID, INV - Reason, INV - Performed By User ID, INV - Transaction Status, INV - Return Source, INV - Quality Assessment.
- **INV - Stock Transfer Dispatch** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID, INV - Linked Order ID, INV - Reason, INV - Performed By User ID, INV - Transaction Status, INV - Destination Stock Location, INV - Transfer Reference.
- **INV - Expiry Damage and Disposal** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID, INV - Linked Order ID, INV - Reason, INV - Performed By User ID, INV - Transaction Status, INV - Disposal Method, INV - Authorisation Reference.
- **INV - Stock Adjustment** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID, INV - Linked Order ID, INV - Reason, INV - Performed By User ID, INV - Transaction Status, INV - Counted Quantity, INV - System Quantity, INV - Adjustment Approval.
- **INV - Stock Reservation** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID, INV - Linked Order ID, INV - Reason, INV - Performed By User ID, INV - Transaction Status, INV - Reservation ID, INV - Reserved Quantity, INV - Reservation Expiry.
- **INV - Stock Requisition** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID, INV - Linked Order ID, INV - Reason, INV - Performed By User ID, INV - Transaction Status, INV - Requisition ID, INV - Requested Quantity, INV - Requesting Service Point, INV - Required By.
- **INV - Procurement and Replenishment** (repeatable): INV - Transaction ID, INV - Source Operation ID, INV - Transaction Type, INV - Transaction Time, INV - Stock Location, INV - Quantity, INV - Base Unit, INV - Batch or Lot Number, INV - Expiry Date, INV - Linked Visit ID, INV - Linked Order ID, INV - Reason, INV - Performed By User ID, INV - Transaction Status, INV - Purchase Order Reference, INV - Supplier Name, INV - Ordered Quantity, INV - Expected Delivery.

## Appendix B. Relationship, program rule and indicator setup checklist
1. Agree event to enrollment and event to event association constraints and direction with DHIS2 administrators before adding native relationshipTypes.
2. Confirm data elements, option set codes, choice labels, data value types, clinical thresholds and visibility before enabling rules.
3. Confirm calculations using program indicator validation API and sample patient cohorts; review cross-program indicators separately in analytics/warehouse.
4. Create distinct configuration profiles by facility and national jurisdiction; never overwrite authoritative national IDs or code systems.


## 7. Cross-cutting and service-specific code catalogue

The CSV/JSON registry is authoritative. The following index provides named fields and codes for rapid review.

### trackedEntityTypes

| DER Code | Metadata name | Scope |
|---|---|---|
| `EQTE0001` | Facility Equipment | service-specific |
| `IVTE0001` | Inventory Commodity | service-specific |
| `PTTE0001` | Patient | cross-cutting |

### trackedEntityAttributes

| DER Code | Metadata name | Scope |
|---|---|---|
| `PTTA0001` | Date of Birth | cross-cutting |
| `PTTA0002` | Family Name | cross-cutting |
| `PTTA0003` | Given Name | cross-cutting |
| `PTTA0004` | Home Address | cross-cutting |
| `PTTA0005` | National Identifier | cross-cutting |
| `PTTA0006` | Patient Identifier | cross-cutting |
| `PTTA0007` | Phone Number | cross-cutting |
| `PTTA0008` | Sex | cross-cutting |
| `PTTA0009` | Inventory - Active Status | cross-cutting |
| `PTTA0010` | Inventory - Base Unit of Measure | cross-cutting |
| `PTTA0011` | Inventory - Commodity Code | cross-cutting |
| `PTTA0012` | Inventory - Commodity Description | cross-cutting |
| `PTTA0013` | Inventory - GTIN or Barcode | cross-cutting |
| `PTTA0014` | Inventory - Generic Name | cross-cutting |
| `PTTA0015` | Inventory - Product Category | cross-cutting |
| `PTTA0016` | Inventory - Strength or Specification | cross-cutting |

### optionSets

| DER Code | Metadata name | Scope |
|---|---|---|
| `BBOS0001` | Blood Compatibility | service-specific |
| `EROS0001` | Clinical Acuity | service-specific |
| `EROS0002` | Referral Priority | service-specific |
| `GNOS0001` | Care Plan Status | cross-cutting |
| `GNOS0002` | Clinical Result | cross-cutting |
| `GNOS0003` | Consent Status | cross-cutting |
| `GNOS0004` | Encounter Disposition | cross-cutting |
| `GNOS0005` | Follow-up Status | cross-cutting |
| `GNOS0006` | Nutrition Classification | cross-cutting |
| `GNOS0007` | Payment Status | cross-cutting |
| `GNOS0008` | Pregnancy Outcome | cross-cutting |
| `GNOS0009` | Procedure Status | cross-cutting |
| `GNOS0010` | Treatment Adherence | cross-cutting |
| `GNOS0011` | Visit Status | cross-cutting |
| `GNOS0012` | Yes No Unknown | cross-cutting |
| `IMOS0001` | Vaccination Status | service-specific |
| `IPOS0001` | IPD Administration Outcome | service-specific |
| `IPOS0002` | IPD Admission Source | service-specific |
| `IPOS0003` | IPD Consent Status | service-specific |
| `IPOS0004` | IPD Diagnosis Classification | service-specific |
| `IPOS0005` | IPD Diagnosis Status | service-specific |
| `IPOS0006` | IPD Disposition | service-specific |
| `IPOS0007` | IPD Escalation Level | service-specific |
| `IPOS0008` | IPD Financial Clearance Status | service-specific |
| `IPOS0009` | IPD Medication Reconciliation Action | service-specific |
| `IPOS0010` | IPD Payer Type | service-specific |
| `IPOS0011` | IPD Payment Method | service-specific |
| `IPOS0012` | IPD Payment Status | service-specific |
| `IPOS0013` | IPD Referral Status | service-specific |
| `IPOS0014` | IPD Route | service-specific |
| `IPOS0015` | IPD Shift | service-specific |
| `IPOS0016` | IPD Transfusion Outcome | service-specific |
| `IPOS0017` | IPD Workflow Status | service-specific |
| `IVOS0001` | INV Status | service-specific |
| `IVOS0002` | INV Stock Location | service-specific |
| `IVOS0003` | INV Stock Reason | service-specific |
| `IVOS0004` | INV Transaction Type | service-specific |
| `LBOS0001` | Order Status | cross-cutting |
| `LBOS0002` | Specimen Status | cross-cutting |
| `MHOS0001` | Mental Health Risk | service-specific |
| `MTOS0001` | Birth Mode | service-specific |
| `OPOS0001` | Clinical Outcome | service-specific |
| `OPOS0002` | Disposition | service-specific |
| `OPOS0003` | Invoice | service-specific |
| `OPOS0004` | Payer | service-specific |
| `OPOS0005` | Payment | service-specific |
| `OPOS0006` | Payment Status | service-specific |
| `OPOS0007` | Priority | service-specific |
| `OPOS0008` | Referral | service-specific |
| `OPOS0009` | Result | service-specific |
| `OPOS0010` | Service | service-specific |
| `OPOS0011` | Service Charge | service-specific |
| `OPOS0012` | Status | service-specific |
| `OPOS0013` | Triage | service-specific |
| `OPOS0014` | Unit | service-specific |
| `OPOS0015` | Yes/No | service-specific |
| `PTOS0001` | Sex | cross-cutting |
| `RNOS0001` | Renal Session Status | service-specific |
| `SCOS0001` | Screening Outcome | cross-cutting |
| `SUOS0001` | Wound Classification | service-specific |
| `TBOS0001` | TB Treatment Outcome | service-specific |

### dataElements

| DER Code | Metadata name | Scope |
|---|---|---|
| `ANDE0001` | Estimated delivery date | service-specific |
| `ANDE0002` | Gravidity | service-specific |
| `ANDE0003` | HIV test result | service-specific |
| `ANDE0004` | Haemoglobin (g/dL) | service-specific |
| `ANDE0005` | Last menstrual period | service-specific |
| `ANDE0006` | Parity | service-specific |
| `ANDE0007` | Pregnancy outcome | service-specific |
| `ANDE0008` | Pregnancy risk history | service-specific |
| `ANDE0009` | Preventive intervention | service-specific |
| `ANDE0010` | Supplement issued | service-specific |
| `ANDE0011` | Syphilis screening | service-specific |
| `ANDE0012` | Ultrasound order reference | service-specific |
| `BBDE0001` | Blood compatibility | service-specific |
| `BBDE0002` | Blood component code | service-specific |
| `BBDE0003` | Blood unit identifier | service-specific |
| `BBDE0004` | Clinical indication | service-specific |
| `BBDE0005` | End date and time | service-specific |
| `BBDE0006` | Issue date and time | service-specific |
| `BBDE0007` | Start date and time | service-specific |
| `BBDE0008` | Transfusion reaction | service-specific |
| `BBDE0009` | Units requested | service-specific |
| `DNDE0001` | Dental finding code | service-specific |
| `DNDE0002` | Tooth identifier | service-specific |
| `DNDE0003` | Tooth notation system | service-specific |
| `DXDE0001` | Diagnosis code | cross-cutting |
| `ENDE0001` | ENT chief complaint | service-specific |
| `ENDE0002` | Hearing screening result | service-specific |
| `ENDE0003` | Otoscopy finding | service-specific |
| `EQDE0001` | Asset identifier | service-specific |
| `EQDE0002` | Decommission date | service-specific |
| `EQDE0003` | Decommission reason | service-specific |
| `EQDE0004` | Equipment category | service-specific |
| `EQDE0005` | Equipment location | service-specific |
| `EQDE0006` | Equipment return to service | service-specific |
| `EQDE0007` | Fault reported at | service-specific |
| `EQDE0008` | Maintenance date | service-specific |
| `EQDE0009` | Maintenance outcome | service-specific |
| `EQDE0010` | Manufacturer | service-specific |
| `EQDE0011` | Next maintenance date | service-specific |
| `EQDE0012` | Repair action | service-specific |
| `EQDE0013` | Serial number | service-specific |
| `ERDE0001` | Airway status | service-specific |
| `ERDE0002` | Arrival mechanism | service-specific |
| `ERDE0003` | Breathing status | service-specific |
| `ERDE0004` | Circulation status | service-specific |
| `ERDE0005` | Clinical acuity | service-specific |
| `ERDE0006` | Encounter disposition | service-specific |
| `ERDE0007` | Handover recipient | service-specific |
| `ERDE0008` | Handover time | service-specific |
| `ERDE0009` | Heart rate (per min) | service-specific |
| `ERDE0010` | Observation note | service-specific |
| `ERDE0011` | Presenting complaint | service-specific |
| `ERDE0012` | Red flag finding | service-specific |
| `ERDE0013` | Resuscitation intervention | service-specific |
| `ERDE0014` | SpO2 (%) | service-specific |
| `ERDE0015` | Time of intervention | service-specific |
| `ERDE0016` | Urgency | service-specific |
| `EYDE0001` | Eye finding code | service-specific |
| `EYDE0002` | Intraocular pressure left | service-specific |
| `EYDE0003` | Intraocular pressure right | service-specific |
| `EYDE0004` | Presenting symptom | service-specific |
| `EYDE0005` | Visual acuity left | service-specific |
| `EYDE0006` | Visual acuity right | service-specific |
| `FPDE0001` | Adverse effect note | service-specific |
| `FPDE0002` | Contraceptive method code | service-specific |
| `FPDE0003` | Method preference | service-specific |
| `FPDE0004` | Service date | service-specific |
| `GNDE0001` | Clinical Notes | cross-cutting |
| `GNDE0002` | Performed By | cross-cutting |
| `GNDE0003` | Service Point | cross-cutting |
| `GNDE0004` | Care plan status | cross-cutting |
| `GNDE0005` | Clinical note | cross-cutting |
| `GNDE0006` | Clinical result | cross-cutting |
| `GNDE0007` | Consent status | cross-cutting |
| `GNDE0008` | Cost (local currency) | cross-cutting |
| `GNDE0009` | Counselling note | cross-cutting |
| `GNDE0010` | Danger signs | cross-cutting |
| `GNDE0011` | Date and time | cross-cutting |
| `GNDE0012` | Diagnosis coding system | cross-cutting |
| `GNDE0013` | Encounter date | cross-cutting |
| `GNDE0014` | Follow-up appointment | cross-cutting |
| `GNDE0015` | Follow-up status | cross-cutting |
| `GNDE0016` | Gestational age weeks | cross-cutting |
| `GNDE0017` | Invoice reference | cross-cutting |
| `GNDE0018` | Nutrition classification | cross-cutting |
| `GNDE0019` | Outcome date | cross-cutting |
| `GNDE0020` | Pain score (0-10) | cross-cutting |
| `GNDE0021` | Payment status | cross-cutting |
| `GNDE0022` | Procedure code | cross-cutting |
| `GNDE0023` | Procedure coding system | cross-cutting |
| `GNDE0024` | Procedure status | cross-cutting |
| `GNDE0025` | Quantity | cross-cutting |
| `GNDE0026` | Respiratory rate (per min) | cross-cutting |
| `GNDE0027` | Responsible clinician identifier | cross-cutting |
| `GNDE0028` | Temperature (C) | cross-cutting |
| `GNDE0029` | Treatment adherence | cross-cutting |
| `GNDE0030` | Treatment adverse effect | cross-cutting |
| `GNDE0031` | Workflow status | cross-cutting |
| `HVDE0001` | ART start date | service-specific |
| `HVDE0002` | Baseline clinical stage | service-specific |
| `HVDE0003` | CD4 count | service-specific |
| `HVDE0004` | Confirmed diagnosis date | service-specific |
| `HVDE0005` | Next review date | service-specific |
| `HVDE0006` | Service delivery model | service-specific |
| `HVDE0007` | Stock transaction reference | service-specific |
| `HVDE0008` | Viral load copies/mL | service-specific |
| `ICDE0001` | Closure date | service-specific |
| `ICDE0002` | IPC event classification | service-specific |
| `ICDE0003` | Incident date | service-specific |
| `ICDE0004` | Incident reference | service-specific |
| `ICDE0005` | Intervention action | service-specific |
| `ICDE0006` | Investigation findings | service-specific |
| `ICDE0007` | Lessons learned | service-specific |
| `ICDE0008` | Service point | service-specific |
| `IMDE0001` | AEFI clinical description | service-specific |
| `IMDE0002` | AEFI onset | service-specific |
| `IMDE0003` | AEFI severity | service-specific |
| `IMDE0004` | Administration date | service-specific |
| `IMDE0005` | Birth date verified | service-specific |
| `IMDE0006` | Caregiver identifier | service-specific |
| `IMDE0007` | Dose sequence | service-specific |
| `IMDE0008` | Due date | service-specific |
| `IMDE0009` | Vaccination card reference | service-specific |
| `IMDE0010` | Vaccination status | service-specific |
| `IMDE0011` | Vaccinator identifier | service-specific |
| `IMDE0012` | Vaccine antigen code | service-specific |
| `IMDE0013` | Vaccine lot number | service-specific |
| `IPDE0001` | Actual Administration Time | service-specific |
| `IPDE0002` | Administered By | service-specific |
| `IPDE0003` | Administration Outcome | service-specific |
| `IPDE0004` | Admission Date and Time | service-specific |
| `IPDE0005` | Admission Diagnosis | service-specific |
| `IPDE0006` | Admission ID | service-specific |
| `IPDE0007` | Admission Request ID | service-specific |
| `IPDE0008` | Admission Source | service-specific |
| `IPDE0009` | Admitting Clinician | service-specific |
| `IPDE0010` | Adverse Reaction | service-specific |
| `IPDE0011` | Airway Status | service-specific |
| `IPDE0012` | Allergy Description | service-specific |
| `IPDE0013` | Anesthesia Type | service-specific |
| `IPDE0014` | Assessment Summary | service-specific |
| `IPDE0015` | Assessment Time | service-specific |
| `IPDE0016` | Assigned Bed | service-specific |
| `IPDE0017` | Assigned Ward | service-specific |
| `IPDE0018` | Authorising Clinician | service-specific |
| `IPDE0019` | Batch Number | service-specific |
| `IPDE0020` | Bed Request Time | service-specific |
| `IPDE0021` | Blood Product Code | service-specific |
| `IPDE0022` | Blood Unit Identifier | service-specific |
| `IPDE0023` | Body Region | service-specific |
| `IPDE0024` | Booking Outcome | service-specific |
| `IPDE0025` | Care Goal | service-specific |
| `IPDE0026` | Care Plan | service-specific |
| `IPDE0027` | Caregiver Instructions | service-specific |
| `IPDE0028` | Cause of Death Summary | service-specific |
| `IPDE0029` | Certifying Clinician | service-specific |
| `IPDE0030` | Charge Amount | service-specific |
| `IPDE0031` | Charge ID | service-specific |
| `IPDE0032` | Charge Item Code | service-specific |
| `IPDE0033` | Charge Source Event ID | service-specific |
| `IPDE0034` | Claim Reference | service-specific |
| `IPDE0035` | Clinical Indication | service-specific |
| `IPDE0036` | Clinical Opinion | service-specific |
| `IPDE0037` | Clinical Priority | service-specific |
| `IPDE0038` | Collection Time | service-specific |
| `IPDE0039` | Collector ID | service-specific |
| `IPDE0040` | Compatibility Result | service-specific |
| `IPDE0041` | Complication Identified | service-specific |
| `IPDE0042` | Complications | service-specific |
| `IPDE0043` | Consent Status | service-specific |
| `IPDE0044` | Consultant ID | service-specific |
| `IPDE0045` | Consultation Date Time | service-specific |
| `IPDE0046` | Consultation Request ID | service-specific |
| `IPDE0047` | Critical Care Plan | service-specific |
| `IPDE0048` | Critical Result Alert | service-specific |
| `IPDE0049` | Currency Code | service-specific |
| `IPDE0050` | Current Medicines | service-specific |
| `IPDE0051` | Date Time of Death | service-specific |
| `IPDE0052` | Death Certification Reference | service-specific |
| `IPDE0053` | Diagnosis Classification | service-specific |
| `IPDE0054` | Diagnosis Code | service-specific |
| `IPDE0055` | Diagnosis Description | service-specific |
| `IPDE0056` | Diagnosis Onset Date | service-specific |
| `IPDE0057` | Diagnosis Status | service-specific |
| `IPDE0058` | Diastolic BP | service-specific |
| `IPDE0059` | Discharge Barriers | service-specific |
| `IPDE0060` | Discharge Condition | service-specific |
| `IPDE0061` | Discharge Date Time | service-specific |
| `IPDE0062` | Discharge Education | service-specific |
| `IPDE0063` | Discharge Medicines | service-specific |
| `IPDE0064` | Dispensing ID | service-specific |
| `IPDE0065` | Disposition | service-specific |
| `IPDE0066` | Dose | service-specific |
| `IPDE0067` | Dose Administered | service-specific |
| `IPDE0068` | Dose Unit | service-specific |
| `IPDE0069` | Early Warning Score | service-specific |
| `IPDE0070` | Encounter ID | service-specific |
| `IPDE0071` | End Date Time | service-specific |
| `IPDE0072` | Escalation Action | service-specific |
| `IPDE0073` | Escalation Level | service-specific |
| `IPDE0074` | Escalation Time | service-specific |
| `IPDE0075` | Escalation Trigger | service-specific |
| `IPDE0076` | Estimated Discharge Date | service-specific |
| `IPDE0077` | Expiry Date | service-specific |
| `IPDE0078` | Fall Risk | service-specific |
| `IPDE0079` | Family Notified | service-specific |
| `IPDE0080` | Final Diagnosis | service-specific |
| `IPDE0081` | Financial Clearance Status | service-specific |
| `IPDE0082` | Fluid Balance Note | service-specific |
| `IPDE0083` | Fluid Type | service-specific |
| `IPDE0084` | Follow Up Appointment | service-specific |
| `IPDE0085` | Follow Up Date | service-specific |
| `IPDE0086` | Follow Up Outcome | service-specific |
| `IPDE0087` | Follow Up Plan | service-specific |
| `IPDE0088` | Follow Up Required | service-specific |
| `IPDE0089` | Frequency | service-specific |
| `IPDE0090` | From Bed | service-specific |
| `IPDE0091` | From Ward | service-specific |
| `IPDE0092` | Glasgow Coma Score | service-specific |
| `IPDE0093` | Handover Completed | service-specific |
| `IPDE0094` | Handover Summary | service-specific |
| `IPDE0095` | Handover Time | service-specific |
| `IPDE0096` | History of Present Illness | service-specific |
| `IPDE0097` | Home Medication Dose | service-specific |
| `IPDE0098` | Home Medication Frequency | service-specific |
| `IPDE0099` | Home Medicines | service-specific |
| `IPDE0100` | Identity Verified | service-specific |
| `IPDE0101` | Imaging Modality | service-specific |
| `IPDE0102` | Imaging Request ID | service-specific |
| `IPDE0103` | Infection Control Action | service-specific |
| `IPDE0104` | Infection Control Review | service-specific |
| `IPDE0105` | Infection Risk | service-specific |
| `IPDE0106` | Infusion Order ID | service-specific |
| `IPDE0107` | Infusion Rate ML Per Hour | service-specific |
| `IPDE0108` | Intake Type | service-specific |
| `IPDE0109` | Intake Volume ML | service-specific |
| `IPDE0110` | Intervention | service-specific |
| `IPDE0111` | Intervention Date Time | service-specific |
| `IPDE0112` | Invoice ID | service-specific |
| `IPDE0113` | Isolation End | service-specific |
| `IPDE0114` | Isolation Start | service-specific |
| `IPDE0115` | Isolation Type | service-specific |
| `IPDE0116` | Laboratory Request ID | service-specific |
| `IPDE0117` | Measurement Time | service-specific |
| `IPDE0118` | Medication Name | service-specific |
| `IPDE0119` | Medication Order ID | service-specific |
| `IPDE0120` | Medication Reconciliation Action | service-specific |
| `IPDE0121` | Medicine Code | service-specific |
| `IPDE0122` | Medicine Name | service-specific |
| `IPDE0123` | Mortuary Transfer Reference | service-specific |
| `IPDE0124` | Next of Kin Contact | service-specific |
| `IPDE0125` | Nursing Care Needs | service-specific |
| `IPDE0126` | Nursing Intervention | service-specific |
| `IPDE0127` | Nursing Problem | service-specific |
| `IPDE0128` | Observation Time | service-specific |
| `IPDE0129` | Omission Reason | service-specific |
| `IPDE0130` | Operation Notes | service-specific |
| `IPDE0131` | Originating OPD Event ID | service-specific |
| `IPDE0132` | Output Type | service-specific |
| `IPDE0133` | Output Volume ML | service-specific |
| `IPDE0134` | Oxygen Delivery | service-specific |
| `IPDE0135` | Oxygen Saturation Percent | service-specific |
| `IPDE0136` | Pain Score | service-specific |
| `IPDE0137` | Past Medical History | service-specific |
| `IPDE0138` | Payer Type | service-specific |
| `IPDE0139` | Payment Amount | service-specific |
| `IPDE0140` | Payment Method | service-specific |
| `IPDE0141` | Payment Reference | service-specific |
| `IPDE0142` | Payment Status | service-specific |
| `IPDE0143` | Pharmacist ID | service-specific |
| `IPDE0144` | Physical Examination | service-specific |
| `IPDE0145` | Postoperative Diagnosis | service-specific |
| `IPDE0146` | Preoperative Diagnosis | service-specific |
| `IPDE0147` | Prescriber | service-specific |
| `IPDE0148` | Prescription ID | service-specific |
| `IPDE0149` | Presenting Concerns | service-specific |
| `IPDE0150` | Pressure Injury Risk | service-specific |
| `IPDE0151` | Procedure Clinician | service-specific |
| `IPDE0152` | Procedure Code | service-specific |
| `IPDE0153` | Procedure Date Time | service-specific |
| `IPDE0154` | Procedure ID | service-specific |
| `IPDE0155` | Procedure Name | service-specific |
| `IPDE0156` | Procedure Notes | service-specific |
| `IPDE0157` | Procedure Outcome | service-specific |
| `IPDE0158` | Procedures Summary | service-specific |
| `IPDE0159` | Progress Note | service-specific |
| `IPDE0160` | Progress SOAP Assessment | service-specific |
| `IPDE0161` | Progress SOAP Objective | service-specific |
| `IPDE0162` | Progress SOAP Plan | service-specific |
| `IPDE0163` | Progress SOAP Subjective | service-specific |
| `IPDE0164` | Proposed Admission Type | service-specific |
| `IPDE0165` | Pulse Per Minute | service-specific |
| `IPDE0166` | Quantity Issued | service-specific |
| `IPDE0167` | Quantity Ordered | service-specific |
| `IPDE0168` | Readmission Reference | service-specific |
| `IPDE0169` | Reason for Admission | service-specific |
| `IPDE0170` | Reason for Consultation | service-specific |
| `IPDE0171` | Receiving Contact | service-specific |
| `IPDE0172` | Receiving Facility | service-specific |
| `IPDE0173` | Receiving Staff | service-specific |
| `IPDE0174` | Recommendations | service-specific |
| `IPDE0175` | Reconciliation Reason | service-specific |
| `IPDE0176` | Recorded By | service-specific |
| `IPDE0177` | Recovery Disposition | service-specific |
| `IPDE0178` | Recovery Score | service-specific |
| `IPDE0179` | Recovery Start Time | service-specific |
| `IPDE0180` | Reference Range | service-specific |
| `IPDE0181` | Referral ID | service-specific |
| `IPDE0182` | Referral Priority | service-specific |
| `IPDE0183` | Referral Reason | service-specific |
| `IPDE0184` | Referral Status | service-specific |
| `IPDE0185` | Referred From | service-specific |
| `IPDE0186` | Report Findings | service-specific |
| `IPDE0187` | Report Impression | service-specific |
| `IPDE0188` | Reporting Clinician | service-specific |
| `IPDE0189` | Request Time | service-specific |
| `IPDE0190` | Requested Ward | service-specific |
| `IPDE0191` | Respiratory Rate Per Minute | service-specific |
| `IPDE0192` | Response to Care | service-specific |
| `IPDE0193` | Responsible Clinician | service-specific |
| `IPDE0194` | Responsible Nurse | service-specific |
| `IPDE0195` | Result Interpretation | service-specific |
| `IPDE0196` | Result Time | service-specific |
| `IPDE0197` | Result Unit | service-specific |
| `IPDE0198` | Result Value | service-specific |
| `IPDE0199` | Reviewed By | service-specific |
| `IPDE0200` | Round Time | service-specific |
| `IPDE0201` | Route | service-specific |
| `IPDE0202` | Safety Checklist Complete | service-specific |
| `IPDE0203` | Sample Type | service-specific |
| `IPDE0204` | Scheduled Dose Time | service-specific |
| `IPDE0205` | Secondary Diagnoses | service-specific |
| `IPDE0206` | Service Category | service-specific |
| `IPDE0207` | Session Date Time | service-specific |
| `IPDE0208` | Shift | service-specific |
| `IPDE0209` | Specialty | service-specific |
| `IPDE0210` | Specimen Condition | service-specific |
| `IPDE0211` | Specimen ID | service-specific |
| `IPDE0212` | Start Date Time | service-specific |
| `IPDE0213` | Study Date Time | service-specific |
| `IPDE0214` | Study Reference | service-specific |
| `IPDE0215` | Surgeon ID | service-specific |
| `IPDE0216` | Surgery End Time | service-specific |
| `IPDE0217` | Surgery ID | service-specific |
| `IPDE0218` | Surgery Start Time | service-specific |
| `IPDE0219` | Surgical History | service-specific |
| `IPDE0220` | Surgical Procedure | service-specific |
| `IPDE0221` | Systolic BP | service-specific |
| `IPDE0222` | Temperature Celsius | service-specific |
| `IPDE0223` | Test Code | service-specific |
| `IPDE0224` | Test Name | service-specific |
| `IPDE0225` | Test Order ID | service-specific |
| `IPDE0226` | To Bed | service-specific |
| `IPDE0227` | To Ward | service-specific |
| `IPDE0228` | Total Volume ML | service-specific |
| `IPDE0229` | Transfer ID | service-specific |
| `IPDE0230` | Transfer Reason | service-specific |
| `IPDE0231` | Transfer Time | service-specific |
| `IPDE0232` | Transfusion End | service-specific |
| `IPDE0233` | Transfusion Order ID | service-specific |
| `IPDE0234` | Transfusion Outcome | service-specific |
| `IPDE0235` | Transfusion Start | service-specific |
| `IPDE0236` | Treatment Summary | service-specific |
| `IPDE0237` | Verified By | service-specific |
| `IPDE0238` | Waiver or Exemption | service-specific |
| `IPDE0239` | Witnessed By | service-specific |
| `IPDE0240` | Workflow Status | service-specific |
| `IPDE0241` | Working Diagnosis | service-specific |
| `IVDE0001` | INV - Adjustment Approval | service-specific |
| `IVDE0002` | INV - Approved By | service-specific |
| `IVDE0003` | INV - Authorisation Reference | service-specific |
| `IVDE0004` | INV - Base Unit | service-specific |
| `IVDE0005` | INV - Batch or Lot Number | service-specific |
| `IVDE0006` | INV - Consumption Context | service-specific |
| `IVDE0007` | INV - Count Date | service-specific |
| `IVDE0008` | INV - Count Reference | service-specific |
| `IVDE0009` | INV - Counted Quantity | service-specific |
| `IVDE0010` | INV - Destination Stock Location | service-specific |
| `IVDE0011` | INV - Dispatch Reference | service-specific |
| `IVDE0012` | INV - Disposal Method | service-specific |
| `IVDE0013` | INV - Expected Delivery | service-specific |
| `IVDE0014` | INV - Expiry Date | service-specific |
| `IVDE0015` | INV - Goods Received Note | service-specific |
| `IVDE0016` | INV - Linked Order ID | service-specific |
| `IVDE0017` | INV - Linked Visit ID | service-specific |
| `IVDE0018` | INV - Opening Quantity | service-specific |
| `IVDE0019` | INV - Ordered Quantity | service-specific |
| `IVDE0020` | INV - Patient Reference Token | service-specific |
| `IVDE0021` | INV - Performed By User ID | service-specific |
| `IVDE0022` | INV - Prescription ID | service-specific |
| `IVDE0023` | INV - Purchase Order Reference | service-specific |
| `IVDE0024` | INV - Quality Assessment | service-specific |
| `IVDE0025` | INV - Quantity | service-specific |
| `IVDE0026` | INV - Reason | service-specific |
| `IVDE0027` | INV - Requested Quantity | service-specific |
| `IVDE0028` | INV - Requesting Service Point | service-specific |
| `IVDE0029` | INV - Required By | service-specific |
| `IVDE0030` | INV - Requisition ID | service-specific |
| `IVDE0031` | INV - Reservation Expiry | service-specific |
| `IVDE0032` | INV - Reservation ID | service-specific |
| `IVDE0033` | INV - Reserved Quantity | service-specific |
| `IVDE0034` | INV - Return Source | service-specific |
| `IVDE0035` | INV - Service Event ID | service-specific |
| `IVDE0036` | INV - Source Operation ID | service-specific |
| `IVDE0037` | INV - Source Stock Location | service-specific |
| `IVDE0038` | INV - Stock Location | service-specific |
| `IVDE0039` | INV - Supplier Name | service-specific |
| `IVDE0040` | INV - System Quantity | service-specific |
| `IVDE0041` | INV - Transaction ID | service-specific |
| `IVDE0042` | INV - Transaction Status | service-specific |
| `IVDE0043` | INV - Transaction Time | service-specific |
| `IVDE0044` | INV - Transaction Type | service-specific |
| `IVDE0045` | INV - Transfer Reference | service-specific |
| `IVDE0046` | INV - Unit Cost | service-specific |
| `LBDE0001` | Analyzer reference | cross-cutting |
| `LBDE0002` | Collection date and time | cross-cutting |
| `LBDE0003` | Critical result alert | cross-cutting |
| `LBDE0004` | Notification time | cross-cutting |
| `LBDE0005` | Notified clinician ID | cross-cutting |
| `LBDE0006` | Order status | cross-cutting |
| `LBDE0007` | Quality control result | cross-cutting |
| `LBDE0008` | Reference interval | cross-cutting |
| `LBDE0009` | Result authorised by | cross-cutting |
| `LBDE0010` | Result units | cross-cutting |
| `LBDE0011` | Result value text | cross-cutting |
| `LBDE0012` | Specimen reference | cross-cutting |
| `LBDE0013` | Specimen status | cross-cutting |
| `LBDE0014` | Test catalogue code | cross-cutting |
| `MDDE0001` | Prescription reference | cross-cutting |
| `MDDE0002` | Treatment regimen code | cross-cutting |
| `MHDE0001` | Mental health risk | service-specific |
| `MHDE0002` | Mental state examination | service-specific |
| `MHDE0003` | Presenting concern | service-specific |
| `MHDE0004` | Suicide risk note | service-specific |
| `MHDE0005` | Therapy session summary | service-specific |
| `MTDE0001` | Birth date and time | service-specific |
| `MTDE0002` | Birth mode | service-specific |
| `MTDE0003` | Birth outcome | service-specific |
| `MTDE0004` | Cervical dilatation cm | service-specific |
| `MTDE0005` | Contraction frequency | service-specific |
| `MTDE0006` | Discharge date | service-specific |
| `MTDE0007` | Estimated blood loss (mL) | service-specific |
| `MTDE0008` | Fetal heart rate | service-specific |
| `MTDE0009` | Intervention indication | service-specific |
| `MTDE0010` | Labour onset time | service-specific |
| `MTDE0011` | Maternal disposition | service-specific |
| `MTDE0012` | Maternal risk note | service-specific |
| `MTDE0013` | Newborn linked patient identifier | service-specific |
| `MTDE0014` | Postpartum complication | service-specific |
| `NCDE0001` | Cardiovascular risk factors | service-specific |
| `NCDE0002` | Diabetes type | service-specific |
| `NCDE0003` | Fasting glucose (mmol/L) | service-specific |
| `NCDE0004` | Foot exam result | service-specific |
| `NCDE0005` | HbA1c (%) | service-specific |
| `NCDE0006` | Hypertension diagnosis | service-specific |
| `NCDE0007` | Renal risk note | service-specific |
| `NCDE0008` | Retinal screening result | service-specific |
| `NCDE0009` | Urine albumin result | service-specific |
| `NUDE0001` | Diet plan reference | service-specific |
| `NUDE0002` | Nutrition response | service-specific |
| `ONDE0001` | Cycle number | service-specific |
| `ONDE0002` | Decision date | service-specific |
| `ONDE0003` | Diagnosis date | service-specific |
| `ONDE0004` | Histology terminology code | service-specific |
| `ONDE0005` | Palliative intervention | service-specific |
| `ONDE0006` | Primary cancer site code | service-specific |
| `ONDE0007` | Protocol code | service-specific |
| `ONDE0008` | Radiotherapy course reference | service-specific |
| `ONDE0009` | Stage at diagnosis | service-specific |
| `ONDE0010` | Treatment administration date | service-specific |
| `ONDE0011` | Treatment response code | service-specific |
| `OPDE0001` | Adverse Event | service-specific |
| `OPDE0002` | Billing Balance UGX | service-specific |
| `OPDE0003` | Billing Clearance Date Time | service-specific |
| `OPDE0004` | Billing Clearance Granted | service-specific |
| `OPDE0005` | Billing Clearance Reason | service-specific |
| `OPDE0006` | Charge Description | service-specific |
| `OPDE0007` | Charge Discount Amount UGX | service-specific |
| `OPDE0008` | Charge Gross Amount UGX | service-specific |
| `OPDE0009` | Charge Line Reference | service-specific |
| `OPDE0010` | Charge Net Amount UGX | service-specific |
| `OPDE0011` | Charge Quantity | service-specific |
| `OPDE0012` | Charge Service Category | service-specific |
| `OPDE0013` | Charge Source Reference | service-specific |
| `OPDE0014` | Charge Status | service-specific |
| `OPDE0015` | Charge Unit Price UGX | service-specific |
| `OPDE0016` | Check-in Time | service-specific |
| `OPDE0017` | Clinical Examination | service-specific |
| `OPDE0018` | Clinical Outcome | service-specific |
| `OPDE0019` | Clinical Plan | service-specific |
| `OPDE0020` | Collection Date Time | service-specific |
| `OPDE0021` | Critical Result Escalated | service-specific |
| `OPDE0022` | Diastolic Blood Pressure | service-specific |
| `OPDE0023` | Discharge Summary | service-specific |
| `OPDE0024` | Dispensing Date Time | service-specific |
| `OPDE0025` | Dispensing Notes | service-specific |
| `OPDE0026` | Disposition | service-specific |
| `OPDE0027` | Dose Unit | service-specific |
| `OPDE0028` | Duration Days | service-specific |
| `OPDE0029` | External Transaction Reference | service-specific |
| `OPDE0030` | Final Diagnosis | service-specific |
| `OPDE0031` | Follow-up Date | service-specific |
| `OPDE0032` | Follow-up Findings | service-specific |
| `OPDE0033` | Frequency | service-specific |
| `OPDE0034` | Heart Rate | service-specific |
| `OPDE0035` | Height Cm | service-specific |
| `OPDE0036` | History of Present Illness | service-specific |
| `OPDE0037` | Identity Verified | service-specific |
| `OPDE0038` | Imaging Body Site | service-specific |
| `OPDE0039` | Imaging Clinical Indication | service-specific |
| `OPDE0040` | Imaging Findings | service-specific |
| `OPDE0041` | Imaging Impression | service-specific |
| `OPDE0042` | Imaging Modality | service-specific |
| `OPDE0043` | Imaging Performed Date Time | service-specific |
| `OPDE0044` | Invoice Reference | service-specific |
| `OPDE0045` | Laboratory Reference Range | service-specific |
| `OPDE0046` | Laboratory Report Date Time | service-specific |
| `OPDE0047` | Laboratory Result Interpretation | service-specific |
| `OPDE0048` | Laboratory Result Units | service-specific |
| `OPDE0049` | Laboratory Result Value | service-specific |
| `OPDE0050` | Laboratory Test Name | service-specific |
| `OPDE0051` | Laboratory Test Requested | service-specific |
| `OPDE0052` | Medicine Dispensed | service-specific |
| `OPDE0053` | Medicine Prescribed | service-specific |
| `OPDE0054` | Order Priority | service-specific |
| `OPDE0055` | Order Reference | service-specific |
| `OPDE0056` | Oxygen Saturation Percent | service-specific |
| `OPDE0057` | Payer Category | service-specific |
| `OPDE0058` | Payment Amount UGX | service-specific |
| `OPDE0059` | Payment Date Time | service-specific |
| `OPDE0060` | Payment Method | service-specific |
| `OPDE0061` | Payment Notes | service-specific |
| `OPDE0062` | Payment Reference | service-specific |
| `OPDE0063` | Payment Status | service-specific |
| `OPDE0064` | Prescribed Dose | service-specific |
| `OPDE0065` | Procedure Date Time | service-specific |
| `OPDE0066` | Procedure Name | service-specific |
| `OPDE0067` | Procedure Outcome | service-specific |
| `OPDE0068` | Provisional Diagnosis | service-specific |
| `OPDE0069` | Quantity Dispensed | service-specific |
| `OPDE0070` | Quantity Prescribed | service-specific |
| `OPDE0071` | Queue Number | service-specific |
| `OPDE0072` | Reason for Visit | service-specific |
| `OPDE0073` | Referral Date | service-specific |
| `OPDE0074` | Referral Destination | service-specific |
| `OPDE0075` | Referral Reason | service-specific |
| `OPDE0076` | Referral Status | service-specific |
| `OPDE0077` | Referral Type | service-specific |
| `OPDE0078` | Registration Notes | service-specific |
| `OPDE0079` | Request Indication | service-specific |
| `OPDE0080` | Request Status | service-specific |
| `OPDE0081` | Requested Service | service-specific |
| `OPDE0082` | Respiratory Rate | service-specific |
| `OPDE0083` | Return Precautions | service-specific |
| `OPDE0084` | Route of Administration | service-specific |
| `OPDE0085` | Specimen Identifier | service-specific |
| `OPDE0086` | Specimen Notes | service-specific |
| `OPDE0087` | Specimen Received Date Time | service-specific |
| `OPDE0088` | Specimen Type | service-specific |
| `OPDE0089` | Systolic Blood Pressure | service-specific |
| `OPDE0090` | Temperature Celsius | service-specific |
| `OPDE0091` | Triage Category | service-specific |
| `OPDE0092` | Triage Complaint | service-specific |
| `OPDE0093` | Visit Payment Category | service-specific |
| `OPDE0094` | Visit Reference | service-specific |
| `OPDE0095` | Weight Kg | service-specific |
| `PNDE0001` | Breastfeeding counselling | service-specific |
| `PNDE0002` | Delivery date | service-specific |
| `PNDE0003` | Delivery facility | service-specific |
| `PNDE0004` | Jaundice assessment | service-specific |
| `PNDE0005` | Mother linked patient identifier | service-specific |
| `PNDE0006` | Newborn danger signs | service-specific |
| `RDDE0001` | Appointment date | service-specific |
| `RDDE0002` | Body site code | service-specific |
| `RDDE0003` | Contrast administered | service-specific |
| `RDDE0004` | Imaging study identifier | service-specific |
| `RDDE0005` | Modality code | service-specific |
| `RDDE0006` | Radiology report | service-specific |
| `RDDE0007` | Reported date | service-specific |
| `RFDE0001` | Referral reference | cross-cutting |
| `RHDE0001` | Discharge recommendation | service-specific |
| `RHDE0002` | Functional baseline scale | service-specific |
| `RHDE0003` | Functional outcome score | service-specific |
| `RHDE0004` | Session duration minutes | service-specific |
| `RHDE0005` | Therapy goal | service-specific |
| `RHDE0006` | Therapy intervention code | service-specific |
| `RNDE0001` | Baseline renal function note | service-specific |
| `RNDE0002` | Complication note | service-specific |
| `RNDE0003` | Dialysis duration minutes | service-specific |
| `RNDE0004` | Dialysis session status | service-specific |
| `RNDE0005` | Post dialysis weight kg | service-specific |
| `RNDE0006` | Pre dialysis weight kg | service-specific |
| `RNDE0007` | Renal diagnosis code | service-specific |
| `RNDE0008` | Vascular access type | service-specific |
| `SUDE0001` | Anaesthesia risk classification | service-specific |
| `SUDE0002` | Operative note | service-specific |
| `SUDE0003` | Planned procedure code | service-specific |
| `SUDE0004` | Postoperative complication | service-specific |
| `SUDE0005` | Preoperative findings | service-specific |
| `SUDE0006` | Procedure end time | service-specific |
| `SUDE0007` | Procedure start time | service-specific |
| `SUDE0008` | Sign-in completed | service-specific |
| `SUDE0009` | Sign-out completed | service-specific |
| `SUDE0010` | Surgery date | service-specific |
| `SUDE0011` | Time-out completed | service-specific |
| `SUDE0012` | Wound classification | service-specific |
| `TBDE0001` | Contact patient identifier | service-specific |
| `TBDE0002` | Disease classification | service-specific |
| `TBDE0003` | Index case reference | service-specific |
| `TBDE0004` | Molecular test result | service-specific |
| `TBDE0005` | Screening result | service-specific |
| `TBDE0006` | Smear result | service-specific |
| `TBDE0007` | Symptoms duration days | service-specific |
| `TBDE0008` | TB outcome | service-specific |
| `TBDE0009` | Treatment phase | service-specific |
| `TBDE0010` | Treatment start date | service-specific |
| `VSDE0001` | Birth weight (g) | cross-cutting |
| `VSDE0002` | Diastolic BP (mmHg) | cross-cutting |
| `VSDE0003` | Height (cm) | cross-cutting |
| `VSDE0004` | MUAC (mm) | cross-cutting |
| `VSDE0005` | Systolic BP (mmHg) | cross-cutting |
| `VSDE0006` | Weight (kg) | cross-cutting |
| `WFDE0001` | Encounter reference | cross-cutting |
| `WFDE0002` | Order reference | cross-cutting |

### programRules

| DER Code | Metadata name | Scope |
|---|---|---|
| `ANPR0001` | Gestational age weeks warning | service-specific |
| `ANPR0002` | Systolic BP (mmHg) warning | service-specific |
| `ERPR0001` | Heart rate (per min) warning | service-specific |
| `ERPR0002` | Oxygen Saturation (SpO2) (%) warning | service-specific |
| `IMPR0001` | Weight (kg) warning | service-specific |
| `NCPR0001` | Glycated Haemoglobin (HbA1c) (%) warning | service-specific |
| `NCPR0002` | Systolic BP (mmHg) warning | service-specific |
| `RNPR0001` | Dialysis duration minutes warning | service-specific |

### programIndicators

| DER Code | Metadata name | Scope |
|---|---|---|
| `ANPI0001` | Antenatal Care - Recorded Events | service-specific |
| `BBPI0001` | Blood Bank and Transfusion - Recorded Events | service-specific |
| `DNPI0001` | Dental and Oral Health - Recorded Events | service-specific |
| `ENPI0001` | Ear, Nose and Throat Services - Recorded Events | service-specific |
| `EQPI0001` | Facility Equipment and Maintenance - Recorded Events | service-specific |
| `ERPI0001` | Emergency and Resuscitation - Recorded Events | service-specific |
| `EYPI0001` | Eye and Vision Care - Recorded Events | service-specific |
| `FPPI0001` | Family Planning and Reproductive Health - Recorded Events | service-specific |
| `HVPI0001` | HIV Care and Antiretroviral Therapy - Recorded Events | service-specific |
| `ICPI0001` | Hospital Infection Prevention and Control - Recorded Events | service-specific |
| `IMPI0001` | Child Health and Immunisation - Recorded Events | service-specific |
| `IPPI0001` | Integrated Inpatient EMR - Recorded Events | service-specific |
| `IVPI0001` | Inventory and Supplies Tracker - Recorded Events | service-specific |
| `LBPI0001` | Laboratory Diagnostics - Recorded Events | cross-cutting |
| `MHPI0001` | Mental Health and Psychiatry - Recorded Events | service-specific |
| `MTPI0001` | Labour and Delivery Care - Recorded Events | service-specific |
| `NCPI0001` | Diabetes and Hypertension Care - Recorded Events | service-specific |
| `NUPI0001` | Nutrition and Dietetics - Recorded Events | service-specific |
| `ONPI0001` | Cancer and Oncology - Recorded Events | service-specific |
| `OPPI0001` | Integrated Outpatient EMR - Recorded Events | service-specific |
| `PNPI0001` | Postnatal and Newborn Follow-up - Recorded Events | service-specific |
| `RDPI0001` | Imaging and Radiology - Recorded Events | service-specific |
| `RHPI0001` | Rehabilitation and Physiotherapy - Recorded Events | service-specific |
| `RNPI0001` | Renal Care and Dialysis - Recorded Events | service-specific |
| `SUPI0001` | Surgical and Theatre Services - Recorded Events | service-specific |
| `TBPI0001` | Tuberculosis and Leprosy Care - Recorded Events | service-specific |
