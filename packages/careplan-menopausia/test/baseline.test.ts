import { describe, expect, it } from 'vitest';
import type { QuestionnaireResponse } from '@medplum/fhirtypes';
import {
  BASELINE_PREGUNTAS,
  BASELINE_QUESTIONNAIRE_URL,
  SENALES,
  SENALES_CLINICAS,
  accionesDisponibles,
  baselineQuestionnaireItems,
  buildBaselineQuestionnaire,
  perfilDesdeRespuesta,
  senalesDelBaseline,
} from '../src/index.js';

function respuesta(items: { linkId: string; codes: string[] }[]): QuestionnaireResponse {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: BASELINE_QUESTIONNAIRE_URL,
    item: items.map(({ linkId, codes }) => ({
      linkId,
      answer: codes.map((code) => ({ valueCoding: { code } })),
    })),
  };
}

describe('cobertura: el cuestionario produce lo que la biblioteca filtra', () => {
  it('cubre todas las señales salvo las que derivan de datos clínicos', () => {
    // Este es el test que importa. Si alguien agrega una señal a la biblioteca y
    // no agrega la pregunta que la activa, la acción que depende de ella nunca
    // se le podría ofrecer a nadie — y nada más lo avisaría.
    const producidas = new Set(senalesDelBaseline());
    const faltantes = SENALES.filter((s) => !SENALES_CLINICAS.includes(s) && !producidas.has(s));
    expect(faltantes).toEqual([]);
  });

  it('no produce señales que la biblioteca no conozca', () => {
    for (const senal of senalesDelBaseline()) {
      expect(SENALES).toContain(senal);
    }
  });

  it('no pregunta por las señales clínicas: esas no se auto-reportan', () => {
    for (const clinica of SENALES_CLINICAS) {
      expect(senalesDelBaseline()).not.toContain(clinica);
    }
  });

  it('ninguna pregunta repite un código ni un linkId', () => {
    const linkIds = BASELINE_PREGUNTAS.map((p) => p.linkId);
    expect(new Set(linkIds).size).toBe(linkIds.length);
    for (const pregunta of BASELINE_PREGUNTAS) {
      const codes = pregunta.opciones.map((o) => o.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });
});

describe('Questionnaire FHIR', () => {
  it('agrupa las preguntas y marca repeats sólo en las de selección múltiple', () => {
    const q = buildBaselineQuestionnaire();
    expect(q.url).toBe(BASELINE_QUESTIONNAIRE_URL);
    expect(q.status).toBe('active');

    const preguntas = baselineQuestionnaireItems().flatMap((g) => g.item ?? []);
    expect(preguntas).toHaveLength(BASELINE_PREGUNTAS.length);
    for (const declarada of BASELINE_PREGUNTAS) {
      const item = preguntas.find((p) => p.linkId === declarada.linkId);
      expect(item?.repeats).toBe(declarada.multiple ?? false);
      expect(item?.answerOption).toHaveLength(declarada.opciones.length);
    }
  });

  it('todos los grupos tienen al menos una pregunta', () => {
    for (const grupo of baselineQuestionnaireItems()) {
      expect(grupo.item?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('perfilDesdeRespuesta', () => {
  it('traduce las respuestas a las señales de la biblioteca', () => {
    const perfil = perfilDesdeRespuesta(
      respuesta([
        { linkId: 'etapa-de-cambio', codes: ['preparacion'] },
        { linkId: 'nauseas', codes: ['marcadas'] },
        { linkId: 'descanso', codes: ['sofocos-nocturnos', 'pantallas'] },
      ])
    );
    expect(perfil.senales).toEqual(
      expect.arrayContaining([
        'etapa:preparacion',
        'barrera:nauseas',
        'barrera:sofocos-nocturnos',
        'barrera:pantallas-nocturnas',
      ])
    );
  });

  it('gradúa las náuseas en vez de tratarlas como un sí o no', () => {
    const leves = perfilDesdeRespuesta(respuesta([{ linkId: 'nauseas', codes: ['leves'] }]));
    expect(leves.senales).toEqual(['barrera:nauseas-leves']);

    const sin = perfilDesdeRespuesta(respuesta([{ linkId: 'nauseas', codes: ['no'] }]));
    expect(sin.senales).toEqual([]);
  });

  it('"ninguna de estas" no aporta señales', () => {
    const perfil = perfilDesdeRespuesta(respuesta([{ linkId: 'digestivo', codes: ['ninguna'] }]));
    expect(perfil.senales).toEqual([]);
  });

  it('detecta el tratamiento con GLP-1', () => {
    expect(perfilDesdeRespuesta(respuesta([{ linkId: 'glp1', codes: ['si'] }])).conGlp1).toBe(true);
    expect(perfilDesdeRespuesta(respuesta([{ linkId: 'glp1', codes: ['no'] }])).conGlp1).toBe(false);
  });

  it('la medicación registrada le gana a lo que respondió la paciente', () => {
    const perfil = perfilDesdeRespuesta(respuesta([{ linkId: 'glp1', codes: ['si'] }]), { conGlp1: false });
    expect(perfil.conGlp1).toBe(false);
  });

  it('los flags clínicos entran aparte, nunca desde el cuestionario', () => {
    const perfil = perfilDesdeRespuesta(respuesta([{ linkId: 'cuerpo', codes: ['temor-caidas'] }]), {
      flags: ['flag:caidas-recientes'],
    });
    expect(perfil.senales).toEqual(['barrera:temor-caidas']);
    expect(perfil.flags).toEqual(['flag:caidas-recientes']);
  });

  it('lee items anidados en grupos', () => {
    const anidada: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      item: [
        {
          linkId: 'momento',
          item: [{ linkId: 'etapa-de-cambio', answer: [{ valueCoding: { code: 'accion' } }] }],
        },
      ],
    };
    expect(perfilDesdeRespuesta(anidada).senales).toEqual(['etapa:accion']);
  });

  it('ignora códigos desconocidos en vez de romper', () => {
    // Una respuesta de una versión anterior del cuestionario aporta menos
    // señales, pero no impide generar el plan.
    const perfil = perfilDesdeRespuesta(
      respuesta([
        { linkId: 'etapa-de-cambio', codes: ['accion'] },
        { linkId: 'pregunta-que-ya-no-existe', codes: ['loquesea'] },
        { linkId: 'descanso', codes: ['codigo-viejo'] },
      ])
    );
    expect(perfil.senales).toEqual(['etapa:accion']);
  });

  it('sin respuesta devuelve un perfil vacío, no una excepción', () => {
    const perfil = perfilDesdeRespuesta(undefined);
    expect(perfil).toEqual({ senales: [], flags: [], conGlp1: false });
  });
});

describe('de punta a punta: respuesta → acciones ofrecibles', () => {
  it('una paciente con sofocos y náuseas bajo GLP-1 recibe acciones de los dos pilares', () => {
    const perfil = perfilDesdeRespuesta(
      respuesta([
        { linkId: 'glp1', codes: ['si'] },
        { linkId: 'etapa-de-cambio', codes: ['accion'] },
        { linkId: 'nauseas', codes: ['marcadas'] },
        { linkId: 'descanso', codes: ['sofocos-nocturnos'] },
      ])
    );
    const codigos = accionesDisponibles(perfil).map((a) => a.codigo);
    expect(codigos).toContain('N02'); // porciones mínimas, requiere GLP-1
    expect(codigos).toContain('S01'); // dormitorio fresco
    expect(codigos).toContain('S07'); // protocolo de sofoco
  });

  it('un flag clínico veta la acción aunque el cuestionario la habilite', () => {
    const conFlag = perfilDesdeRespuesta(respuesta([{ linkId: 'etapa-de-cambio', codes: ['accion'] }]), {
      flags: ['flag:densitometria-alterada'],
    });
    const codigos = accionesDisponibles(conFlag).map((a) => a.codigo);
    expect(codigos).not.toContain('A03');
    expect(codigos).toContain('A04');
  });

  it('un cuestionario en blanco no ofrece casi nada: hace falta responderlo', () => {
    expect(accionesDisponibles(perfilDesdeRespuesta(undefined))).toHaveLength(0);
  });
});
