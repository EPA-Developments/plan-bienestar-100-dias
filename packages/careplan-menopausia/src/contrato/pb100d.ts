/**
 * Contrato PB100D — los identificadores que los cuatro repos tienen que compartir.
 *
 * El Plan Bienestar 100 Días no vive en un repo: la paciente lo ve en el portal
 * (`app`), el cardiólogo lo genera y publica en el `dashboard`, Recepción lo
 * cobra en `recepcionistas`, y el contenido clínico sale de este monorepo.
 * Los cuatro se hablan **sólo** a través de recursos FHIR, así que cada URL,
 * código y constante que aparece en esos recursos es una interfaz pública.
 *
 * Este archivo es esa interfaz, declarada una sola vez.
 *
 * POR QUÉ HACÍA FALTA
 * -------------------
 * Los mismos valores estaban escritos por separado en cada repo: la duración de
 * 100 días en seis lugares, el código del programa en cinco, la URL canónica de
 * la PlanDefinition en tres. Nada los mantenía iguales.
 *
 * Y ese desacuerdo no falla ruidosamente: falla en silencio. Si el dashboard
 * escribe `instantiatesCanonical` con una URL y el portal busca otra, el plan
 * queda activo del lado del médico y la paciente sigue viendo "todavía no
 * empezaste". No hay excepción, no hay log, nadie se entera hasta que alguien
 * reclama.
 *
 * ESCRIBIR CANÓNICO, LEER TOLERANTE
 * ---------------------------------
 * El ecosistema arrastra cuatro namespaces de cuando cada pieza nació por su
 * lado: `epa-bienestar.ar`, `segundaopinionmedica.org`, `seguimiento.medplum.com.ar`
 * y `biowellness.ar`. Los datos ya escritos con los viejos no se pueden reescribir
 * de un día para el otro.
 *
 * La salida es asimétrica y deliberada:
 *
 *   - al **escribir** se usa siempre `BASE_CANONICA` — así lo nuevo converge;
 *   - al **leer** se aceptan todos los namespaces (`coincide`, `buscarExtension`)
 *     — así lo viejo se sigue entendiendo.
 *
 * Con el tiempo la lectura tolerante deja de hacer falta, y recién ahí se puede
 * podar `BASES_ACEPTADAS`. Mientras tanto, nadie tiene que elegir entre migrar
 * todo de golpe o vivir con datos rotos.
 *
 * SIN DEPENDENCIAS A PROPÓSITO
 * ----------------------------
 * No importa nada, ni siquiera tipos de FHIR: se copia tal cual a cada repo que
 * lo consume. Cada consumidor tiene un test que compara sus constantes locales
 * contra este archivo, así una divergencia rompe el build en vez de romper el
 * circuito en producción.
 */

// ---------------------------------------------------------------------------
// El programa
// ---------------------------------------------------------------------------

/** Código de catálogo del programa. */
export const PB100D_CODIGO = 'PB100D';

/** Nombre comercial. Va en el ítem del Invoice y en el título del plan. */
export const PB100D_NOMBRE = 'Plan Bienestar 100 Días';

/** Duración del programa y de la cobertura, en días. */
export const PB100D_DURACION_DIAS = 100;

/**
 * Días del programa en que se evalúa a la paciente.
 *
 * Día 0 es el alta; día 100 el cierre. El dashboard agenda los controles con
 * estos hitos y Recepción los usa para el estado comercial del plan.
 */
export const PB100D_EVALUACION_DIAS: readonly number[] = Object.freeze([0, 30, 60, 100]);

// ---------------------------------------------------------------------------
// Namespaces
// ---------------------------------------------------------------------------

/** Namespace canónico. **Todo lo que se escribe usa este.** */
export const BASE_CANONICA = 'https://epa-bienestar.ar/fhir';

/**
 * Namespaces que hay que poder leer, en orden de preferencia.
 *
 * Los tres últimos son herencia de cuando cada pieza del ecosistema nació por su
 * cuenta. Se aceptan al leer y no se usan nunca al escribir.
 */
export const BASES_ACEPTADAS: readonly string[] = Object.freeze([
  BASE_CANONICA,
  'https://segundaopinionmedica.org/fhir',
  'https://seguimiento.medplum.com.ar/fhir',
  'https://biowellness.ar/fhir',
]);

