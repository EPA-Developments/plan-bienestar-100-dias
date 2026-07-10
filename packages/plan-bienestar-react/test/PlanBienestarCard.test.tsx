import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MENOPAUSE_PLAN } from '@epa/careplan-menopausia';
import { PlanBienestarCard } from '../src/index';
import { crearEscenario, renderConProveedores } from './renderConPlan';

describe('PlanBienestarCard', () => {
  it('se muestra con CTA para una paciente elegible sin plan', async () => {
    const { medplum, maria } = await crearEscenario();
    renderConProveedores(medplum, <PlanBienestarCard patient={maria} />);

    expect(await screen.findByTestId('plan-bienestar-card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Empezar mi plan' })).toBeInTheDocument();
    expect(screen.getByText(MENOPAUSE_PLAN.title)).toBeInTheDocument();
  });

  it('no se muestra para un paciente no elegible', async () => {
    const { medplum, carlos } = await crearEscenario();
    const { container } = renderConProveedores(medplum, <PlanBienestarCard patient={carlos} />);

    // Esperar a que termine la carga y verificar que no rinde nada.
    await waitFor(() => expect(container.querySelector('[data-testid="plan-bienestar-card"]')).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container.querySelector('[data-testid="plan-bienestar-card"]')).toBeNull();
  });

  it('crea el CarePlan al hacer click en Empezar y pasa a modo progreso', async () => {
    const { medplum, maria } = await crearEscenario();
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

    expect(await screen.findByRole('button', { name: 'Continuar mi plan' })).toBeInTheDocument();
    expect(
      await screen.findByText(`0 de ${MENOPAUSE_PLAN.activities.length} pasos completados`, {
        exact: false,
      }),
    ).toBeInTheDocument();
  });
});
