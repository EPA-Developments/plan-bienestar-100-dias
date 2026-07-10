import { createReference } from '@medplum/core';
import { buildMenopauseCarePlanBundle, MENOPAUSE_PLAN } from '@epa/careplan-menopausia';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PasosDelPlan } from '../src/index';
import { crearEscenario, renderConProveedores, HOY } from './renderConPlan';

describe('PasosDelPlan', () => {
  it('lista los pasos del CarePlan y permite completarlos', async () => {
    const { medplum, maria } = await crearEscenario();
    await medplum.executeBatch(
      buildMenopauseCarePlanBundle({ patient: createReference(maria), now: HOY }),
    );

    renderConProveedores(medplum, <PasosDelPlan patient={maria} />);

    expect(await screen.findByText(MENOPAUSE_PLAN.title)).toBeInTheDocument();
    const total = MENOPAUSE_PLAN.activities.length;
    expect(screen.getByText(`0 de ${total} pasos completados`, { exact: false })).toBeInTheDocument();

    const casillas = screen.getAllByRole('checkbox');
    expect(casillas).toHaveLength(total);

    await userEvent.click(casillas[0] as HTMLElement);
    expect(
      await screen.findByText(`1 de ${total} pasos completados`, { exact: false }),
    ).toBeInTheDocument();

    await waitFor(
      async () => {
        // Filtrado por paciente: el MockClient trae Tasks de ejemplo propias.
        const tareas = await medplum.searchResources('Task', {
          patient: `Patient/${maria.id}`,
          status: 'completed',
        });
        expect(tareas.length).toBe(1);
      },
      { timeout: 5000 },
    );
  });

  it('invita a empezar cuando no hay plan activo', async () => {
    const { medplum, maria } = await crearEscenario();
    renderConProveedores(medplum, <PasosDelPlan patient={maria} />);
    expect(await screen.findByText(/Todavia no empezaste el plan/)).toBeInTheDocument();
  });
});
