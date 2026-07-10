import type { Patient } from '@medplum/fhirtypes';
import type { CkmStage } from '@epa/careplan-menopausia';
import { Badge, Card, Group, Skeleton, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import type { ReactElement } from 'react';
import { useCkm } from '../hooks/useCkm';

export interface EstadioCkmCardProps {
  /** Patient override; defaults to provider config or the logged-in profile. */
  patient?: Patient;
}

const ETAPAS: Record<CkmStage, { titulo: string; color: string; mensaje: string }> = {
  0: {
    titulo: 'Zona saludable',
    color: 'teal',
    mensaje: '¡Excelente! Tu corazón, tus riñones y tu metabolismo están en zona saludable. El plan te ayuda a mantenerlo así.',
  },
  1: {
    titulo: 'Primeras señales',
    color: 'lime',
    mensaje: 'Aparecen las primeras señales (peso o glucemia). Es el mejor momento para actuar: con hábitos alcanza.',
  },
  2: {
    titulo: 'Factores de riesgo activos',
    color: 'yellow',
    mensaje: 'Hay factores de riesgo que conviene ordenar ahora, junto a tu equipo. Cada mejora suma mucho en esta etapa.',
  },
  3: {
    titulo: 'Señales tempranas en el corazón o riñón',
    color: 'orange',
    mensaje: 'Tus estudios muestran señales que piden seguimiento cercano. Tu equipo va a acompañarte de cerca.',
  },
  4: {
    titulo: 'Cuidado activo',
    color: 'red',
    mensaje: 'Ya hay una condición cardiovascular diagnosticada: el plan acompaña tu tratamiento, nunca lo reemplaza.',
  },
};

/**
 * "Mapa de salud corazón-riñón-metabolismo": patient-friendly CKM stage (0-4)
 * with a 5-segment meter, plain-language meaning, matched findings and
 * missing-data prompts. Educational framing — never a diagnosis.
 */
export function EstadioCkmCard(props: EstadioCkmCardProps): ReactElement | null {
  const ckm = useCkm({ patient: props.patient });

  if (ckm.cargando) {
    return <Skeleton height={120} radius="lg" />;
  }

  const resultado = ckm.resultado;
  if (!resultado) {
    return null;
  }

  const etapa = resultado.stage !== undefined ? ETAPAS[resultado.stage] : undefined;

  return (
    <Card withBorder radius="lg" p="lg" data-testid="estadio-ckm-card">
      <Stack gap="sm">
        <Group gap="sm">
          <ThemeIcon variant="light" color={etapa?.color ?? 'gray'} size={44} radius="xl">
            🫀
          </ThemeIcon>
          <div>
            <Text size="sm" c="dimmed">
              Tu mapa corazón · riñones · metabolismo
            </Text>
            <Title order={4}>
              {etapa ? etapa.titulo : 'Faltan datos para armar tu mapa'}
            </Title>
          </div>
        </Group>

        {resultado.stage !== undefined && (
          <Group gap={6} aria-label={`Etapa ${resultado.stage} de 4`}>
            {([0, 1, 2, 3, 4] as CkmStage[]).map((nivel) => (
              <Tooltip key={nivel} label={ETAPAS[nivel].titulo}>
                <div
                  style={{
                    flex: 1,
                    height: 10,
                    borderRadius: 999,
                    background:
                      nivel <= (resultado.stage as number)
                        ? `var(--mantine-color-${ETAPAS[resultado.stage as CkmStage].color}-5)`
                        : 'var(--mantine-color-gray-3)',
                  }}
                />
              </Tooltip>
            ))}
          </Group>
        )}

        <Text size="sm">{etapa?.mensaje ?? 'Con algunos datos más podemos mostrarte dónde estás parada y qué cuidar primero.'}</Text>

        {resultado.criterios.length > 0 && (
          <Group gap="xs">
            {resultado.criterios.map((criterio) => (
              <Badge key={criterio.key} variant="light" color="gray" radius="xl" size="sm">
                {criterio.label}
              </Badge>
            ))}
          </Group>
        )}

        {resultado.faltantes.length > 0 && (
          <Text size="xs" c="dimmed">
            Para afinar tu mapa, sumá: {resultado.faltantes.join(', ')}.
          </Text>
        )}

        <Text size="xs" c="dimmed">
          Este mapa es educativo y no reemplaza la evaluación de tu equipo de salud.
        </Text>
      </Stack>
    </Card>
  );
}
