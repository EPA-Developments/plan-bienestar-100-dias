import { describe, expect, it } from 'vitest';
import {
  BASES_ACEPTADAS,
  BASE_CANONICA,
  COD,
  EXT,
  EXT_SUFIJO,
  MENOPAUSE_PLAN_DEFINITION_URL,
  PB100D_CODIGO,
  PB100D_DURACION_DIAS,
  PB100D_EVALUACION_DIAS,
  PLAN_DEFINITION_URL,
  SYS,
  buscarExtension,
  coincide,
  esCarePlanDelPrograma,
  urlsDe,
} from '../src/index.js';

describe('contrato PB100D', () => {
  it('la URL canónica del contrato es la misma que publica el contenido clínico', () => {
    // Si estas dos se separan, el dashboard escribe una y el portal busca otra:
    // el plan queda activo y la paciente ve "todavía no empezaste".
    expect(PLAN_DEFINITION_URL).toBe(MENOPAUSE_PLAN_DEFINITION_URL);
  });

  it('todo lo que se escribe sale del namespace canónico', () => {
    for (const url of [...Object.values(EXT), ...Object.values(SYS), PLAN_DEFINITION_URL]) {
      expect(url.startsWith(`${BASE_CANONICA}/`)).toBe(true);
    }
  });

  it('la canónica es la primera de las aceptadas', () => {
    expect(BASES_ACEPTADAS[0]).toBe(BASE_CANONICA);
    expect(new Set(BASES_ACEPTADAS).size).toBe(BASES_ACEPTADAS.length);
  });

  it('fija los valores del programa', () => {
    expect(PB100D_CODIGO).toBe('PB100D');
    expect(PB100D_DURACION_DIAS).toBe(100);
    expect(PB100D_EVALUACION_DIAS).toEqual([0, 30, 60, 100]);
    expect(PB100D_EVALUACION_DIAS.at(-1)).toBe(PB100D_DURACION_DIAS);
    expect(COD.solicitudPlan).toBe('solicitud-plan');
    expect(COD.coberturaPrograma).toBe('programa');
  });
});

describe('lectura tolerante de namespaces', () => {
  it('reconoce el concepto en cualquiera de los namespaces heredados', () => {
    for (const base of BASES_ACEPTADAS) {
      expect(coincide(`${base}/${EXT_SUFIJO.planCodigo}`, EXT_SUFIJO.planCodigo)).toBe(true);
    }
  });

  it('no reconoce un namespace ajeno ni un sufijo parecido', () => {
    expect(coincide('https://otro.example/fhir/StructureDefinition/plan-codigo', EXT_SUFIJO.planCodigo)).toBe(false);
    expect(coincide(`${BASE_CANONICA}/StructureDefinition/plan-codigo-viejo`, EXT_SUFIJO.planCodigo)).toBe(false);
    expect(coincide(undefined, EXT_SUFIJO.planCodigo)).toBe(false);
  });

  it('urlsDe devuelve una por namespace, con la canónica primero', () => {
    const urls = urlsDe(EXT_SUFIJO.planCodigo);
    expect(urls).toHaveLength(BASES_ACEPTADAS.length);
    expect(urls[0]).toBe(EXT.planCodigo);
  });

  it('buscarExtension encuentra una extensión escrita con el namespace viejo', () => {
    const extensiones = [
      { url: 'https://otra.cosa/fhir/StructureDefinition/algo', valueString: 'no' },
      { url: 'https://biowellness.ar/fhir/StructureDefinition/plan-codigo', valueString: 'PB100D' },
    ];
    expect(buscarExtension(extensiones, EXT_SUFIJO.planCodigo)?.valueString).toBe('PB100D');
    expect(buscarExtension(undefined, EXT_SUFIJO.planCodigo)).toBeUndefined();
    expect(buscarExtension([], EXT_SUFIJO.planCodigo)).toBeUndefined();
  });
});

describe('esCarePlanDelPrograma', () => {
  it('reconoce el plan escrito con la URL canónica', () => {
    expect(esCarePlanDelPrograma([PLAN_DEFINITION_URL])).toBe(true);
  });

  it('reconoce el plan escrito con un namespace heredado', () => {
    expect(
      esCarePlanDelPrograma(['https://segundaopinionmedica.org/fhir/PlanDefinition/menopausia-cardiovascular'])
    ).toBe(true);
  });

  it('tolera la versión en la referencia canónica (url|version)', () => {
    expect(esCarePlanDelPrograma([`${PLAN_DEFINITION_URL}|2.1.0`])).toBe(true);
  });

  it('no confunde otro plan del mismo servidor', () => {
    expect(esCarePlanDelPrograma([`${BASE_CANONICA}/PlanDefinition/otro-programa`])).toBe(false);
    expect(esCarePlanDelPrograma([])).toBe(false);
    expect(esCarePlanDelPrograma(undefined)).toBe(false);
  });
});
