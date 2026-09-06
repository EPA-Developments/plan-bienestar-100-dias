import { describe, expect, it } from 'vitest';
import {
  BIBLIOTECA_NIVEL_1,
  NIVELES,
  accionesDisponibles,
  buscarAccion,
  estadoNivel,
  mencionaDosificacionGlp1,
  nivelesHabilitables,
  validarSeleccion,
  type PerfilBaseline,
} from '../src/index.js';

const PREFIJO_POR_PILAR: Record<string, string> = {
  'nutricion-glp1': 'N',
  'osteomuscular-movimiento': 'A',
  'sueno-termorregulacion': 'S',
  'conducta-adherencia': 'C',
};

describe('biblioteca de acciones Nivel 1', () => {
  it('tiene las 40 acciones del Anexo C, con códigos únicos y coherentes con su pilar', () => {
    expect(BIBLIOTECA_NIVEL_1).toHaveLength(40);
    const codigos = BIBLIOTECA_NIVEL_1.map((a) => a.codigo);
    expect(new Set(codigos).size).toBe(40);
    for (const accion of BIBLIOTECA_NIVEL_1) {
      expect(accion.codigo.startsWith(PREFIJO_POR_PILAR[accion.pilar])).toBe(true);
      expect(accion.practica.length).toBeGreaterThan(0);
      expect(accion.racional.length).toBeGreaterThan(0);
    }
    // 10 por pilar.
    for (const prefijo of ['N', 'A', 'S', 'C']) {
      expect(codigos.filter((c) => c.startsWith(prefijo))).toHaveLength(10);
    }
  });

  it('sólo ofrece acciones que alguna señal del baseline habilita', () => {
    const perfil: PerfilBaseline = { senales: ['barrera:estrenimiento'] };
    const codigos = accionesDisponibles(perfil).map((a) => a.codigo);
    expect(codigos).toContain('N03'); // hidratación
    expect(codigos).toContain('N06'); // fibra soluble
    expect(codigos).not.toContain('S01'); // nada la habilita
  });
});

describe('seguridad: impacto óseo (A03) vs alternativa sin impacto (A04)', () => {
  it('con densitometría alterada se cae A03 y aparece A04', () => {
    const perfil: PerfilBaseline = {
      senales: ['etapa:accion'],
      flags: ['flag:densitometria-alterada'],
    };
    const codigos = accionesDisponibles(perfil).map((a) => a.codigo);
    expect(codigos).not.toContain('A03');
    expect(codigos).toContain('A04');
  });

  it('sin flags de riesgo A03 está disponible y A04 no', () => {
    const codigos = accionesDisponibles({ senales: ['etapa:accion'] }).map((a) => a.codigo);
    expect(codigos).toContain('A03');
    expect(codigos).not.toContain('A04');
  });

  it('rechaza A03 aunque el modelo la pida explícitamente, si hay caídas recientes', () => {
    const { aceptadas, rechazadas } = validarSeleccion(['A03'], {
      senales: ['etapa:accion'],
      flags: ['flag:caidas-recientes'],
    });
    expect(aceptadas).toHaveLength(0);
    expect(rechazadas[0]).toMatchObject({ codigo: 'A03', motivo: 'contraindicada' });
  });

  it('nunca acepta A03 y A04 juntas', () => {
    const { aceptadas, rechazadas } = validarSeleccion(['A03', 'A04'], {
      senales: ['etapa:accion'],
      flags: ['flag:caidas-recientes', 'flag:densitometria-alterada'],
    });
    expect(aceptadas.map((a) => a.codigo)).toEqual(['A04']);
    expect(rechazadas.map((r) => r.motivo)).toContain('contraindicada');
  });
});

