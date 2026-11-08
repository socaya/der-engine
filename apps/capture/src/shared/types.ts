/**
 * Shared typed domain contracts for the unified Capture app
 * (requirements doc §6.2, §10.2). Kept narrow and framework-free
 * so the metadata parser (G2) and the form engine (G3) can refine
 * them without ripping through consumer files.
 */

export interface ProgramOpt {
  readonly id: string;
  readonly displayName: string;
  readonly programType: 'WITH_REGISTRATION' | 'WITHOUT_REGISTRATION';
}

export interface StageOpt {
  readonly id: string;
  readonly displayName: string;
}

export interface EventRow {
  readonly event?: string;
  readonly eventUid?: string;
  readonly occurredAt?: string;
  readonly occurredDate?: string;
  readonly eventDate?: string;
  readonly programStage?: string;
  readonly programStageUid?: string;
  readonly status?: string | null;
  /** §EV1-A — dataElement UID → value. Present when the server
   *  surfaces it (ADR-wise, since the DER edge's list endpoint now
   *  ships this map alongside each event). Used by EventListPage
   *  to render metadata-driven columns without an N+1 detail fetch. */
  readonly dataValues?: Record<string, string>;
}

/** Narrow view onto {@code useDerApi()} used by Capture. Declared
 *  here so individual features don't each redeclare it. */
