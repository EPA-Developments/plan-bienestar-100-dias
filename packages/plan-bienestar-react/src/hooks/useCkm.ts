import {
  buildCkmStageObservation,
  evaluateCkmStage,
  extractCkmInput,
  type CkmResult,
} from '@epa/careplan-menopausia';
import { createReference, getReferenceString } from '@medplum/core';
import type { Condition, Observation, Patient } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { useCallback, useEffect, useState } from 'react';
import { usePaciente } from '../PlanBienestarContext';

export interface UseCkmOptions {
  /** Patient override; defaults to provider config or the logged-in profile. */
  patient?: Patient;
}

export interface Ckm {
  cargando: boolean;
  /** Staging computed from the patient's latest Observations + Conditions. */
  resultado?: CkmResult;
  /** Persists the computed stage as a FHIR Observation (for the team/history). */
  registrarEstadio: () => Promise<Observation | undefined>;
  refrescar: () => void;
}

/**
 * Computes the CKM stage (AHA/Ndumele 0-4) client-side from the patient's
 * FHIR record: latest observations (anthropometry, BP, labs) and active
 * conditions. Never asserts stage 0 without sufficient data.
 */
export function useCkm(options: UseCkmOptions = {}): Ckm {
  const medplum = useMedplum();
  const paciente = usePaciente(options.patient);
  const [version, setVersion] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [resultado, setResultado] = useState<CkmResult | undefined>(undefined);

  const refrescar = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    let cancelado = false;

    if (!paciente?.id) {
      setCargando(false);
      setResultado(undefined);
      return undefined;
    }

    setCargando(true);
    (async () => {
      const referencia = getReferenceString(paciente);
      const [observations, conditions] = await Promise.all([
        medplum.searchResources('Observation', { subject: referencia, _count: '200' }) as Promise<Observation[]>,
        medplum.searchResources('Condition', { subject: referencia, _count: '100' }) as Promise<Condition[]>,
      ]);
      if (cancelado) return;
      const input = extractCkmInput({ patient: paciente, observations, conditions });
      setResultado(evaluateCkmStage(input));
      setCargando(false);
    })().catch(() => {
      if (!cancelado) {
        setResultado(undefined);
        setCargando(false);
      }
    });

    return () => {
      cancelado = true;
    };
  }, [medplum, paciente, version]);

  const registrarEstadio = useCallback(async (): Promise<Observation | undefined> => {
    if (!paciente?.id || resultado?.stage === undefined) return undefined;
    const observation = await medplum.createResource<Observation>(
      buildCkmStageObservation(resultado, {
        patient: createReference(paciente),
        now: new Date().toISOString(),
      }),
    );
    medplum.invalidateSearches('Observation');
    return observation;
  }, [medplum, paciente, resultado]);

  return { cargando, resultado, registrarEstadio, refrescar };
}
