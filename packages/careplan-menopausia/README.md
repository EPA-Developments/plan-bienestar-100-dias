# @epa/careplan-menopausia

Fábrica de recursos **FHIR R4** para el **CarePlan de salud cardiovascular de la mujer en menopausia**, primera pieza de la línea *Salud de la Mujer* del **Plan Bienestar 100 Días** (EPA Bienestar IA / Favaloro).

Capa de **datos** del módulo *drop-in* para aplicaciones **FooMedical / Medplum**: funciones TypeScript que generan los recursos FHIR necesarios para publicar el plan (`PlanDefinition`) e instanciarlo por paciente (`CarePlan` y compañía). La capa de **UI** vive en [`@epa/plan-bienestar-react`](../plan-bienestar-react).

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
| `PlanDefinition` | Definición publicada del plan; su `useContext` (sexo/edad) es la regla de elegibilidad editable en el servidor (`buildMenopausePlanDefinition`) |
| `CarePlan` | Plan que agrupa metas, actividades, equipo y condición (`instantiatesCanonical` → PlanDefinition) |
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

También se exportan la plantilla clínica (`MENOPAUSE_PLAN`, `MENOPAUSE_GOALS`, …), la terminología (`LOINC`, `SNOMED`, `SYSTEM`), helpers FHIR (`quantity`, `concept`, `sequentialIdGenerator`, …) y la elegibilidad:

```ts
import { buildMenopausePlanDefinition, evaluateEligibility } from '@epa/careplan-menopausia';

// Publicar la definición del plan (elegible: mujeres de 45 a 65, editable en el servidor).
const planDefinition = buildMenopausePlanDefinition({ now: '2026-07-10' });

// ¿Este Patient matchea el useContext de la definición?
const { eligible, reasons, age } = evaluateEligibility(patient, planDefinition);
```

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

Ver el [README del monorepo](../../README.md#roadmap).

## Licencia

Apache-2.0
