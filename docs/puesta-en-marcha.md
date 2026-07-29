# Puesta en marcha — Plan Bienestar 100 Días® en Segunda Opinión Médica

Paso a paso para pasar de "el código está listo" a "la primera paciente recorre el
circuito completo". Todo el desarrollo está mergeado y verde en los cuatro repos de
[EPA-Developments](https://github.com/EPA-Developments); lo que sigue es operativo.

**Proyecto Medplum destino:** `7ce5e559-f315-4538-abf2-61fa4922f996` ·
Segunda Opinión Médica · `api.medplum.com.ar`

---

## Paso 1 · Resolver el `CLIENT_ID` de la app ⛔ bloqueante

El `.env` de `EPA-Developments/app` se contradice:

```
# ClientApplication ... en el proyecto 7f068d7d   ← el comentario dice un proyecto
MEDPLUM_CLIENT_ID=516dfb15-fbdb-4652-b063-c81b2b6ae6a5
MEDPLUM_PROJECT_ID=7ce5e559-...                   ← y la variable dice otro
```

En Medplum un `ClientApplication` **pertenece a un solo proyecto**. Hay que abrir el
Medplum App y verificar a cuál pertenece `516dfb15…`:

- **Si pertenece a `7ce5e559`** → el comentario quedó viejo. Corregirlo y seguir.
- **Si pertenece a `7f068d7d`** → el registro/login del portal está cruzado hoy. Hay
  que crear un `ClientApplication` en `7ce5e559` y reemplazar el `MEDPLUM_CLIENT_ID`.

> Sin esto resuelto, todo lo demás puede fallar de formas confusas (pacientes que no
> aparecen, logins que no entran).

---

## Paso 2 · Credenciales de Recepción para `7ce5e559`

`recepcionistas` deriva el proyecto **de las credenciales**, no de la variable
(`resolverProjectId` lo saca del `ClientApplication` que conecta el CLI).

1. Crear en `7ce5e559` un `ClientApplication` para el CLI (seed y bots).
2. Completar en el `.env` de `recepcionistas`:
   ```
   MEDPLUM_BASE_URL=https://api.medplum.com.ar/
   MEDPLUM_CLIENT_ID=<el nuevo>
   MEDPLUM_CLIENT_SECRET=<el nuevo>
   MEDPLUM_PROJECT_ID=7ce5e559-f315-4538-abf2-61fa4922f996
   ```

---

## Paso 3 · Desplegar los bots

```bash
cd recepcionistas
npm run deploy:bots
```

**Verificar que imprima `Conectado a Medplum (project 7ce5e559…)`. Si muestra otro,
abortar** — con credenciales equivocadas el seed carga el catálogo en el tenant
equivocado.

Bots nuevos: `bw-solicitar-plan` (lo ejecuta la paciente) y
`bw-activar-plan-bienestar` (lo ejecuta Recepción).

> Conviene crear `bw-solicitar-plan` con **`runAsUser`**, para que el solicitante del
> `Task` no se pueda falsificar.

---

## Paso 4 · Seed

```bash
npm run seed -- --dry-run   # revisar
npm run seed                # aplicar (idempotente, upsert por nombre)
```

Aplica la `StructureDefinition` de `patient-origin` y la AccessPolicy
"Paciente — Portal" actualizada (la paciente pasa a poder ejecutar
`bw-solicitar-plan`).

---

## Paso 5 · Sembrar los recursos del plan

Una vez por proyecto, desde la app o un script:

```ts
await asegurarRecursosDelPlan(medplum);
```

Crea la `PlanDefinition` (el "cartel" de elegibilidad: mujer 45–65) y el
`Questionnaire` compartido de screening.

---

## Paso 6 · Encender el gate comercial en la app

En `EPA-Developments/app`, envolver la tarjeta:

```tsx
<PlanBienestarProvider
  requiereCobertura
  solicitudBot="bw-solicitar-plan"
  planCodigoExtension="https://biowellness.ar/fhir/StructureDefinition/plan-codigo"
  taskTipoSystem="https://biowellness.ar/fhir/CodeSystem/task-tipo"
>
  <PlanBienestarCard />
</PlanBienestarProvider>
```

Los namespaces son los de `recepcionistas` (es quien escribe esos recursos), no los
de la app. Sin `requiereCobertura` el plan queda abierto y gratuito.

---

## Paso 7 · Secrets en Medplum

| Secret | Para qué |
| --- | --- |
| `RECEPCION_WHATSAPP_TO` | Aviso a Recepción de cada solicitud nueva |
| `TWILIO_*` | Envío real de WhatsApp (sin esto las `Communication` quedan en `preparation`) |
| `PORTAL_BASE_URL` | `https://app.segundaopinionmedica.org` |
| `ANTHROPIC_API_KEY` | **Dashboard**, bot `careplan-generate`: genera el borrador del plan con IA |

> ⚠️ **Timeout del Lambda de `careplan-generate`:** la llamada al LLM excede el
> timeout por defecto de Medplum (10 s). Subirlo a **~60 s** en AWS o la generación
> falla con `Sandbox.Timedout`. Opcionales: `CKM_CAREPLAN_MODEL` y
> `CKM_CAREPLAN_TIMEOUT_MS` (este último debe quedar por debajo del Lambda).

---

## Paso 8 · Prueba end-to-end

1. Paciente elegible (mujer 45–65) entra al portal → ve **«Quiero sumarme»**.
2. Lo toca → **«Solicitud enviada»**; llega el aviso a Recepción.
3. Recepción → **Solicitudes** → fila con badge *Plan Bienestar* → **«Cobrar y
   activar»** (precio prellenado en USD 400).
4. Verificar `Coverage` (100 días, `tipo-cobertura=programa`) + `Invoice`, y `Task`
   en `completed`.
5. La paciente vuelve al portal: plan habilitado, anillo **«Día 1 de 100»**.
6. Dashboard → **Seguimiento del Plan Bienestar**: aparece con su estado comercial y
   los 4 puntos de las evaluaciones.

**Casos de borde a probar:** activación *sin cargo* (cohorte de investigación),
doble click en «Quiero sumarme» (debe generar **una sola** solicitud), y paciente
invitada por Recepción (la Bienvenida debe decir *«te estábamos esperando»* con los
datos precargados).

---

## Precios (definidos)

| Ítem | USD | Cómo se cobra |
| --- | --- | --- |
| Plan Bienestar 100 Días | **400** | Cobertura `programa` (bot `bw-activar-plan-bienestar`) |
| Consulta inicial de cardiología | **200** | Servicio aparte del catálogo |

Definidos por el **Dr. Alejandro Barbagelata** para Segunda Opinión Médica (no salen
del Manual de Protocolos v9, que rige las líneas de BioWellness). Cargados en
`recepcionistas/src/config/programas.ts`.

**Confirmado:** son **USD 4/día × 100 días = 400**, porque el programa incluye el
seguimiento **más la propuesta de Webinar**.

---

## El flujo prescriptivo (implementado)

> paciente carga datos → consulta con el cardiólogo → borrador IA → **publicar**

El circuito clínico quedó construido:

> 1. La paciente **carga sus datos** en la app: cuestionarios LE8 (Nutrición MEPA,
>    Sueño PSQI, Actividad Física, Tabaco) y signos vitales (PA, peso, altura → IMC).
> 2. **Consulta inicial de cardiología (USD 200)**: el cardiólogo recibe y evalúa
>    todo ese panorama desde el Dashboard.
> 3. El cardiólogo **solicita un plan potenciado con IA** a partir de esos datos,
>    y lo **optimiza** según su criterio.
> 4. La consulta cierra con la **promesa de publicar** el plan.
> 5. Recién entonces **se publica** y arrancan los 100 días de seguimiento.

Cómo quedó resuelto cada punto:

| Aspecto | Cómo funciona |
| --- | --- |
| Quién dispara el plan | El **cardiólogo**, desde el chart de la paciente |
| Contenido | **Generado con IA** (bot `careplan-generate`) desde el contexto CKM real |
| Estado intermedio | `CarePlan` en **`draft`** — el bot nunca activa ni prescribe |
| Precondición | Se **bloquea** la generación sin presión arterial, IMC y ≥1 cuestionario LE8, y se dice qué falta |
| Cuándo arrancan los 100 días | Al **publicar**: `publicarBorrador()` reancla la ventana a esa fecha |
| Cómo lo ve la paciente | El `CarePlan` lleva `instantiatesCanonical`, que es el vínculo por el que el portal lo reconoce |

Los dos últimos puntos eran huecos reales: sin `instantiatesCanonical` el plan
quedaba activo en el Dashboard pero la paciente seguía viendo *"todavía no empezaste
el plan"*, y la ventana arrancaba en la fecha de **generación**, así que una paciente
cuyo plan se revisaba una semana después empezaba en el "día 8".

---

## Módulos pendientes de definir

Dentro del plan, todos virtuales — cada uno con **consulta + plan**:

- **Nutrición**
- **Entrenamiento personal**
- **Psicología**

Cada módulo es, comercialmente, el mismo patrón que ya funciona: un servicio
(la consulta) más un ítem de programa. Conviene definir para cada uno: precio,
si va incluido en los USD 400 o se cobra aparte, y qué profesional lo firma.
