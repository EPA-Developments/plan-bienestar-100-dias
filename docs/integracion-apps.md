# Integración en las apps anfitrionas

Estado de la integración del módulo en las apps FooMedical/Medplum del
ecosistema Segunda Opinión Médica:

| App | Integración | Dónde |
| --- | --- | --- |
| [EPA-Developments/app](https://github.com/EPA-Developments/app) | Vendorizada | `src/vendor/plan-bienestar/` |
| [drdalessandro/app](https://github.com/drdalessandro/app) | Vendorizada | `src/vendor/plan-bienestar/` |

## Por qué vendorizado (por ahora)

`@epa/careplan-menopausia` y `@epa/plan-bienestar-react` **todavía no están
publicados en npm**. Hasta que se publiquen, cada app lleva una copia de los
`src/` de ambos paquetes bajo `src/vendor/plan-bienestar/`, con alias en
`tsconfig.json` (`paths`) y `vite.config.ts` (`resolve.alias`):

```jsonc
// tsconfig.json
"paths": {
  "@epa/careplan-menopausia": ["./src/vendor/plan-bienestar/careplan-menopausia/index.ts"],
  "@epa/plan-bienestar-react": ["./src/vendor/plan-bienestar/plan-bienestar-react/index.ts"]
}
```

Los imports de las apps ya usan los nombres finales (`@epa/...`), así que el
día que los paquetes se publiquen solo hay que instalarlos, borrar
`src/vendor/plan-bienestar/` y quitar los alias — ningún archivo de la app
cambia. Cada copia lleva un `README.md` con el procedimiento de re-sincronización;
**los cambios al módulo se hacen en este monorepo**, nunca en las copias.

## Las 2 líneas de integración (tal como quedaron)

```tsx
// HomePage.tsx — la card se auto-gestiona: null si el paciente no es elegible
<PlanBienestarCard />

// Router.tsx — dentro del área /care-plan que FooMedical ya tiene
<Route path="plan-100-dias/*" element={<PlanBienestarRoutes />} />
```

Más una entrada de menú en `pages/care-plan/index.tsx`
(`{ name: 'Plan Bienestar 100 Días', href: '/care-plan/plan-100-dias' }`).

## El onboarding alimenta la elegibilidad

`useElegibilidad()` evalúa el `useContext` de la `PlanDefinition` activa contra
**`Patient.gender` + edad (de `Patient.birthDate`)**. El registro de Medplum
(`RegisterForm`) no captura ninguno de los dos, así que las apps incorporan un
**Patient Journey de Bienvenida/Onboarding** de primera vez (gate en
`OnboardingGate`, pantalla `/bienvenida` en 3 pasos) que completa:

1. **Datos personales** — Sexo (Femenino / Masculino / Otros → `Patient.gender`)
   y Fecha de nacimiento (→ `Patient.birthDate`). *Sin este paso la card del
   plan nunca aparece.*
2. **Contacto** — Teléfono celular (`Patient.telecom`, system=phone/use=mobile),
   DNI con el sistema de FHIR Argentina (`Patient.identifier` con
   `system: http://www.renaper.gob.ar/dni`, RENAPER) y domicilio
   (`Patient.address`, country `AR`).

El origen del paciente viene en la extensión `patient-origin`
(`self` = auto-registrado; `reception` / `referral` = invitado por Recepción o
derivado por un colega — la setea el backend al invitar). Para invitados el
formulario se precarga desde el `Patient` y funciona como confirmación de datos.
Al finalizar se escribe todo en una sola actualización del `Patient`, junto con
la extensión `onboarding-completed`.

## Prerequisitos del servidor

- Sembrar los recursos del plan una vez por proyecto (idempotente):
  `asegurarRecursosDelPlan(medplum)` crea la `PlanDefinition` (el "cartel" de
  elegibilidad) y el `Questionnaire` compartido de screening.
- La gestión es 100% desde el Medplum App: cambiar `status`
  (`active` ⇄ `retired`) o el rango de edad/sexo del `useContext` cambia al
  instante quién ve el plan en **todas** las apps, sin redeploy.
- La `AccessPolicy` de pacientes debe permitir leer `PlanDefinition` y el
  `Questionnaire` compartido, y crear/leer sus propios `CarePlan`, `Goal`,
  `Task` y `QuestionnaireResponse` (ver
  [`666b35e`](https://github.com/EPA-Developments/plan-bienestar-100-dias/commit/666b35e)).

## Convivencia con la gamificación de drdalessandro/app

drdalessandro/app además trae una card de gamificación propia
(`PlanBienestar100`, progreso día X/100 + hitos + racha) para el plan que
Recepción crea con `CarePlan.category = care-plans|plan-bienestar-100`. No
compite con este módulo: el CarePlan del módulo se identifica por
`instantiatesCanonical` (URL canónica de la `PlanDefinition`) y categoría
SNOMED, así que cada card detecta solo su propio plan.