// ---------------------------------------------------------------------------
// URLs canónicas
// ---------------------------------------------------------------------------

/**
 * PlanDefinition del programa.
 *
 * Es **el único vínculo** entre el plan que publica el cardiólogo y el que ve la
 * paciente: el CarePlan la lleva en `instantiatesCanonical` y el portal reconoce
 * el plan por ahí. Si esta constante se desincroniza entre repos, el circuito se
 * corta sin dar ningún error.
 */
export const PLAN_DEFINITION_URL = `${BASE_CANONICA}/PlanDefinition/menopausia-cardiovascular`;

/** Cuestionario del plan. */
export const QUESTIONNAIRE_URL = `${BASE_CANONICA}/Questionnaire/menopausia-cardiovascular`;

/** Sufijos de las extensiones del contrato, sin el namespace. */
export const EXT_SUFIJO = {
  /** Código del programa en el Coverage. */
  planCodigo: 'StructureDefinition/plan-codigo',
  /** `membresia` | `paquete` | `programa`. */
  tipoCobertura: 'StructureDefinition/tipo-cobertura',
  /** Cómo llegó la paciente: `self` | `reception` | `referral`. */
  patientOrigin: 'StructureDefinition/patient-origin',
} as const;

/** Sufijos de los CodeSystem del contrato, sin el namespace. */
export const SYS_SUFIJO = {
  /** Tipo de Task: distingue una solicitud de plan de un pedido de turno. */
  taskTipo: 'CodeSystem/task-tipo',
} as const;

/** URLs canónicas de extensión. Usar **siempre estas** al escribir. */
export const EXT = {
  planCodigo: `${BASE_CANONICA}/${EXT_SUFIJO.planCodigo}`,
  tipoCobertura: `${BASE_CANONICA}/${EXT_SUFIJO.tipoCobertura}`,
  patientOrigin: `${BASE_CANONICA}/${EXT_SUFIJO.patientOrigin}`,
} as const;

/** URLs canónicas de CodeSystem. Usar **siempre estas** al escribir. */
export const SYS = {
  taskTipo: `${BASE_CANONICA}/${SYS_SUFIJO.taskTipo}`,
} as const;

/** Códigos del contrato. Estos no llevan namespace: son valores, no URLs. */
export const COD = {
  /** `Task.code` de la solicitud de alta que manda el portal. */
  solicitudPlan: 'solicitud-plan',
  /** Valor de `tipo-cobertura` para un programa por ventana de tiempo. */
  coberturaPrograma: 'programa',
} as const;

// ---------------------------------------------------------------------------
// Lectura tolerante
// ---------------------------------------------------------------------------

/**
 * Todas las URLs aceptables para un sufijo, con la canónica primero.
 *
 * Útil para armar un `_filter` o un `Set` de búsqueda cuando hay que consultar
 * el servidor por cualquiera de los namespaces.
 */
export function urlsDe(sufijo: string): string[] {
  return BASES_ACEPTADAS.map((base) => `${base}/${sufijo}`);
}

/** ¿Esta URL designa el concepto, en cualquiera de los namespaces aceptados? */
export function coincide(url: string | undefined, sufijo: string): boolean {
  if (!url) {
    return false;
  }
  return BASES_ACEPTADAS.some((base) => url === `${base}/${sufijo}`);
}

/**
 * Busca una extensión por sufijo, sin importar el namespace en que se escribió.
 *
 * Tipado estructural para no depender de `@medplum/fhirtypes`: sirve para
 * cualquier objeto con `url`, que es lo que son las extensiones de FHIR.
 */
export function buscarExtension<T extends { url?: string }>(
  extensiones: readonly T[] | undefined,
  sufijo: string
): T | undefined {
  return extensiones?.find((e) => coincide(e.url, sufijo));
}

/**
 * ¿Este CarePlan es del Plan Bienestar 100 Días?
 *
 * Mira `instantiatesCanonical` tolerando el namespace y las versiones con `|`
 * (FHIR permite `url|version` en una referencia canónica).
 */
export function esCarePlanDelPrograma(instantiatesCanonical: readonly string[] | undefined): boolean {
  const sufijo = 'PlanDefinition/menopausia-cardiovascular';
  return (instantiatesCanonical ?? []).some((ref) => coincide(ref.split('|')[0], sufijo));
}
