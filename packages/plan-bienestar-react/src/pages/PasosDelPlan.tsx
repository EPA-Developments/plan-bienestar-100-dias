import type { ReactElement } from 'react';
import type { Patient, Task } from '@medplum/fhirtypes';
import { Anchor, Badge, Card, Checkbox, Group, Progress, Stack, Text, Title } from '@mantine/core';
import { useNavigate } from 'react-router';
import { useBasePath } from '../PlanBienestarContext';
import { usePlanBienestar } from '../hooks/usePlanBienestar';
import { pasoConCuestionario, tipoDePaso } from '../fhirTexto';

export interface PasosDelPlanProps {
  patient?: Patient;
  basePath?: string;
}

/** "Pasos del plan": the CarePlan's Tasks as a completable checklist. */
export function PasosDelPlan(props: PasosDelPlanProps): ReactElement {
  const navigate = useNavigate();
  const basePath = useBasePath(props.basePath);
  const plan = usePlanBienestar({ patient: props.patient });

  if (plan.cargando) {
    return <Text c="dimmed">Cargando tu plan…</Text>;
  }

  if (!plan.carePlan) {
    return (
      <Stack gap="xs">
        <Title order={3}>Pasos del plan</Title>
        <Text c="dimmed">Todavia no empezaste el plan. Volve a la pagina de inicio para sumarte.</Text>
      </Stack>
    );
  }

  const progreso = plan.total > 0 ? Math.round((plan.completados / plan.total) * 100) : 0;

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>{plan.carePlan.title ?? 'Pasos del plan'}</Title>
        <Text size="sm" c="dimmed">
          {plan.completados} de {plan.total} pasos completados ·{' '}
          <Anchor onClick={() => navigate(`${basePath}/metas`)}>Ver mis metas</Anchor>
        </Text>
      </div>
      <Progress value={progreso} aria-label="Progreso del plan" />
      <Stack gap="sm">
        {plan.pasos.map((paso: Task) => {
          const completado = paso.status === 'completed';
          const tipo = tipoDePaso(paso);
          return (
            <Card key={paso.id} withBorder radius="md" p="md">
              <Group align="flex-start" wrap="nowrap">
                <Checkbox
                  mt={4}
                  checked={completado}
                  onChange={(event) => plan.completarPaso(paso, event.currentTarget.checked)}
                  aria-label={paso.code?.text ?? 'Paso del plan'}
                />
                <div style={{ flex: 1 }}>
                  <Group gap="xs">
                    <Text fw={500} td={completado ? 'line-through' : undefined}>
                      {paso.code?.text}
                    </Text>
                    {tipo && (
                      <Badge size="xs" variant="light">
                        {tipo}
                      </Badge>
                    )}
                  </Group>
                  {paso.description && (
                    <Text size="sm" c="dimmed">
                      {paso.description}
                    </Text>
                  )}
                  {pasoConCuestionario(paso) && !completado && (
                    <Anchor size="sm" onClick={() => navigate(`${basePath}/cuestionario/${paso.id}`)}>
                      Responder cuestionario
                    </Anchor>
                  )}
                </div>
              </Group>
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
}
