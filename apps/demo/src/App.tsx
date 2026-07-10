import { buildMenopausePlanDefinition, LOINC } from '@epa/careplan-menopausia';
import {
  EstadioCkmCard,
  PlanBienestarCard,
  PlanBienestarRoutes,
  RiesgoPreventCard,
  useElegibilidad,
} from '@epa/plan-bienestar-react';
import {
  Alert,
  Anchor,
  Badge,
  Container,
  Divider,
  Group,
  MantineProvider,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import type { Patient, PlanDefinition } from '@medplum/fhirtypes';
import { MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router';

const HOY = new Date().toISOString().slice(0, 10);

interface Escenario {
  medplum: MockClient;
  maria: Patient;
  carlos: Patient;
  planDefinition: PlanDefinition;
}

async function sembrar(): Promise<Escenario> {
  const medplum = new MockClient();
  const maria = await medplum.createResource<Patient>({
    resourceType: 'Patient',
    name: [{ given: ['Maria Adela'], family: 'Bianchi' }],
    gender: 'female',
    birthDate: '1974-03-15', // 52 anios
  });
  const carlos = await medplum.createResource<Patient>({
    resourceType: 'Patient',
    name: [{ given: ['Carlos'], family: 'Gomez' }],
    gender: 'male',
    birthDate: '1988-06-01', // 38 anios
  });
  const planDefinition = await medplum.createResource<PlanDefinition>(
    buildMenopausePlanDefinition({ now: HOY }),
  );

  // Datos de laboratorio de Maria para que el mapa CKM y PREVENT tengan que mostrar.
  const obs = (code: string, value: number): Promise<unknown> =>
    medplum.createResource({
      resourceType: 'Observation',
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code }] },
      subject: { reference: `Patient/${maria.id}` },
      valueQuantity: { value },
      effectiveDateTime: `${HOY}T09:00:00Z`,
    });
  await Promise.all([
    obs(LOINC.totalCholesterol.code as string, 214),
    obs(LOINC.hdlCholesterol.code as string, 46),
    obs(LOINC.systolicBloodPressure.code as string, 138),
    obs(LOINC.bmi.code as string, 28),
    obs(LOINC.waistCircumference.code as string, 94),
    obs(LOINC.egfr.code as string, 82),
    obs(LOINC.fastingGlucose.code as string, 104),
  ]);

  return { medplum, maria, carlos, planDefinition };
}

function EstadoElegibilidad({ paciente }: { paciente: Patient }): ReactElement {
  const elegibilidad = useElegibilidad({ patient: paciente });
  if (elegibilidad.cargando) {
    return <Text c="dimmed">Evaluando elegibilidad…</Text>;
  }
  return (
    <Group gap="xs">
      <Badge color={elegibilidad.elegible ? 'teal' : 'gray'} variant="light">
        {elegibilidad.elegible ? 'Elegible' : 'No elegible'}
      </Badge>
      {elegibilidad.edad !== undefined && (
        <Text size="sm" c="dimmed">
          {paciente.gender === 'female' ? 'Mujer' : 'Varon'} · {elegibilidad.edad} anios
        </Text>
      )}
      {!elegibilidad.elegible && elegibilidad.motivos.length > 0 && (
        <Text size="sm" c="dimmed">
          — {elegibilidad.motivos.join(' ')}
        </Text>
      )}
    </Group>
  );
}

function Panel({ escenario }: { escenario: Escenario }): ReactElement {
  const navigate = useNavigate();
  const [pacienteId, setPacienteId] = useState('maria');
  const [activa, setActiva] = useState(true);
  const [clave, setClave] = useState(0);

  const paciente = pacienteId === 'maria' ? escenario.maria : escenario.carlos;

  const alternarPlanDefinition = async (encendida: boolean): Promise<void> => {
    // "2 clicks": el admin edita la PlanDefinition en el servidor; ninguna app
    // se toca. Aca lo simulamos con updateResource + remount de los hooks.
    await escenario.medplum.updateResource<PlanDefinition>({
      ...escenario.planDefinition,
      status: encendida ? 'active' : 'retired',
    });
    escenario.medplum.invalidateSearches('PlanDefinition');
    setActiva(encendida);
    setClave((actual) => actual + 1);
    navigate('/');
  };

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={2}>Plan Bienestar · 100 dias</Title>
          <Text c="dimmed">
            Demo plug-and-play del modulo (MockClient, sin servidor). El modulo se auto-gestiona:
            la tarjeta aparece solo si hay una PlanDefinition activa cuyo useContext (sexo/edad)
            matchea al paciente.
          </Text>
        </div>

        <Alert variant="light" color="blue" title="Panel de simulacion">
          <Stack gap="sm">
            <SegmentedControl
              value={pacienteId}
              onChange={(valor) => {
                setPacienteId(valor);
                navigate('/');
              }}
              data={[
                { label: 'Maria Adela (F · 52)', value: 'maria' },
                { label: 'Carlos (M · 38)', value: 'carlos' },
              ]}
            />
            <EstadoElegibilidad key={`estado-${pacienteId}-${clave}`} paciente={paciente} />
            <Switch
              checked={activa}
              onChange={(event) => alternarPlanDefinition(event.currentTarget.checked)}
              label='PlanDefinition activa en el servidor (el "toggle de 2 clicks" del admin)'
            />
          </Stack>
        </Alert>

        <Divider
          label={
            <Anchor size="xs" onClick={() => navigate('/')}>
              Inicio (asi se ve en la app anfitriona)
            </Anchor>
          }
        />

        <Routes key={`rutas-${pacienteId}-${clave}`}>
          <Route
            path="/"
            element={
              <Stack gap="md">
                <PlanBienestarCard patient={paciente} basePath="/care-plan/plan-100-dias" />
                <EstadioCkmCard patient={paciente} />
                <RiesgoPreventCard patient={paciente} basePath="/care-plan/plan-100-dias" />
              </Stack>
            }
          />
          <Route
            path="/care-plan/plan-100-dias/*"
            element={
              <PlanBienestarRoutes patient={paciente} basePath="/care-plan/plan-100-dias" />
            }
          />
        </Routes>
      </Stack>
    </Container>
  );
}

export function App(): ReactElement {
  const [escenario, setEscenario] = useState<Escenario | undefined>(undefined);
  const promesa = useMemo(() => sembrar(), []);

  useEffect(() => {
    promesa.then(setEscenario).catch(console.error);
  }, [promesa]);

  if (!escenario) {
    return <MantineProvider>Cargando demo…</MantineProvider>;
  }

  return (
    <MedplumProvider medplum={escenario.medplum}>
      <MantineProvider>
        <BrowserRouter>
          <Panel escenario={escenario} />
        </BrowserRouter>
      </MantineProvider>
    </MedplumProvider>
  );
}
