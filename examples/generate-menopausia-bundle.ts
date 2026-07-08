/**
 * Generates a menopause cardiovascular CarePlan transaction Bundle for an
 * Alice-style patient and prints it as JSON.
 *
 *   npm run example
 *
 * Submit the output to a Medplum/FHIR server, e.g.:
 *   await medplum.executeBatch(bundle);
 */
import { buildMenopauseCarePlanBundle, sequentialIdGenerator } from '../src/index.js';

const bundle = buildMenopauseCarePlanBundle({
  patient: { reference: 'Patient/alice', display: 'Alice Young' },
  lifeStage: 'perimenopausia',
  now: '2026-07-08',
  careTeam: {
    name: 'Equipo Salud de la Mujer - Menopausia',
    members: [{ reference: 'Practitioner/dalessandro', display: "Dr. Alejandro D'Alessandro" }],
    managingOrganization: { reference: 'Organization/epa-bienestar', display: 'EPA Bienestar IA' },
  },
  // Deterministic ids so the example output is stable; omit in production.
  idGenerator: sequentialIdGenerator(),
});

console.log(JSON.stringify(bundle, null, 2));