export interface CaptureApi {
  listPrograms: (orgUnit?: string) => Promise<Array<{
    id: string; displayName: string;
    programType: 'WITH_REGISTRATION' | 'WITHOUT_REGISTRATION';
  }>>;
  listCaptureProgramStages: (programUid: string) => Promise<{
    stages: Array<{ stageUid: string; displayName: string;
      repeatable?: boolean; sortOrder?: number }>;
  }>;
  getCaptureStageForm: (programUid: string, stageUid: string) => Promise<{
    sections: Array<{ displayName: string;
      fields: Array<{ fieldRef: string; dataElementUid: string;
        dataElementDisplayName: string; valueType: string;
        requirement: 'REQUIRED' | 'OPTIONAL' | 'READONLY' }>;
    }>;
  }>;
  listCaptureProgramEvents: (programUid: string, orgUnit: string,
    limit?: number) => Promise<{ events: EventRow[] }>;
  submitEvent: (body: {
    program: string; programStage?: string; orgUnit: string;
    occurredAt: string;
    dataValues: Array<{ dataElement: string; value: string }>;
    enrollment?: string;
    status?: string;
    event?: string;
  }) => Promise<unknown>;
  deleteEvent: (eventId: string) => Promise<{ deleted: true;
    eventId: string }>;
  listTrackerEntities: (program: string, orgUnit: string,
    limit?: number) => Promise<{
    instances?: Array<{ trackedEntity?: string;
      trackedEntityInstance?: string; displayName?: string;
      lastUpdated?: string; orgUnit?: string;
      attributes?: Record<string, string> }>;
    trackedEntities?: Array<{ trackedEntity?: string;
      trackedEntityInstance?: string; displayName?: string;
      lastUpdated?: string; orgUnit?: string;
      attributes?: Record<string, string> }>;
  }>;
  enrolTei: (body: { program: string; orgUnit: string;
    trackedEntityType: string;
    attributes: Array<{ attribute: string; value: string }>;
  }) => Promise<unknown>;
  createEnrollment: (body: {
    enrollmentUid: string;
    teiUid: string;
    programUid: string;
    orgUnitUid: string;
    enrollmentDate: string;
    incidentDate?: string;
    status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  }) => Promise<{ enrollmentUid: string; teiUid: string;
    programUid: string; orgUnitUid: string;
    status: string; enrollmentDate: string;
    incidentDate: string | null }>;
  listProgramRules: (programUid?: string) => Promise<ReadonlyArray<{
    id: string; displayName?: string; name?: string;
    program?: { id?: string } | null;
    programStage?: { id?: string } | null;
    condition?: string; description?: string;
    priority?: number | null;
    programRuleActions?: ReadonlyArray<{
      id: string; programRuleActionType?: string;
      content?: string; data?: string;
      dataElement?: { id?: string } | null;
      trackedEntityAttribute?: { id?: string } | null;
      programStage?: { id?: string } | null;
      programStageSection?: { id?: string } | null;
      location?: string;
    }>;
  }>>;
  listProgramRuleActions: () => Promise<ReadonlyArray<{
    id: string;
    programRule?: { id?: string };
    programRuleActionType?: string;
    content?: string; data?: string;
    dataElement?: { id?: string } | null;
    trackedEntityAttribute?: { id?: string } | null;
    programStage?: { id?: string } | null;
    programStageSection?: { id?: string } | null;
    location?: string;
  }>>;
  listProgramRuleVariables: (programUid?: string) =>
    Promise<ReadonlyArray<{
      id: string; displayName?: string; name?: string;
      program?: { id?: string } | null;
      programRuleVariableSourceType?: string;
      dataElement?: { id?: string } | null;
      trackedEntityAttribute?: { id?: string } | null;
      programStage?: { id?: string } | null;
      useCodeForOptionSet?: boolean; valueType?: string;
    }>>;
  getCaptureProgramTeiType: (programUid: string) => Promise<{
    trackedEntityTypeUid: string;
  } | null>;
  listCaptureTeiTypeAttributes: (teiTypeUid: string) => Promise<{
    count: number;
    attributes: ReadonlyArray<{
      attributeUid: string; displayName?: string;
      valueType?: string; optionSetUid?: string | null;
      searchable?: boolean; uniqueAttribute?: boolean;
      mandatory?: boolean; sortOrder?: number;
    }>;
  }>;
  listCaptureTeiEnrollments: (teiUid: string, programUid?: string) =>
    Promise<{
      count: number;
      enrollments: ReadonlyArray<{
        enrollmentUid: string; teiUid: string;
        programUid: string; orgUnitUid: string;
        status: string | null;
        enrollmentDate: string | null;
        incidentDate: string | null;
        lastUpdatedAt: string;
      }>;
    }>;
  listCaptureEnrollmentEvents: (enrollmentUid: string,
    programStageUid?: string) => Promise<{
      count: number;
      events: ReadonlyArray<{
        eventUid: string; enrollmentUid: string;
        programUid: string; programStageUid: string;
        orgUnitUid: string; status: string | null;
        occurredDate: string | null; lastUpdatedAt: string;
      }>;
    }>;
  getCaptureEventDetail: (eventUid: string) => Promise<{
    eventUid: string;
    enrollmentUid: string | null;
    programUid: string;
    programStageUid: string;
    orgUnitUid: string;
    occurredAt: string;
    status: string | null;
    dataValues: Record<string, string>;
  }>;
  listTrackerRelationships: (teiUid: string) => Promise<ReadonlyArray<{
    relationship?: string;
    relationshipType?: string;
    relationshipName?: string;
    bidirectional?: boolean;
    createdAt?: string;
    lastUpdated?: string;
    from?: {
      trackedEntity?: { trackedEntity?: string; displayName?: string };
      enrollment?: { enrollment?: string };
      event?: { event?: string };
    };
    to?: {
      trackedEntity?: { trackedEntity?: string; displayName?: string };
      enrollment?: { enrollment?: string };
      event?: { event?: string };
    };
  }>>;
  submitTrackerRelationship: (body: {
    relationshipType: string; fromTei: string; toTei: string;
  }) => Promise<{ ok: true } | { ok: false; status: number;
    message: string }>;
  deleteTrackerRelationship: (relationshipUid: string) =>
    Promise<{ ok: true } | { ok: false; status: number;
      message: string }>;
  listCaptureWorkflows: () => Promise<{
    workflows: ReadonlyArray<{
      workflowId: string;
      displayName: string;
      boundMetadataKind?: string;
      boundMetadataId?: string | null;
      enabled: boolean;
      version?: number;
      defaultDeviceId?: string | null;
    }>;
  }>;
  triggerSyncJob: (jobName: string) => Promise<boolean>;
  listCaptureRuns: (opts: { workflowId: string; state?: string })
    => Promise<{ count: number; runs: ReadonlyArray<{
      runId: string; workflowId: string; businessKey: string;
      currentStepId: string | null;
      state: 'OPEN' | 'AWAITING' | 'COMPLETED' | 'REJECTED';
      updatedAt: string;
    }> }>;
  getOptionSet: (optionSetUid: string) => Promise<{
    id: string;
    displayName?: string;
    name?: string;
    options?: ReadonlyArray<{
      id?: string; code?: string; displayName?: string;
      name?: string; sortOrder?: number;
    }>;
  } | null>;
  listRelationshipTypes: () => Promise<ReadonlyArray<{
    id: string;
    displayName?: string;
    name?: string;
    fromToName?: string;
    toFromName?: string;
    bidirectional?: boolean;
    fromConstraint?: {
      relationshipEntity?: string;
      trackedEntityType?: { id?: string } | null;
      program?: { id?: string } | null;
      programStage?: { id?: string } | null;
    };
    toConstraint?: {
      relationshipEntity?: string;
      trackedEntityType?: { id?: string } | null;
      program?: { id?: string } | null;
      programStage?: { id?: string } | null;
    };
  }>>;
}

/** G6 — body accepted by submitEvent when editing a tracker
 *  stage event. Extends the event-program shape with an
 *  enrolment ref so the DER edge journal can associate the
 *  event with its parent enrolment. */
export interface TrackerEventSubmit {
  readonly program: string;
  readonly programStage: string;
  readonly orgUnit: string;
  readonly occurredAt: string;
  readonly enrollment: string;
  readonly dataValues: Array<{ dataElement: string; value: string }>;
}
