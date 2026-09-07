import { BASELINE_GRUPOS, accionesDisponibles, perfilDesdeRespuesta } from '@epa/careplan-menopausia';
import { createReference } from '@medplum/core';
import type { MockClient } from '@medplum/mock';
import type { QuestionnaireResponse } from '@medplum/fhirtypes';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CuestionarioBaseline, PasosDelPlan } from '../src/index';
import { crearEscenario, renderConProveedores } from './renderConPlan';

/** Avanza hasta el último grupo, desde donde esté, y guarda. */
async function completar(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  let seguir = screen.queryByRole('button', { name: /Seguir/ });
  while (seguir) {
    await user.click(seguir);
    seguir = screen.queryByRole('button', { name: /Seguir/ });
  }
  await user.click(screen.getByRole('button', { name: /Guardar y ver mi plan/ }));
}

async function respuestasDe(medplum: MockClient, patientId: string): Promise<QuestionnaireResponse[]> {
  medplum.invalidateSearches('QuestionnaireResponse');
  return medplum.searchResources('QuestionnaireResponse', { subject: `Patient/${patientId}` });
}

/** La respuesta guardada, fallando con un mensaje claro si no hay ninguna. */
async function ultimaRespuesta(medplum: MockClient, patientId: string): Promise<QuestionnaireResponse> {
  const [guardada] = await respuestasDe(medplum, patientId);
  expect(guardada).toBeDefined();
  return guardada as QuestionnaireResponse;
}

const GRUPO_1 = BASELINE_GRUPOS[0] as (typeof BASELINE_GRUPOS)[number];
const GRUPO_2 = BASELINE_GRUPOS[1] as (typeof BASELINE_GRUPOS)[number];

describe('CuestionarioBaseline', () => {
  it('muestra un grupo por vez y avanza con el progreso', async () => {
    const user = userEvent.setup();
    const { medplum, maria } = await crearEscenario();
    renderConProveedores(medplum, <CuestionarioBaseline patient={maria} />);

    expect(await screen.findByText(GRUPO_1.text)).toBeInTheDocument();
    expect(screen.getByText(`1 de ${BASELINE_GRUPOS.length}`)).toBeInTheDocument();
    // El segundo grupo todavía no está en pantalla.
    expect(screen.queryByText(GRUPO_2.text)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Seguir/ }));
    expect(await screen.findByText(GRUPO_2.text)).toBeInTheDocument();
    expect(screen.getByText(`2 de ${BASELINE_GRUPOS.length}`)).toBeInTheDocument();
  });

  it('no deja volver desde el primer grupo', async () => {
    const { medplum, maria } = await crearEscenario();
    renderConProveedores(medplum, <CuestionarioBaseline patient={maria} />);
    expect(await screen.findByRole('button', { name: /Volver/ })).toBeDisabled();
  });

  it('guarda lo respondido como QuestionnaireResponse de la paciente', async () => {
    const user = userEvent.setup();
    const { medplum, maria } = await crearEscenario();
    renderConProveedores(medplum, <CuestionarioBaseline patient={maria} />);

    await user.click(await screen.findByLabelText('Ya estoy haciendo cambios'));
    await completar(user);

    await waitFor(async () => {
      expect(await respuestasDe(medplum, maria.id as string)).toHaveLength(1);
    });
    const guardada = await ultimaRespuesta(medplum, maria.id as string);
    expect(guardada.status).toBe('completed');
    expect(guardada.subject).toEqual(createReference(maria));
    expect(perfilDesdeRespuesta(guardada).senales).toContain('etapa:accion');
  });

  it('"ninguna de estas" es excluyente: destilda las barreras marcadas', async () => {
    const user = userEvent.setup();
    const { medplum, maria } = await crearEscenario();
    renderConProveedores(medplum, <CuestionarioBaseline patient={maria} />);

    // Grupo 2: digestión.
    await user.click(await screen.findByRole('button', { name: /Seguir/ }));
    const estrenimiento = await screen.findByLabelText('Voy de cuerpo con dificultad');
    await user.click(estrenimiento);
    expect(estrenimiento).toBeChecked();

    await user.click(screen.getByLabelText('Ninguna de estas'));
    expect(estrenimiento).not.toBeChecked();

    // Y al revés: marcar una barrera saca "ninguna".
    await user.click(estrenimiento);
    expect(screen.getByLabelText('Ninguna de estas')).not.toBeChecked();
  });

  it('lo que responde habilita acciones de la biblioteca', async () => {
    const user = userEvent.setup();
    const { medplum, maria } = await crearEscenario();
    renderConProveedores(medplum, <CuestionarioBaseline patient={maria} />);

    await user.click(await screen.findByLabelText('Sí')); // GLP-1
    await user.click(screen.getByLabelText('Ya estoy haciendo cambios'));
    await user.click(screen.getByRole('button', { name: /Seguir/ }));
    await user.click(await screen.findByLabelText('Marcadas, me condicionan las comidas'));
    await completar(user);

    await waitFor(async () => {
      expect(await respuestasDe(medplum, maria.id as string)).toHaveLength(1);
    });
    const guardada = await ultimaRespuesta(medplum, maria.id as string);
    const codigos = accionesDisponibles(perfilDesdeRespuesta(guardada)).map((a) => a.codigo);
    // N02 requiere GLP-1 activo y náuseas: las dos salieron del formulario.
    expect(codigos).toContain('N02');
  });

  it('precarga lo respondido antes y guarda una respuesta nueva, sin pisar la anterior', async () => {
    const user = userEvent.setup();
    const { medplum, maria } = await crearEscenario();
    renderConProveedores(medplum, <CuestionarioBaseline patient={maria} />);

    await user.click(await screen.findByLabelText('Ya estoy haciendo cambios'));
    await completar(user);
    await waitFor(async () => {
      expect(await respuestasDe(medplum, maria.id as string)).toHaveLength(1);
    });

    // Vuelve a entrar: la elección anterior aparece marcada.
    renderConProveedores(medplum, <CuestionarioBaseline patient={maria} />);
    await waitFor(() => {
      expect(screen.getAllByLabelText('Ya estoy haciendo cambios').at(-1)).toBeChecked();
    });
  });
});

describe('PasosDelPlan invita a completar el cuestionario', () => {
  it('sin baseline muestra la invitación', async () => {
    const { medplum, maria } = await crearEscenario();
    renderConProveedores(medplum, <PasosDelPlan patient={maria} />);
    expect(await screen.findByText('Contanos de vos')).toBeInTheDocument();
  });
});
