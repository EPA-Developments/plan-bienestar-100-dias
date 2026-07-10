import { LOINC } from '@epa/careplan-menopausia';
import type { Observation } from '@medplum/fhirtypes';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CargarDatosCkm, RiesgoPreventCard } from '../src/index';
import { crearEscenario, renderConProveedores } from './renderConPlan';

async function obs(
  medplum: Awaited<ReturnType<typeof crearEscenario>>['medplum'],
  patientId: string,
  code: string,
  value: number,
): Promise<Observation> {
  return medplum.createResource<Observation>({
    resourceType: 'Observation',
    status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code }] },
    subject: { reference: `Patient/${patientId}` },
    valueQuantity: { value },
    effectiveDateTime: '2026-07-01',
  });
}

describe('RiesgoPreventCard', () => {
  it('sin colesterol invita a cargar los datos (no calcula)', async () => {
    const { medplum, maria } = await crearEscenario();
    await obs(medplum, maria.id as string, LOINC.systolicBloodPressure.code as string, 132);
    await obs(medplum, maria.id as string, LOINC.egfr.code as string, 88);
    medplum.invalidateSearches('Observation');

    renderConProveedores(medplum, <RiesgoPreventCard patient={maria} />);

    expect(await screen.findByTestId('riesgo-prevent-card')).toBeInTheDocument();
    expect(await screen.findByText(/necesitamos tu/)).toBeInTheDocument();
    expect(screen.getByText('Cargar mis datos →')).toBeInTheDocument();
  });

  it('con colesterol + datos calcula y muestra el riesgo a 10 años', async () => {
    const { medplum, maria } = await crearEscenario();
    await obs(medplum, maria.id as string, LOINC.totalCholesterol.code as string, 210);
    await obs(medplum, maria.id as string, LOINC.hdlCholesterol.code as string, 48);
    await obs(medplum, maria.id as string, LOINC.systolicBloodPressure.code as string, 135);
    await obs(medplum, maria.id as string, LOINC.egfr.code as string, 88);
    medplum.invalidateSearches('Observation');

    renderConProveedores(medplum, <RiesgoPreventCard patient={maria} />);

    expect(await screen.findByTestId('riesgo-prevent-card')).toBeInTheDocument();
    expect(await screen.findByText(/Tu riesgo cardiovascular \(PREVENT\)/)).toBeInTheDocument();
    // Muestra los otros dos desenlaces del modelo.
    expect(await screen.findByText('Enfermedad cardiovascular total')).toBeInTheDocument();
    expect(screen.getByText('Insuficiencia cardíaca')).toBeInTheDocument();
  });
});

describe('CargarDatosCkm', () => {
  it('lista parámetros con su referencia y guarda un valor como Observation', async () => {
    const { medplum, maria } = await crearEscenario();
    renderConProveedores(medplum, <CargarDatosCkm patient={maria} />);

    expect(await screen.findByText('Mis datos de salud')).toBeInTheDocument();
    expect(screen.getByText('Colesterol total')).toBeInTheDocument();
    // Muestra referencia AHA.
    expect(screen.getAllByText(/Referencia \(AHA\/Ndumele\)/).length).toBeGreaterThan(0);

    const inputColesterol = screen.getByLabelText('Colesterol total');
    await userEvent.type(inputColesterol, '190');
    // El boton Guardar de la MISMA tarjeta que el colesterol.
    const tarjeta = inputColesterol.closest('.mantine-Card-root') as HTMLElement;
    await userEvent.click(within(tarjeta).getByRole('button', { name: 'Guardar' }));

    await waitFor(async () => {
      const obsGuardadas = await medplum.searchResources('Observation', {
        subject: `Patient/${maria.id}`,
      });
      const colesterol = obsGuardadas.filter((o) =>
        (o.code?.coding ?? []).some((c) => c.code === (LOINC.totalCholesterol.code as string)),
      );
      expect(colesterol.length).toBeGreaterThan(0);
      expect(colesterol[0]?.valueQuantity?.value).toBe(190);
    });
  });
});
