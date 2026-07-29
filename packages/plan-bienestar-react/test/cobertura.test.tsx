import { createReference } from '@medplum/core';
import { buildMenopauseCarePlanBundle } from '@epa/careplan-menopausia';
import { MantineProvider } from '@mantine/core';
import type { Coverage, Patient, Task } from '@medplum/fhirtypes';
import type { MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import {
  PB100D_CODIGO,
  PLAN_CODIGO_EXT_DEFAULT,
  SOLICITUD_PLAN_CODIGO,
  TASK_TIPO_SYSTEM_DEFAULT,
  PlanBienestarCard,
  PlanBienestarProvider,
} from '../src/index';
import { HOY, crearEscenario } from './renderConPlan';

/** Renderiza la tarjeta con el gate comercial encendido. */
function renderConGate(medplum: MockClient, ui: ReactNode) {
  return render(
    <MedplumProvider medplum={medplum}>
      <MantineProvider>
        <MemoryRouter>
          <PlanBienestarProvider requiereCobertura>{ui}</PlanBienestarProvider>
        </MemoryRouter>
      </MantineProvider>
    </MedplumProvider>,
  );
}

/** Coverage del plan con vigencia controlada. */
async function darCobertura(
  medplum: MockClient,
  paciente: Patient,
  period?: { start?: string; end?: string },
): Promise<Coverage> {
  return medplum.createResource<Coverage>({
    resourceType: 'Coverage',
    status: 'active',
    beneficiary: createReference(paciente),
    payor: [createReference(paciente)],
    period,
    extension: [{ url: PLAN_CODIGO_EXT_DEFAULT, valueString: PB100D_CODIGO }],
  });
}

describe('gate comercial del Plan Bienestar', () => {
  it('elegible sin cobertura: ofrece sumarse y registra el Task para Recepcion', async () => {
    const { medplum, maria } = await crearEscenario();

    renderConGate(medplum, <PlanBienestarCard patient={maria} />);

    const boton = await screen.findByRole('button', { name: /Quiero sumarme/ });
    await userEvent.click(boton);

    // Queda una solicitud abierta en la bandeja que Recepcion cobra y activa.
    await waitFor(async () => {
      medplum.invalidateSearches('Task');
      const tareas = await medplum.searchResources('Task', { patient: `Patient/${maria.id}` });
      const delPlan = (tareas as Task[]).filter((t) =>
        t.code?.coding?.some(
          (k) => k.system === TASK_TIPO_SYSTEM_DEFAULT && k.code === SOLICITUD_PLAN_CODIGO,
        ),
      );
      expect(delPlan).toHaveLength(1);
      expect(delPlan[0]?.status).toBe('requested');
      expect(delPlan[0]?.input?.[0]?.valueString).toBe(PB100D_CODIGO);
    });

    expect(await screen.findByText(/Solicitud enviada/)).toBeInTheDocument();
  });

  it('sin cobertura no se puede empezar el plan (no hay CTA de alta directa)', async () => {
    const { medplum, maria } = await crearEscenario();
    renderConGate(medplum, <PlanBienestarCard patient={maria} />);

    await screen.findByRole('button', { name: /Quiero sumarme/ });
    expect(screen.queryByRole('button', { name: /Empezar mi plan/ })).not.toBeInTheDocument();
  });

  it('con cobertura vigente habilita el alta del plan', async () => {
    const { medplum, maria } = await crearEscenario();
    await darCobertura(medplum, maria);

    renderConGate(medplum, <PlanBienestarCard patient={maria} />);

    expect(await screen.findByRole('button', { name: /Empezar mi plan/ })).toBeInTheDocument();
  });

  it('cobertura vencida: el plan sigue visible y ofrece retomarlo (datos intactos)', async () => {
    const { medplum, maria } = await crearEscenario();
    await darCobertura(medplum, maria, { start: '2020-01-01', end: '2020-04-10' });

    renderConGate(medplum, <PlanBienestarCard patient={maria} />);

    expect(await screen.findByText(/Programa pausado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Quiero retomarlo/ })).toBeInTheDocument();
  });

  it('sin gate (cohorte de investigacion) la tarjeta funciona como siempre', async () => {
    const { medplum, maria } = await crearEscenario();

    // Sin PlanBienestarProvider requiereCobertura: comportamiento historico.
    render(
      <MedplumProvider medplum={medplum}>
        <MantineProvider>
          <MemoryRouter>
            <PlanBienestarCard patient={maria} />
          </MemoryRouter>
        </MantineProvider>
      </MedplumProvider>,
    );

    expect(await screen.findByRole('button', { name: /Empezar mi plan/ })).toBeInTheDocument();
  });

  it('con plan ya creado la cobertura vigente muestra el progreso', async () => {
    const { medplum, maria } = await crearEscenario();
    await darCobertura(medplum, maria);
    await medplum.executeBatch(buildMenopauseCarePlanBundle({ patient: createReference(maria), now: HOY }));
    medplum.invalidateSearches('CarePlan');

    renderConGate(medplum, <PlanBienestarCard patient={maria} />);

    expect(await screen.findByText(/Plan en curso/)).toBeInTheDocument();
  });
});
