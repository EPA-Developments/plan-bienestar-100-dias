/**
 * MDPA — Monitoreo Domiciliario de Presión Arterial.
 *
 * Una semana de MDPA antes de cada control cardiológico: la paciente mide en su
 * casa, el equipo lee el promedio. Sustituye la foto única de consultorio (sujeta
 * a efecto guardapolvo blanco) por una serie.
 *
 * OBJETIVOS (AHA)
 *   < 130/80  objetivo clínico
 *   < 120/80  ideal
 *
 * UMBRALES DE AVISO — PROPUESTA A VALIDAR
 *   promedio ≥ 135/85            -> revisión
 *   dos o más tomas ≥ 140/90     -> revisión
 *   cualquier toma ≥ 180/110     -> contacto urgente
 *
 * En todos los umbrales alcanza con que **uno** de los dos componentes
 * (sistólica o diastólica) esté por encima; es la convención de las guías de
 * hipertensión, no un promedio de ambos.
 *
 * QUIÉN VE QUÉ
 * ------------
 * El aviso es para el equipo tratante. A la paciente se le muestra su número
 * contra su meta, en positivo (`mensajeParaPaciente`): nunca el escalón de
 * alarma, que no puede interpretar sola y sólo genera ansiedad entre controles.
 */

export interface PresionObjetivo {
  sistolica: number;
  diastolica: number;
}

/** Objetivo clínico del programa (AHA). */
export const MDPA_OBJETIVO_CLINICO: PresionObjetivo = Object.freeze({ sistolica: 130, diastolica: 80 });

/** Objetivo ideal (AHA). */
export const MDPA_OBJETIVO_IDEAL: PresionObjetivo = Object.freeze({ sistolica: 120, diastolica: 80 });

/** Promedio de la serie a partir del cual se pide revisión. */
export const MDPA_UMBRAL_PROMEDIO: PresionObjetivo = Object.freeze({ sistolica: 135, diastolica: 85 });

/** Valor de una toma individual que, repetido, pide revisión. */
export const MDPA_UMBRAL_TOMA: PresionObjetivo = Object.freeze({ sistolica: 140, diastolica: 90 });

/** Cuántas tomas por encima de `MDPA_UMBRAL_TOMA` disparan la revisión. */
export const MDPA_TOMAS_ALTAS_PARA_REVISION = 2;

/** Una sola toma en este rango justifica contacto urgente. */
export const MDPA_UMBRAL_URGENTE: PresionObjetivo = Object.freeze({ sistolica: 180, diastolica: 110 });

/** Días de registro que componen una serie completa. */
export const MDPA_DIAS_DE_SERIE = 7;

export type MomentoDelDia = 'manana' | 'noche';

export interface TomaPresion {
  /** Fecha de la toma, `YYYY-MM-DD`. */
  fecha: string;
  momento: MomentoDelDia;
  sistolica: number;
  diastolica: number;
}

export type NivelAviso = 'ok' | 'revision' | 'urgente';

export interface ResultadoMdpa {
  /** Promedio de la serie, redondeado. `undefined` si no hay tomas. */
  promedio?: PresionObjetivo;
  /** Días con toma de mañana **y** de noche. */
  diasCompletos: number;
  /** La serie llegó a `MDPA_DIAS_DE_SERIE` días completos. */
  serieCompleta: boolean;
  totalTomas: number;
  aviso: NivelAviso;
  /** Por qué se llegó a ese aviso. Vacío cuando es `ok`. */
  motivos: string[];
  /** El promedio cumple el objetivo clínico (< 130/80). */
  enObjetivoClinico: boolean;
  /** El promedio cumple el ideal (< 120/80). */
  enObjetivoIdeal: boolean;
}

/** Una toma alcanza o supera el umbral si **cualquiera** de sus componentes lo hace. */
function alcanza(toma: { sistolica: number; diastolica: number }, umbral: PresionObjetivo): boolean {
  return toma.sistolica >= umbral.sistolica || toma.diastolica >= umbral.diastolica;
}

/** Está por debajo del objetivo sólo si **ambos** componentes lo están. */
function porDebajo(valor: PresionObjetivo, objetivo: PresionObjetivo): boolean {
  return valor.sistolica < objetivo.sistolica && valor.diastolica < objetivo.diastolica;
}

/**
 * Evalúa una serie de MDPA.
 *
 * Función pura: no lee ni escribe FHIR. El bot decide qué hacer con el aviso
 * (Communication al equipo, Task de revisión); acá sólo se calcula.
 */
