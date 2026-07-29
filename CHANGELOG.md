# Changelog

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

