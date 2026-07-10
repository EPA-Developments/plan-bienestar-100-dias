# @epa/plan-bienestar-react

Módulo React **drop-in** del **Plan Bienestar 100 Días** (salud cardiovascular en menopausia) para apps **FooMedical / Medplum**. La capa de datos FHIR vive en [`@epa/careplan-menopausia`](../careplan-menopausia).

**Plug-and-play:** la app anfitriona no sabe nada de menopausia, sexo ni edad. El módulo consulta la `PlanDefinition` **activa** en el servidor y evalúa su `useContext` (sexo/edad) contra el paciente logueado. La regla se edita en el servidor (Medplum App) y aplica a todas las apps al instante, sin redeploy.

## Instalación

```bash
npm install @epa/plan-bienestar-react
```

Peer deps (FooMedical ya las trae): `react ≥18`, `@medplum/core|react|fhirtypes ≥3.1`, `@mantine/core|hooks|notifications ≥7`, `react-router ≥6.4`.

## Integración (2 líneas)

```tsx
import { PlanBienestarCard, PlanBienestarRoutes } from '@epa/plan-bienestar-react';

// 1) HomePage: la tarjeta se auto-oculta si el paciente no es elegible.
<PlanBienestarCard />

// 2) Router: pantallas del plan (pasos / metas / cuestionario).
<Route path="/care-plan/plan-100-dias/*" element={<PlanBienestarRoutes />} />
```

Por defecto el paciente es el perfil logueado (`useMedplumProfile()`). Para portales profesionales u otros casos, pasá `patient={...}` o envolvé con `<PlanBienestarProvider patient={...} basePath={...}>`.

## Setup del servidor (una sola vez, idempotente)

```ts
import { asegurarPlanDefinition } from '@epa/plan-bienestar-react';
await asegurarPlanDefinition(medplum); // publica la PlanDefinition si no existe
```

Gestión posterior desde el Medplum App: `status: active ⇄ retired`, o editar el rango de edad del `useContext` — "2 clicks", sin tocar código.

## API

| Export | Qué hace |
| --- | --- |
| `<PlanBienestarCard />` | Tarjeta de la home. Estados: oculta (no elegible / cargando), CTA "Empezar mi plan" (crea el Bundle transaccional), progreso + "Continuar mi plan". |
| `<PlanBienestarRoutes />` | Rutas: índice = pasos (Tasks completables), `metas` (Goals con objetivos), `cuestionario/:taskId` (`QuestionnaireForm`; al enviar guarda la `QuestionnaireResponse` y completa la Task). |
| `useElegibilidad()` | `{ cargando, elegible, motivos, edad, planDefinition, refrescar }` — evalúa `useContext` server-side contra el paciente. |
| `usePlanBienestar()` | `{ carePlan, pasos, metas, completados, total, empezarPlan, completarPaso }`. |
| `asegurarPlanDefinition(medplum)` | Seed idempotente de la `PlanDefinition`. |
| `PlanBienestarProvider` | Config opcional (paciente / basePath). |

## Tests

```bash
npm test   # vitest + jsdom + @medplum/mock (MockClient)
```

Nota: `MockClient` exige indexar las definiciones FHIR globales antes de buscar (ver `test/setup.ts`); en apps contra un servidor Medplum real no hace falta.

## Licencia

Apache-2.0
