import { describe, expect, it } from 'vitest';
import { buildMenopauseCarePlan } from '../src/index.js';

describe('existingQuestionnaire (politicas de acceso restrictivas)', () => {
  it('no crea Questionnaire en el bundle y apunta las Tasks al publicado', () => {
    const { bundle, tasks, questionnaire } = buildMenopauseCarePlan({
      patient: 'Patient/maria',
      existingQuestionnaire: { reference: 'Questionnaire/publicado-123' },
    });

    expect(questionnaire).toBeUndefined();
    const tipos = (bundle.entry ?? []).map((e) => e.resource?.resourceType);
    expect(tipos).not.toContain('Questionnaire');

    const conCuestionario = tasks.filter((t) => t.focus?.reference === 'Questionnaire/publicado-123');
    expect(conCuestionario.length).toBeGreaterThan(0);
  });

  it('sin referencia externa mantiene el comportamiento original (crea el Questionnaire)', () => {
    const { bundle, questionnaire } = buildMenopauseCarePlan({ patient: 'Patient/maria' });
    expect(questionnaire).toBeDefined();
    const tipos = (bundle.entry ?? []).map((e) => e.resource?.resourceType);
    expect(tipos).toContain('Questionnaire');
  });
});
