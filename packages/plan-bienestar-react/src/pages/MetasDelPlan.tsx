import type { ReactElement } from 'react';
import type { Goal, Patient } from '@medplum/fhirtypes';
import { Anchor, Badge, Card, Group, Stack, Text, Title } from '@mantine/core';
import { useNavigate } from 'react-router';
import { useBasePath } from '../PlanBienestarContext';
import { usePlanBienestar } from '../hooks/usePlanBienestar';
import { textoMeta } from '../fhirTexto';

export interface MetasDelPlanProps {
  patient?: Patient;
  basePath?: string;
}

/** "Mis metas": the CarePlan's Goals with their categories and targets. */
export function MetasDelPlan(props: MetasDelPlanProps): ReactElement {
  const navigate = useNavigate();
  const basePath = useBasePath(props.basePath);
  const plan = usePlanBienestar({ patient: props.patient });

  if (plan.cargando) {
    return <Text c="dimmed">Cargando tus metas…</Text>;
  }

  if (!plan.carePlan) {
    return <Text c="dimmed">Todavia no empezaste el plan.</Text>;
  }

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>Mis metas</Title>
        <Text size="sm" c="dimmed">
          <Anchor onClick={() => navigate(basePath)}>Volver a los pasos del plan</Anchor>
        </Text>
      </div>
      <Stack gap="sm">
        {plan.metas.map((meta: Goal) => {
          const objetivo = textoMeta(meta);
          const categoria = meta.category?.[0]?.text;
          const nota = meta.note?.[0]?.text;
          return (
            <Card key={meta.id} withBorder radius="md" p="md">
              <Stack gap={4}>
                <Group gap="xs">
                  {categoria && (
                    <Badge size="xs" variant="light">
                      {categoria}
                    </Badge>
                  )}
                  {objetivo && (
                    <Badge size="xs" color="teal" variant="light">
                      Objetivo: {objetivo}
                    </Badge>
                  )}
                </Group>
                <Text fw={500}>{meta.description?.text}</Text>
                {nota && (
                  <Text size="xs" c="dimmed">
                    {nota}
                  </Text>
                )}
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
}
