import { createReference } from '@medplum/core';
import { buildMenopauseCarePlanBundle, MENOPAUSE_PLAN } from '@epa/careplan-menopausia';
import type { Goal } from '@medplum/fhirtypes';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetasDelPlan, PasosDelPlan } from '../src/index';
import { crearEscenario, renderConProveedores, HOY } from './renderConPlan';

describe('tolerancia a referencias rotas (404 en el servidor)', () => {
  it('muestra el plan aunque un Goal referenciado haya sido borrado', async () => {
    const { medplum, maria } = await crearEscenario();
    await medplum.executeBatch(
      buildMenopauseCarePlanBundle({ patient: createReference(maria), now: HOY }),
    );

    // Simular la limpieza manual: borrar un Goal que el CarePlan referencia.
    const metas = await medplum.searchResources('Goal', { subject: `Patient/${maria.id}` });
    expect(metas.length).toBeGreaterThan(0);
    await medplum.deleteResource('Goal', (metas[0] as Goal).id as string);
    medplum.invalidateSearches('Goal');
    medplum.invalidateSearches('CarePlan');
    medplum.invalidateSearches('Task');

    renderConProveedores(medplum, <PasosDelPlan patient={maria} />);

    // La pagina del plan carga igual: NO dice "Todavia no empezaste el plan".
    expect(await screen.findByText('Tu plan de 100 días')).toBeInTheDocument();
    expect(screen.queryByText(/Todavia no empezaste el plan/)).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(MENOPAUSE_PLAN.activities.length);
  });

  it('las metas muestran las que siguen existiendo', async () => {
    const { medplum, maria } = await crearEscenario();
    await medplum.executeBatch(
      buildMenopauseCarePlanBundle({ patient: createReference(maria), now: HOY }),
    );
    const metas = await medplum.searchResources('Goal', { subject: `Patient/${maria.id}` });
    await medplum.deleteResource('Goal', (metas[0] as Goal).id as string);
    medplum.invalidateSearches('Goal');
    medplum.invalidateSearches('CarePlan');

    renderConProveedores(medplum, <MetasDelPlan patient={maria} />);

    expect(await screen.findByText('Mis metas de salud')).toBeInTheDocument();
    // Quedan visibles las metas que siguen existiendo (todas menos la borrada).
    const descripciones = await screen.findAllByText(/./, { selector: 'p' });
    expect(descripciones.length).toBeGreaterThan(0);
    expect(
      (await screen.findAllByText(/Estilo de vida|Cardiovascular|Metabolico|Renal|Bienestar/)).length,
    ).toBeGreaterThanOrEqual(MENOPAUSE_PLAN.goals.length - 1);
  });
});
