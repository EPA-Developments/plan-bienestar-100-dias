import { buildMenopausePlanDefinition, MENOPAUSE_PLAN_DEFINITION_URL } from '@epa/careplan-menopausia';
import type { MedplumClient } from '@medplum/core';
import type { PlanDefinition } from '@medplum/fhirtypes';

/**
 * "Click 1" of the setup: makes sure the menopause PlanDefinition exists on
 * the server (idempotent). Returns the existing or newly created definition.
 *
 * Afterwards, administrators manage the plan entirely from the Medplum App:
 * toggling `status` (active/retired) or editing `useContext` changes who sees
 * the plan in every host app instantly — no redeploy ("click 2").
 */
export async function asegurarPlanDefinition(medplum: MedplumClient): Promise<PlanDefinition> {
  const existentes = await medplum.searchResources('PlanDefinition', {
    url: MENOPAUSE_PLAN_DEFINITION_URL,
  });
  const existente = existentes[0];
  if (existente) {
    return existente;
  }
  return medplum.createResource<PlanDefinition>(
    buildMenopausePlanDefinition({ now: new Date().toISOString().slice(0, 10) }),
  );
}
