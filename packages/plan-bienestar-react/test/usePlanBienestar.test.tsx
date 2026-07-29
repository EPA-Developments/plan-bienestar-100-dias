import { createReference } from '@medplum/core';
import { buildMenopauseCarePlanBundle } from '@epa/careplan-menopausia';
import { MantineProvider } from '@mantine/core';
import type { CarePlan } from '@medplum/fhirtypes';
import type { MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/react';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PasosDelPlan, esCarePlanDelPlan, usePlanBienestar } from '../src/index';
import { HOY, crearEscenario, renderConProveedores } from './renderConPlan';

function proveedores(medplum: MockClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MedplumProvider medplum={medplum}>
        <MantineProvider>
          <MemoryRouter>{children}</MemoryRouter>
        </MantineProvider>
      </MedplumProvider>
    );
  };
}

async function planesActivos(medplum: MockClient, patientId: string): Promise<CarePlan[]> {
  medplum.invalidateSearches('CarePlan');
  const planes = await medplum.searchResources('CarePlan', {
    subject: `Patient/${patientId}`,
    status: 'active',
  });
  return planes.filter((plan) => esCarePlanDelPlan(plan));
}

describe('usePlanBienestar', () => {
  it('empezarPlan es idempotente: no crea un duplicado si ya hay un plan activo', async () => {
    const { medplum, maria } = await crearEscenario();
    await medplum.executeBatch(buildMenopauseCarePlanBundle({ patient: createReference(maria), now: HOY }));

    const { result } = renderHook(() => usePlanBienestar({ patient: maria }), {
      wrapper: proveedores(medplum),
    });
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.carePlan).toBeDefined();

    // Segundo "Empezar mi plan" (p. ej. desde otra pestaña o estado desactualizado).
    let devuelto: CarePlan | undefined;
    await act(async () => {
      devuelto = await result.current.empezarPlan();
    });

    expect(devuelto?.id).toBe(result.current.carePlan?.id);
    expect(await planesActivos(medplum, maria.id as string)).toHaveLength(1);
  });

  it('con duplicados existentes muestra el plan (no "Todavia no empezaste") y no crea otro', async () => {
    const { medplum, maria } = await crearEscenario();
    // Estado real reportado en produccion: varios CarePlans activos del plan.
    await medplum.executeBatch(buildMenopauseCarePlanBundle({ patient: createReference(maria), now: HOY }));
    await medplum.executeBatch(buildMenopauseCarePlanBundle({ patient: createReference(maria), now: HOY }));
    medplum.invalidateSearches('CarePlan');

    renderConProveedores(medplum, <PasosDelPlan patient={maria} />);

    expect(await screen.findByText('Tu plan de 100 días')).toBeInTheDocument();
    expect(screen.queryByText(/Todavia no empezaste el plan/)).not.toBeInTheDocument();

    // Y "Empezar" con duplicados tampoco crea un tercero.
    const { result } = renderHook(() => usePlanBienestar({ patient: maria }), {
      wrapper: proveedores(medplum),
    });
    await waitFor(() => expect(result.current.cargando).toBe(false));
    await act(async () => {
      await result.current.empezarPlan();
    });
    expect(await planesActivos(medplum, maria.id as string)).toHaveLength(2);
  });
});