export function evaluarMdpa(tomas: readonly TomaPresion[]): ResultadoMdpa {
  const porDia = new Map<string, Set<MomentoDelDia>>();
  for (const t of tomas) {
    const momentos = porDia.get(t.fecha) ?? new Set<MomentoDelDia>();
    momentos.add(t.momento);
    porDia.set(t.fecha, momentos);
  }
  const diasCompletos = [...porDia.values()].filter((m) => m.has('manana') && m.has('noche')).length;

  const base = {
    diasCompletos,
    serieCompleta: diasCompletos >= MDPA_DIAS_DE_SERIE,
    totalTomas: tomas.length,
  };

  if (tomas.length === 0) {
    return { ...base, aviso: 'ok', motivos: [], enObjetivoClinico: false, enObjetivoIdeal: false };
  }

  const promedio: PresionObjetivo = {
    sistolica: Math.round(tomas.reduce((s, t) => s + t.sistolica, 0) / tomas.length),
    diastolica: Math.round(tomas.reduce((s, t) => s + t.diastolica, 0) / tomas.length),
  };

  const motivos: string[] = [];
  const urgentes = tomas.filter((t) => alcanza(t, MDPA_UMBRAL_URGENTE));
  if (urgentes.length > 0) {
    const peor = urgentes[0];
    motivos.push(
      `Toma en rango de urgencia (${peor.sistolica}/${peor.diastolica}, umbral ` +
        `${MDPA_UMBRAL_URGENTE.sistolica}/${MDPA_UMBRAL_URGENTE.diastolica}).`
    );
    return {
      ...base,
      promedio,
      aviso: 'urgente',
      motivos,
      enObjetivoClinico: false,
      enObjetivoIdeal: false,
    };
  }

  if (alcanza(promedio, MDPA_UMBRAL_PROMEDIO)) {
    motivos.push(
      `Promedio ${promedio.sistolica}/${promedio.diastolica} ≥ ` +
        `${MDPA_UMBRAL_PROMEDIO.sistolica}/${MDPA_UMBRAL_PROMEDIO.diastolica}.`
    );
  }
  const altas = tomas.filter((t) => alcanza(t, MDPA_UMBRAL_TOMA)).length;
  if (altas >= MDPA_TOMAS_ALTAS_PARA_REVISION) {
    motivos.push(
      `${altas} tomas ≥ ${MDPA_UMBRAL_TOMA.sistolica}/${MDPA_UMBRAL_TOMA.diastolica} ` +
        `(umbral: ${MDPA_TOMAS_ALTAS_PARA_REVISION}).`
    );
  }

  return {
    ...base,
    promedio,
    aviso: motivos.length > 0 ? 'revision' : 'ok',
    motivos,
    enObjetivoClinico: porDebajo(promedio, MDPA_OBJETIVO_CLINICO),
    enObjetivoIdeal: porDebajo(promedio, MDPA_OBJETIVO_IDEAL),
  };
}

/**
 * Texto para la paciente: su número contra su meta, en positivo.
 *
 * Deliberadamente no menciona el nivel de aviso ni la palabra "hipertensión".
 * Si hay algo que revisar, lo conversa con su equipo en el control; el portal
 * no da esa noticia sin un profesional al lado.
 */
export function mensajeParaPaciente(resultado: ResultadoMdpa): string {
  if (!resultado.promedio) {
    return `Todavía no cargaste tomas. Son ${MDPA_DIAS_DE_SERIE} días, mañana y noche, antes de tu control.`;
  }
  const { sistolica, diastolica } = resultado.promedio;
  if (!resultado.serieCompleta) {
    const faltan = MDPA_DIAS_DE_SERIE - resultado.diasCompletos;
    return (
      `Tu promedio hasta ahora es ${sistolica}/${diastolica}. ` +
      `${faltan === 1 ? 'Falta 1 día' : `Faltan ${faltan} días`} para completar la semana.`
    );
  }
  if (resultado.enObjetivoIdeal) {
    return `Tu promedio de la semana es ${sistolica}/${diastolica}: estás en el rango ideal. Seguí así.`;
  }
  if (resultado.enObjetivoClinico) {
    return `Tu promedio de la semana es ${sistolica}/${diastolica}: estás en tu objetivo. Muy bien.`;
  }
  return (
    `Tu promedio de la semana es ${sistolica}/${diastolica}. ` +
    `Tu objetivo es menos de ${MDPA_OBJETIVO_CLINICO.sistolica}/${MDPA_OBJETIVO_CLINICO.diastolica}. ` +
    'Llevalo a tu control: lo vemos juntos.'
  );
}
