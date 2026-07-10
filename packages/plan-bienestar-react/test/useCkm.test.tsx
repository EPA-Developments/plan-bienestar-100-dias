import { LOINC, SYSTEM } from '@epa/careplan-menopausia';
import type { Observation } from '@medplum/fhirtypes';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EstadioCkmCard } from '../src/index';
import { crearEscenario, renderConProveedores } from './renderConPlan';

async function sembrarObservacion(
  medplum: Awaited<ReturnType<typeof crearEscenario>>['medplum'],
  patientId: string,
  code: { system?: string; code?: string },
  value: number,
): Promise<Observation> {
  return medplum.createResource<Observation>({
    resourceType: 'Observation',
    status: 'final',
    code: { coding: [code] },
    subject: { reference: `Patient/${patientId}` },
    valueQuantity: { value },
    effectiveDateTime: '2026-07-01',
  });
}

describe('EstadioCkmCard', () => {
  it('calcula estadio 2 desde las observaciones y lo muestra en lenguaje llano', async () => {
    const { medplum, maria } = await crearEscenario();
    await sembrarObservacion(medplum, maria.id as string, LOINC.waistCircumference, 95);
    await sembrarObservacion(medplum, maria.id as string, LOINC.systolicBloodPressure, 138);
    await sembrarObservacion(medplum, maria.id as string, LOINC.triglycerides, 165);
    await sembrarObservacion(medplum, maria.id as string, LOINC.fastingGlucose, 92);
    await sembrarObservacion(medplum, maria.id as string, LOINC.bmi, 27.5);
    medplum.invalidateSearches('Observation');

    renderConProveedores(medplum, <EstadioCkmCard patient={maria} />);

    expect(await screen.findByTestId('estadio-ckm-card')).toBeInTheDocument();
    expect(await screen.findByText('Factores de riesgo activos')).toBeInTheDocument();
    expect(screen.getByText('Presion arterial elevada o hipertension')).toBeInTheDocument();
    expect(screen.getByText('Trigliceridos elevados')).toBeInTheDocument();
  });

  it('sin datos, invita a completar el mapa en vez de afirmar salud ideal', async () => {
    const { medplum, maria } = await crearEscenario();
    renderConProveedores(medplum, <EstadioCkmCard patient={maria} />);

    expect(await screen.findByTestId('estadio-ckm-card')).toBeInTheDocument();
    expect(await screen.findByText('Faltan datos para armar tu mapa')).toBeInTheDocument();
    expect(screen.getByText(/Para afinar tu mapa/)).toBeInTheDocument();
  });
});

// El sistema EPA se usa implicitamente en los criterios; referenciado aca para
// dejar explicito que el card no depende de codigos LOINC en la UI.
void SYSTEM;
