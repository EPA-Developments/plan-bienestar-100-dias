import type { Patient } from '@medplum/fhirtypes';
import { Badge, Button, Card, Group, Progress, Stack, Text, Title } from '@mantine/core';
import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { useBasePath } from '../PlanBienestarContext';
import { useElegibilidad } from '../hooks/useElegibilidad';
import { usePlanBienestar } from '../hooks/usePlanBienestar';

export interface PlanBienestarCardProps {
  /** Patient override; defaults to provider config or the logged-in profile. */
  patient?: Patient;
  /** Where `PlanBienestarRoutes` is mounted. Default `/care-plan/plan-100-dias`. */
  basePath?: string;
  /** Canonical URL of the PlanDefinition. Defaults to the menopause plan. */
  planDefinitionUrl?: string;
}

/**
 * Home-page card of the Plan Bienestar 100 Dias. Self-gating: renders nothing
 * unless the server has an ACTIVE PlanDefinition whose useContext (gender/age)
 * matches the patient. Offers to start the plan, or shows progress and a
 * shortcut once the plan is underway.
 */
export function PlanBienestarCard(props: PlanBienestarCardProps): ReactElement | null {
  const navigate = useNavigate();
  const basePath = useBasePath(props.basePath);
  const elegibilidad = useElegibilidad({
    patient: props.patient,
    planDefinitionUrl: props.planDefinitionUrl,
  });
  const plan = usePlanBienestar({
    patient: props.patient,
    planDefinitionUrl: props.planDefinitionUrl,
  });
  const [creando, setCreando] = useState(false);

  if (elegibilidad.cargando || plan.cargando || !elegibilidad.elegible) {
    return null;
  }

  const titulo = elegibilidad.planDefinition?.title ?? 'Plan Bienestar 100 Dias';
  const descripcion = elegibilidad.planDefinition?.description;

  const empezar = async (): Promise<void> => {
    setCreando(true);
    try {
      await plan.empezarPlan();
      navigate(basePath);
    } finally {
      setCreando(false);
    }
  };

  if (plan.carePlan) {
    const progreso = plan.total > 0 ? Math.round((plan.completados / plan.total) * 100) : 0;
    return (
      <Card withBorder radius="md" p="lg" data-testid="plan-bienestar-card">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <div>
              <Badge color="teal" variant="light">
                Plan en curso
              </Badge>
              <Title order={4} mt="xs">
                {titulo}
              </Title>
            </div>
            <Button onClick={() => navigate(basePath)}>Continuar mi plan</Button>
          </Group>
          <Text size="sm" c="dimmed">
            {plan.completados} de {plan.total} pasos completados
          </Text>
          <Progress value={progreso} aria-label="Progreso del plan" />
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder radius="md" p="lg" data-testid="plan-bienestar-card">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <div>
            <Badge color="teal" variant="light">
              Recomendado para vos
            </Badge>
            <Title order={4} mt="xs">
              {titulo}
            </Title>
          </div>
          <Button onClick={empezar} loading={creando}>
            Empezar mi plan
          </Button>
        </Group>
        {descripcion && (
          <Text size="sm" c="dimmed">
            {descripcion}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
