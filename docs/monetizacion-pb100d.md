# Monetización del Plan Bienestar 100 Días®

Contrato entre las tres plataformas del ecosistema Favaloro | Medplum Argentina
para activar, cobrar y controlar el PB100D® como módulo plug & play.

> **PB100D® es marca registrada de EPA Bienestar IA** (spin-off, abril 2026),
> titular de la plataforma y del modelo comercial derivado — propuesta PM-LE8 v2.0, sección 10.

## Principio: un solo recurso, tres modelos de negocio

El *entitlement* vive en un **`Coverage`** con el código del plan — el mismo recurso
que Recepción ya emite y factura con `Invoice`. Cambiando **`Coverage.payor`** el
mismo modelo cubre los tres esquemas de venta, sin código adicional:

| Modelo | `Coverage.payor` | Caso | Fase |
| --- | --- | --- | --- |
| **B2C** | `Patient` | La paciente paga su plan | Fase I comercial |
| **B2B** | `Organization` (clínica) | Un centro compra N planes | **Fase II — red FAC, 24 provincias** |
| **B2B2C** | `Organization` (sponsor) | Patrocinio (Bayer, Go Red, aseguradora) | Fase II–III |
| **Investigación** | `Organization` (grant) | Cohorte del protocolo, sin cargo | Fase I CABA |

Diseñar hoy con `payor` como variable es lo que evita reescribir el módulo cuando
la Fase II escale a 50+ centros y 2.000+ mujeres.

## Las dos cohortes

Las 100 participantes del protocolo PM-LE8 **no pagan**: son sujetos de investigación
bajo CEI/IRB con `Consent` de investigación, y cobrarles comprometería la aprobación
ética y el financiamiento por grants. Conviven con la cohorte comercial sobre la
misma plataforma, y se distinguen **sólo por `Coverage.payor` y por el tipo de
`Consent`** — el módulo no necesita saber a cuál pertenece cada paciente.

Los datos de la cohorte comercial **no entran al dataset de AI/ML** salvo
consentimiento propio y explícito.

## El flujo de pocos clicks

| # | Rol | Plataforma | Acción | Recurso FHIR |
| --- | --- | --- | --- | --- |
| **1** | Paciente | App | Toca **«Quiero sumarme»** en la tarjeta del plan | `ServiceRequest` `status: draft` |
| **2** | Recepción | Recepcionistas | La solicitud entra a la bandeja → **«Cobrar y activar»** | `Invoice` + `Coverage` |
| **0** | Bot | Backend | `Subscription` sobre Coverage activo instancia el plan | `CarePlan` + `Goal` + `Task` |
| **✓** | Médico | Dashboard | Verifica adherencia y las 4 evaluaciones del protocolo | lectura |

La paciente hace **un solo click**: cuando vuelve a entrar, el plan ya está armado.

### Lo que implementa el módulo (este repo)

`useCobertura()` resuelve el estado comercial y `PlanBienestarCard` lo refleja:

| Estado | Qué ve la paciente | `habilitado` | `soloLectura` |
| --- | --- | --- | --- |
| `sin-cobertura` | «Quiero sumarme» | ✗ | ✗ |
| `pendiente` | «Recepción te va a contactar» | ✗ | ✗ |
| `vigente` | El plan completo | ✓ | ✗ |
| `vencida` | «Programa pausado» + «Quiero retomarlo» | ✗ | ✓ |

```tsx
// La app anfitriona enciende el gate en una línea:
<PlanBienestarProvider requiereCobertura>
  <PlanBienestarCard />
</PlanBienestarProvider>
```

Sin `requiereCobertura` el módulo se comporta como siempre (cohorte de
investigación e instalaciones sin monetización): **no hay regresión**.

### Contrato para Recepcionistas

Al cobrar, emitir el par de recursos:

```jsonc
// Coverage — el entitlement
{
  "resourceType": "Coverage",
  "status": "active",
  "beneficiary": { "reference": "Patient/..." },
  "payor": [{ "reference": "Patient/..." }],   // o la Organization que paga
  "period": { "start": "2026-07-25", "end": "2026-11-02" },  // 100 días
  "extension": [{
    "url": "https://segundaopinionmedica.org/fhir/StructureDefinition/plan-codigo",
    "valueString": "PB100D"
  }]
}
```

Más el `Invoice` correspondiente (pago único por los 100 días) y el pase de la
`ServiceRequest` a `status: completed`.

La URL de la extensión y el código son configurables (`planCodigoExtension`,
`planCodigo`) para instalaciones con otro namespace.

### Contrato para el Dashboard

El panel ya muestra planes asignados, pendientes y estancados. Para cerrar el
circuito comercial y científico le faltan dos columnas:

1. **Estado comercial** — leer el `Coverage` del paciente: vigente, por vencer,
   cortado a mitad de programa. Es lo que permite a Recepción actuar antes de perder
   la adherencia.
2. **Las 4 evaluaciones del protocolo** (día 0 / 30 / 60 / 100) como hitos
   verificables — lo que el investigador principal necesita para la cohorte PM-LE8.

## Regla que no se negocia

**Si se corta el pago se apaga el avance del programa, nunca los datos.** La
paciente conserva biomarcadores, LE8, PREVENT, estadío CKM y su historia completa;
sólo se congela la generación de nuevos pasos (`soloLectura`). Cobrar un programa
de prevención es normal; retener datos de salud detrás de un pago no lo es, y la
Ley 26.529 (Derechos del Paciente) lo respalda.

El módulo React **nunca calcula precios ni reglas de negocio** — igual que el portal,
que sólo lee `Coverage`/`Invoice` y deja las reglas en Recepción.