describe('validarSeleccion: guardarraíl de lo que devuelve el LLM', () => {
  const perfil: PerfilBaseline = { senales: ['etapa:accion', 'barrera:nauseas'], conGlp1: true };

  it('descarta un código inventado sin romper el resto de la selección', () => {
    const { aceptadas, rechazadas } = validarSeleccion(['N02', 'N99', 'C03'], perfil);
    expect(aceptadas.map((a) => a.codigo)).toEqual(['N02', 'C03']);
    expect(rechazadas).toEqual([
      { codigo: 'N99', motivo: 'codigo-desconocido', detalle: 'No existe en la biblioteca de Nivel 1.' },
    ]);
  });

  it('descarta acciones que ninguna señal habilita', () => {
    const { aceptadas, rechazadas } = validarSeleccion(['S03'], perfil);
    expect(aceptadas).toHaveLength(0);
    expect(rechazadas[0].motivo).toBe('no-disponible-para-el-perfil');
  });

  it('descarta duplicados', () => {
    const { aceptadas, rechazadas } = validarSeleccion(['C03', 'C03'], perfil);
    expect(aceptadas).toHaveLength(1);
    expect(rechazadas[0].motivo).toBe('duplicada');
  });

  it('no ofrece acciones atadas al fármaco si no hay GLP-1 activo', () => {
    const sinFarmaco: PerfilBaseline = { senales: ['barrera:nauseas', 'barrera:inapetencia'] };
    expect(accionesDisponibles(sinFarmaco).map((a) => a.codigo)).not.toContain('N02');

    const { aceptadas, rechazadas } = validarSeleccion(['N02', 'N07'], sinFarmaco);
    expect(aceptadas).toHaveLength(0);
    expect(rechazadas.map((r) => r.motivo)).toEqual(['requiere-glp1', 'requiere-glp1']);
  });

  it('la derivación a kinesiología pelviperineal sólo sale con el flag clínico', () => {
    expect(accionesDisponibles({ senales: ['barrera:incontinencia-leve'] }).map((a) => a.codigo)).not.toContain('A02');
    const conFlag = accionesDisponibles({ flags: ['flag:incontinencia-frecuente'] });
    expect(conFlag.map((a) => a.codigo)).toContain('A02');
    expect(buscarAccion('A02')?.derivaA).toBe('kinesiologia-pelviperineal');
  });
});

describe('mencionaDosificacionGlp1', () => {
  it('detecta un intento de indicar dosis', () => {
    expect(mencionaDosificacionGlp1('Subí la semaglutida a 1 mg por semana.')).toBe(true);
    expect(mencionaDosificacionGlp1('Conviene suspender el Ozempic si siguen las náuseas.')).toBe(true);
    expect(mencionaDosificacionGlp1('Titular tirzepatida según tolerancia')).toBe(true);
  });

  it('no se dispara con una mención descriptiva sin dosificación', () => {
    expect(mencionaDosificacionGlp1('Estas comidas ayudan con las náuseas del GLP-1.')).toBe(false);
    expect(mencionaDosificacionGlp1('Caminar después de comer mejora la glucemia.')).toBe(false);
  });

  it('ignora tildes y mayúsculas', () => {
    expect(mencionaDosificacionGlp1('AUMENTÁ LA DOSIS DE SEMAGLUTIDA')).toBe(true);
  });
});

describe('escalera de niveles', () => {
  it('nombra 4 niveles y sólo habilita los que tienen puertas definidas', () => {
    expect(NIVELES).toHaveLength(4);
    expect(nivelesHabilitables().map((n) => n.id)).toEqual([1, 2]);
  });

  it('bloquea los niveles 3 y 4 hasta que el médico defina sus puertas de seguridad', () => {
    for (const id of [3, 4] as const) {
      const estado = estadoNivel(id);
      expect(estado.habilitado).toBe(false);
      expect(estado.motivo).toMatch(/puertas de seguridad/i);
    }
  });

  it('el nivel 1 se habilita recién con la consulta inicial y el baseline', () => {
    expect(estadoNivel(1).habilitado).toBe(false);
    expect(estadoNivel(1, ['Consulta inicial con cardiólogo']).requisitosPendientes).toEqual([
      'Cuestionario baseline completo',
    ]);
    expect(estadoNivel(1, ['Consulta inicial con cardiólogo', 'Cuestionario baseline completo']).habilitado).toBe(true);
  });

  it('los objetivos del nivel son tipos, no promesas numéricas', () => {
    // Las cifras (8 kg, 6 kg…) las fija el médico en cada Goal, por paciente.
    for (const nivel of NIVELES) {
      for (const objetivo of nivel.ejemplosDeObjetivo) {
        expect(objetivo).not.toMatch(/\d+\s*(kg|kilos|cm)\b/i);
      }
    }
  });
});
