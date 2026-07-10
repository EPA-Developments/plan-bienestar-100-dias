import { buildMenopausePlanDefinition } from '@epa/careplan-menopausia';
import type { Patient, PlanDefinition } from '@medplum/fhirtypes';
import { MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/react';
import { MantineProvider } from '@mantine/core';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

export const HOY = new Date().toISOString().slice(0, 10);

export async function crearEscenario(opciones?: {
  planDefinitionStatus?: 'active' | 'retired';
}): Promise<{ medplum: MockClient; maria: Patient; carlos: Patient; planDefinition: PlanDefinition }> {
  const medplum = new MockClient();

  const maria = await medplum.createResource<Patient>({
    resourceType: 'Patient',
    name: [{ given: ['Maria Adela'], family: 'Demo' }],
    gender: 'female',
    birthDate: '1974-03-15',
  });

  const carlos = await medplum.createResource<Patient>({
    resourceType: 'Patient',
    name: [{ given: ['Carlos'], family: 'Demo' }],
    gender: 'male',
    birthDate: '1988-06-01',
  });

  const planDefinition = await medplum.createResource<PlanDefinition>(
    buildMenopausePlanDefinition({ status: opciones?.planDefinitionStatus ?? 'active', now: HOY }),
  );

  return { medplum, maria, carlos, planDefinition };
}

export function renderConProveedores(medplum: MockClient, ui: ReactNode): RenderResult {
  return render(
    <MedplumProvider medplum={medplum}>
      <MantineProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </MantineProvider>
    </MedplumProvider>,
  );
}
