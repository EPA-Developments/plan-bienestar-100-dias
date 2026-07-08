# @epa/careplan-menopausia

Fábrica de recursos **FHIR R4** para el **CarePlan de salud cardiovascular de la mujer en menopausia**, primera pieza de la línea *Salud de la Mujer* del **Plan Bienestar 100 Días** (EPA Bienestar IA / Favaloro).

Módulo *drop-in* para aplicaciones **FooMedical / Medplum** (React). Esta primera versión entrega la **capa de datos**: funciones TypeScript que generan los recursos FHIR necesarios para instanciar el CarePlan. El módulo de UI en React se construye sobre esta base en una etapa posterior.

## Base clínica ("la verdad")

El plan se apoya en la evidencia de la American Heart Association:

- **Marco Cardiovascular-Renal-Metabólico (CKM)** — *Ndumele et al., "Cardiovascular-Kidney-Metabolic Health: A Presidential Advisory from the AHA", Circulation 2023.* Aporta la visión integrada corazón–riñón–metabolismo (incluye el componente renal: relación albúmina/creatinina).
- **Menopausia y riesgo cardiovascular** — *El Khoudary et al., "Menopause Transition and Cardiovascular Disease Risk", Circulation 2020.* La transición menopáusica acelera el riesgo CV: es una ventana clave de prevención temprana.
- **Life's Essential 8 (AHA)** — columna vertebral de las metas de estilo de vida: dieta, actividad física, exposición a nicotina, sueño, IMC, lípidos, glucemia y presión arterial.

> **Alcance de esta versión:** es una *plantilla de plan* con metas, educación y monitoreo. **No** incluye todavía el motor de estadificación CKM (0–4) ni el cálculo de riesgo (PREVENT); están en el roadmap. Los umbrales son valores de prevención por defecto y deben individualizarse por el equipo de salud.

## Recursos FHIR generados

Un `Bundle` transaccional (`type: "transaction"`) con referencias internas `urn:uuid` que el servidor FHIR resuelve al enviarlo:

| Recurso | Rol |
| --- | --- |
| `CarePlan` | Plan que agrupa metas, actividades, equipo y condición |
| `Goal` (×N) | Metas SMART (Life's Essential 8 + renal + bienestar) |
| `CareTeam` | Equipo interdisciplinario |
| `Task` (×N) | Ítems de acción (*action-items* que FooMedical ya lista en `/care-plan`) |
| `Questionnaire` | Cribado CV en menopausia (incluye factores de riesgo propios de la mujer) |
| `Condition` | Hallazgo de menopausia referido por `CarePlan.addresses` |

Terminología: **FHIR R4 + LOINC + SNOMED CT** (perfiles AR Core quedan para una etapa posterior).

## Instalación

```bash
npm install @epa/careplan-menopausia @medplum/fhirtypes
```

## Uso

```ts
import { buildMenopauseCarePlanBundle } from '@epa/careplan-menopausia';
import { useMedplum } from '@medplum/react';

const medplum = useMedplum();

const bundle = buildMenopauseCarePlanBundle({
  patient: { reference: `Patient/${patientId}` },
  lifeStage: 'perimenopausia', // 'posmenopausia' | 'menopausia-prematura' | 'menopausia-quirurgica'
  now: new Date().toISOString().slice(0, 10),
  careTeam: {
    members: [{ reference: `Practitioner/${practitionerId}` }],
    managingOrganization: { reference: 'Organization/epa-bienestar' },
  },
});

// Crea todos los recursos en una sola transacción.
await medplum.executeBatch(bundle);
```

¿Preferís crear los recursos por separado? `buildMenopauseCarePlan(options)` devuelve el `bundle` **y** cada recurso ya cableado (`carePlan`, `goals`, `tasks`, `careTeam`, `questionnaire`, `condition`).

También se exportan la plantilla clínica (`MENOPAUSE_PLAN`, `MENOPAUSE_GOALS`, …), la terminología (`LOINC`, `SNOMED`, `SYSTEM`) y helpers FHIR (`quantity`, `concept`, `sequentialIdGenerator`, …).

## Scripts

```bash
npm install
npm run build      # compila a dist/ (ESM + tipos)
npm test           # vitest
npm run example    # imprime un Bundle de ejemplo (paciente tipo "Alice")
```

## ⚠️ Verificación de códigos SNOMED CT

Los códigos SNOMED `menopausePresent` (289903006) y `prematureMenopause` (373717006) fueron verificados. Los códigos de **perimenopausia**, **posmenopausia** y **menopausia quirúrgica** están marcados con `TODO confirm` en [`src/terminology/snomed.ts`](src/terminology/snomed.ts) y **deben validarse en el navegador oficial de SNOMED CT** (https://browser.ihtsdotools.org) según la edición/versión del despliegue antes de uso clínico.

## Roadmap

1. **(esta versión)** Recursos FHIR R4 del CarePlan de menopausia — plantilla.
2. Módulo React *drop-in* (componentes + hooks) para FooMedical/Medplum.
3. Estadificación CKM 0–4 (Ndumele) como clasificación/`Observation`.
4. Estratificación de riesgo (PREVENT) que module metas y seguimiento.
5. Perfiles AR Core (msal.gob.ar) y otras etapas de la vida de la mujer.

## Licencia

Apache-2.0
