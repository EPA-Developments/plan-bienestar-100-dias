import type { Coding } from '@medplum/fhirtypes';
import { SYSTEM } from './systems.js';

function sct(code: string, display: string): Coding {
  return { system: SYSTEM.snomed, code, display };
}

/**
 * SNOMED CT codings used by the menopause care plan.
 *
 * Verification status at authoring time:
 *  - `menopausePresent` (289903006) and `prematureMenopause` (373717006) were
 *    confirmed against public sources.
 *  - Codes marked `TODO confirm` are strong candidates that could NOT be
 *    verified against an authoritative source here. They MUST be validated in
 *    the official SNOMED CT browser (https://browser.ihtsdotools.org) against
 *    the deployment's SNOMED edition/version before clinical or production use.
 *
 * Keep this file as the single source of truth for SNOMED codes so a clinician
 * can review/replace them in one place.
 */
export const SNOMED = {
  // Life stage / condition ----------------------------------------------
  /** verified */
  menopausePresent: sct('289903006', 'Menopause present'),
  /** verified */
  prematureMenopause: sct('373717006', 'Premature menopause'),
  /** TODO confirm */
  perimenopausalState: sct('307409000', 'Perimenopausal state'),
  /** TODO confirm */
  postmenopausalState: sct('76498008', 'Postmenopausal state'),
  /** TODO confirm */
  surgicalMenopause: sct('67207009', 'Surgical menopause'),
  /** verified (related concept, used for vasomotor symptom education) */
  abnormalVasomotorFunction: sct('70670009', 'Abnormal vasomotor function'),

  // Cardiometabolic risk factors ----------------------------------------
  /** high confidence */
  overweight: sct('238131007', 'Overweight'),
  /** high confidence */
  obesity: sct('414916001', 'Obesity'),
  /** from EPA Bienestar terminology table */
  currentSmoker: sct('77176002', 'Smoker'),
  /** from EPA Bienestar terminology table */
  exSmoker: sct('8517006', 'Ex-smoker'),

  // CKM staging: conditions (stage 2) ------------------------------------
  /** high confidence */
  diabetesMellitus: sct('73211009', 'Diabetes mellitus'),
  /** high confidence */
  type2Diabetes: sct('44054006', 'Diabetes mellitus type 2'),
  /** high confidence */
  hypertension: sct('38341003', 'Hypertensive disorder, systemic arterial'),
  /** TODO confirm */
  metabolicSyndrome: sct('237602007', 'Metabolic syndrome X'),
  /** TODO confirm */
  chronicKidneyDisease: sct('709044004', 'Chronic kidney disease'),

  // CKM staging: clinical CVD (stage 4) -----------------------------------
  /** high confidence */
  coronaryArteriosclerosis: sct('53741008', 'Coronary arteriosclerosis'),
  /** high confidence */
  myocardialInfarction: sct('22298006', 'Myocardial infarction'),
  /** high confidence */
  stroke: sct('230690007', 'Cerebrovascular accident'),
  /** high confidence */
  heartFailure: sct('84114007', 'Heart failure'),
  /** TODO confirm */
  peripheralVascularDisease: sct('400047006', 'Peripheral vascular disease'),
  /** high confidence */
  atrialFibrillation: sct('49436004', 'Atrial fibrillation'),
  /** high confidence */
  endStageRenalDisease: sct('46177005', 'End-stage renal disease'),

  // Care artifacts -------------------------------------------------------
  /** high confidence */
  carePlanRecord: sct('734163000', 'Care plan'),
} as const;

export type SnomedKey = keyof typeof SNOMED;
