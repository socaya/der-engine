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
}

/** Narrow view onto {@code useDerApi()} used by Capture. Declared
 *  here so individual features don't each redeclare it. */
export interface CaptureApi {
  listPrograms: (orgUnit?: string) => Promise<Array<{
    id: string; displayName: string;
    programType: 'WITH_REGISTRATION' | 'WITHOUT_REGISTRATION';
  }>>;
  listCaptureProgramStages: (programUid: string) => Promise<{
    stages: Array<{ programStageUid: string; displayName: string }>;
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
  }) => Promise<unknown>;
  listTrackerEntities: (program: string, orgUnit: string,
    limit?: number) => Promise<{
    instances?: Array<{ trackedEntity?: string;
      trackedEntityInstance?: string; displayName?: string;
      lastUpdated?: string; orgUnit?: string }>;
    trackedEntities?: Array<{ trackedEntity?: string;
      trackedEntityInstance?: string; displayName?: string;
      lastUpdated?: string; orgUnit?: string }>;
  }>;
  enrolTei: (body: { program: string; orgUnit: string;
    trackedEntityType: string;
    attributes: Array<{ attribute: string; value: string }>;
  }) => Promise<unknown>;
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
}
