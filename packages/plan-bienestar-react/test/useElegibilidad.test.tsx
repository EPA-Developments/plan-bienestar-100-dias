import { renderHook, waitFor } from '@testing-library/react';
import { MedplumProvider } from '@medplum/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useElegibilidad } from '../src/index';
import { crearEscenario } from './renderConPlan';
import type { MockClient } from '@medplum/mock';

function envoltorio(medplum: MockClient) {
  return ({ children }: { children: ReactNode }) => (
    <MedplumProvider medplum={medplum}>
      <MantineProvider>{children}</MantineProvider>
    </MedplumProvider>
  );
}

describe('useElegibilidad', () => {
  it('marca elegible a una mujer de 52 con la PlanDefinition activa', async () => {
    const { medplum, maria } = await crearEscenario();
    const { result } = renderHook(() => useElegibilidad({ patient: maria }), {
      wrapper: envoltorio(medplum),
    });

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.elegible).toBe(true);
    expect(result.current.edad).toBeGreaterThanOrEqual(45);
    expect(result.current.planDefinition?.url).toBeDefined();
  });

  it('rechaza a un varon fuera del useContext', async () => {
    const { medplum, carlos } = await crearEscenario();
    const { result } = renderHook(() => useElegibilidad({ patient: carlos }), {
      wrapper: envoltorio(medplum),
    });

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.elegible).toBe(false);
    expect(result.current.motivos.length).toBeGreaterThan(0);
  });

  it('se apaga cuando la PlanDefinition esta retirada (2 clicks server-side)', async () => {
    const { medplum, maria } = await crearEscenario({ planDefinitionStatus: 'retired' });
    const { result } = renderHook(() => useElegibilidad({ patient: maria }), {
      wrapper: envoltorio(medplum),
    });

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.elegible).toBe(false);
  });
});
