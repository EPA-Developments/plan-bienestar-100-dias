import type { Goal, GoalTarget, Patient, Reference } from '@medplum/fhirtypes';
import { concept, quantity, range, textConcept } from '../fhir/codeable.js';
import { SYSTEM } from '../terminology/systems.js';
import type { GoalCategoryKey, GoalPriorityKey, GoalTemplate } from '../model/planTemplate.js';

const CATEGORY_LABEL: Record<GoalCategoryKey, string> = {
  'estilo-de-vida': 'Estilo de vida',
  metabolico: 'Metabolico',
  cardiovascular: 'Cardiovascular',
  renal: 'Renal',
  bienestar: 'Bienestar',
};

const PRIORITY_LABEL: Record<GoalPriorityKey, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export interface GoalContext {
  patient: Reference<Patient>;
  id?: string;
  now?: string;
}

function buildTarget(template: GoalTemplate): GoalTarget | undefined {
  const { measure, target } = template;
  if (!measure && !target) return undefined;

  const result: GoalTarget = {};
  if (measure) result.measure = concept(measure);

  if (target) {
    const isRange = target.low !== undefined && target.high !== undefined && target.comparator === undefined;
    if (isRange) {
      result.detailRange = range(
        quantity(target.low as number, target.unit, target.ucumCode),
        quantity(target.high as number, target.unit, target.ucumCode),
      );
    } else {
      const bound =
        target.comparator === '>' || target.comparator === '>=' ? target.low : target.high;
      const value = bound ?? target.high ?? target.low;
      if (value !== undefined) {
        result.detailQuantity = quantity(value, target.unit, target.ucumCode, target.comparator);
      }
    }
  }
  return result;
}

/** Builds a FHIR Goal from a goal template. */
export function buildGoal(template: GoalTemplate, ctx: GoalContext): Goal {
  const goal: Goal = {
    resourceType: 'Goal',
    lifecycleStatus: 'proposed',
    description: textConcept(template.description),
    subject: ctx.patient,
    category: [
      {
        coding: [{ system: SYSTEM.epa, code: template.category, display: CATEGORY_LABEL[template.category] }],
        text: CATEGORY_LABEL[template.category],
      },
    ],
  };

  if (ctx.id) goal.id = ctx.id;
  if (ctx.now) goal.startDate = ctx.now;

  if (template.priority) {
    goal.priority = {
      coding: [
        {
          system: SYSTEM.goalPriority,
          code: `${template.priority}-priority`,
          display: `${PRIORITY_LABEL[template.priority]} prioridad`,
        },
      ],
      text: PRIORITY_LABEL[template.priority],
    };
  }

  const target = buildTarget(template);
  if (target) goal.target = [target];

  if (template.rationale) goal.note = [{ text: template.rationale }];

  return goal;
}
