# Changelog

## `@epa/plan-bienestar-react` 0.6.0

### Cuestionario inicial de la paciente

- **`CuestionarioBaseline`** (ruta `contanos`): de acá sale todo lo que hace que
  el plan sea suyo. De a un grupo por pantalla, con progreso — son 21 preguntas
  y se completan desde el teléfono; con la lista entera a la vista la gente
  abandona.
- Las preguntas y sus opciones **no están escritas en la pantalla**: salen de
  `BASELINE_PREGUNTAS` (`@epa/careplan-menopausia`), la misma declaración de la
  que sale el mapeo respuesta → señal. Lo que la paciente lee y lo que activa
  cada respuesta no pueden separarse.
- **`useBaseline()`**: lee la última respuesta, la precarga al volver a entrar, y
  al guardar **crea una respuesta nueva en vez de pisar la anterior**. Las viejas
  son historia clínica: si en marzo tenía náuseas y en junio no, las dos cosas
  fueron ciertas.
- «Ninguna de estas» es excluyente: marcarla destilda las barreras, y marcar una
  barrera la destilda a ella.
- `PasosDelPlan` invita a completarlo, **también cuando todavía no hay plan** —
  esa es justo la paciente que más necesita responderlo.
- `asegurarRecursosDelPlan()` siembra además el `Questionnaire` del baseline.

## `@epa/plan-bienestar-react` 0.5.0

### Gate comercial (monetización PB100D®)

- **`useCobertura()`**: entitlement por `Coverage` con el código del plan —
  `sin-cobertura` / `pendiente` / `vigente` / `vencida`. **Apagado por defecto**
  (`requiereCobertura`): la cohorte de investigación y las instalaciones sin
  monetización no cambian de comportamiento.
- `PlanBienestarCard` con los estados comerciales: «Quiero sumarme» registra la
  solicitud para que Recepción cobre y active (un click de la paciente). Sigue el
  patrón del ecosistema: **`Task` + bot**, no escritura directa — bajo la
  AccessPolicy del portal el paciente no puede crear `Task`.
- Cobertura cortada a mitad del programa: se congela el avance (`soloLectura`)
  **sin ocultar datos de salud**.
- Contrato completo en [`docs/monetizacion-pb100d.md`](docs/monetizacion-pb100d.md).

### Correcciones

- **`empezarPlan` es idempotente**: reconsulta el servidor y devuelve el plan
  activo existente en lugar de crear otro. Corrige el caso reportado en
  producción de una paciente con 4 `CarePlan` activos duplicados.
- El `CarePlan` se publica apenas se encuentra, antes de cargar Tasks y Goals:
  una falla de lectura ya no lo hace parecer inexistente («todavía no empezaste
  el plan» con planes ya creados). El faltante se expone como `errorDetalles`.

