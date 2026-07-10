import { MENOPAUSE_QUESTIONNAIRE_URL } from '@epa/careplan-menopausia';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { asegurarRecursosDelPlan, PlanBienestarCard } from '../src/index';
import { crearEscenario, renderConProveedores } from './renderConPlan';

describe('Questionnaire compartido (politicas restrictivas)', () => {
  it('empezarPlan reutiliza el Questionnaire publicado en vez de crear uno nuevo', async () => {
    const { medplum, maria } = await crearEscenario();
    const { questionnaire } = await asegurarRecursosDelPlan(medplum);
    medplum.invalidateSearches('Questionnaire');

    renderConProveedores(medplum, <PlanBienestarCard patient={maria} />);
    const boton = await screen.findByRole('button', { name: 'Empezar mi plan' });
    await userEvent.click(boton);

    await waitFor(
      async () => {
        const planes = await medplum.searchResources('CarePlan', {
          subject: `Patient/${maria.id}`,
          status: 'active',
        });
        expect(planes.length).toBe(1);
      },
      { timeout: 5000 },
    );

    // No se creo un segundo Questionnaire del plan.
    const cuestionarios = await medplum.searchResources('Questionnaire', {
      url: MENOPAUSE_QUESTIONNAIRE_URL,
    });
    expect(cuestionarios.length).toBe(1);

    // Y la Task del cuestionario apunta al publicado.
    const tareas = await medplum.searchResources('Task', { patient: `Patient/${maria.id}` });
    const conFoco = tareas.filter(
      (t) => t.focus?.reference === `Questionnaire/${questionnaire.id}`,
    );
    expect(conFoco.length).toBeGreaterThan(0);
  });
});
