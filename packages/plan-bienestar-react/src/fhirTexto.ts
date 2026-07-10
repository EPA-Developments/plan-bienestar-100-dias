import type { Goal, Quantity, Task } from '@medplum/fhirtypes';

function cantidad(quantity: Quantity | undefined): string | undefined {
  if (quantity?.value === undefined) return undefined;
  const unidad = quantity.unit ? ` ${quantity.unit}` : '';
  const comparador = quantity.comparator ? `${quantity.comparator} ` : '';
  return `${comparador}${quantity.value}${unidad}`;
}

/** Human-readable (Spanish) text for a Goal target: `7 a 9 h`, `< 130 mg/dL`. */
export function textoMeta(meta: Goal): string | undefined {
  const target = meta.target?.[0];
  if (!target) return undefined;
  if (target.detailRange) {
    const low = cantidad(target.detailRange.low);
    const high = cantidad(target.detailRange.high);
    if (low && high) return `${low} a ${high}`;
    return low ?? high;
  }
  return cantidad(target.detailQuantity);
}

/** The activity kind label the core stamps on Task.businessStatus. */
export function tipoDePaso(paso: Task): string | undefined {
  return paso.businessStatus?.text;
}

/** True when the step asks the patient to fill the plan questionnaire. */
export function pasoConCuestionario(paso: Task): boolean {
  return paso.focus?.reference?.startsWith('Questionnaire/') ?? false;
}
