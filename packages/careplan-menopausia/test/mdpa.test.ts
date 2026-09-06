import { describe, expect, it } from 'vitest';
import {
  MDPA_DIAS_DE_SERIE,
  MDPA_PASOS_MEDICION,
  MDPA_TOMAS_POR_DIA,
  controlesPorDia,
  evaluarMdpa,
  mensajeParaPaciente,
  type TomaPresion,
} from '../src/index.js';

function fecha(dia: number): string {
  return `2026-03-${String(dia).padStart(2, '0')}`;
}

/** Un día de protocolo: 3 tomas a la mañana. */
function dia(d: number, valores: [number, number][]): TomaPresion[] {
  return valores.map(([sistolica, diastolica], i) => ({
    fecha: fecha(d),
    orden: i + 1,
    sistolica,
    diastolica,
  }));
}

/** Serie de `dias` días donde la 1.ª toma es alta y las 2 válidas son estables. */
function serie(dias: number, sistolica: number, diastolica: number, primera = 150): TomaPresion[] {
  const tomas: TomaPresion[] = [];
  for (let d = 1; d <= dias; d++) {
    tomas.push(...dia(d, [[primera, 95], [sistolica, diastolica], [sistolica, diastolica]]));
  }
  return tomas;
}

describe('controlesPorDia', () => {
  it('descarta la primera toma y promedia las dos siguientes', () => {
    const [control] = controlesPorDia(dia(1, [[150, 95], [128, 80], [124, 78]]));
    expect(control.promedio).toEqual({ sistolica: 126, diastolica: 79 });
    expect(control.tomasValidas).toBe(2);
    expect(control.completo).toBe(true);
  });

  it('descarta por orden, no por el orden en que llegan las tomas', () => {
    // Mismas tomas, desordenadas: el resultado no cambia.
    const desordenadas = [...dia(1, [[150, 95], [128, 80], [124, 78]])].reverse();
    expect(controlesPorDia(desordenadas)[0].promedio).toEqual({ sistolica: 126, diastolica: 79 });
  });

  it('un día con menos de 3 tomas no está completo, pero igual se calcula', () => {
    const [control] = controlesPorDia(dia(1, [[150, 95], [130, 82]]));
    expect(control.completo).toBe(false);
    expect(control.tomasValidas).toBe(1);
    expect(control.promedio).toEqual({ sistolica: 130, diastolica: 82 });
  });

  it('un día con una sola toma queda sin control: era la que se descarta', () => {
    const [control] = controlesPorDia(dia(1, [[150, 95]]));
    expect(control.promedio).toBeUndefined();
    expect(control.tomasValidas).toBe(0);
  });

  it('devuelve los días ordenados por fecha', () => {
    const tomas = [...dia(3, [[150, 95], [120, 78], [120, 78]]), ...dia(1, [[150, 95], [122, 76], [122, 76]])];
    expect(controlesPorDia(tomas).map((d) => d.fecha)).toEqual([fecha(1), fecha(3)]);
  });
});

describe('evaluarMdpa', () => {
  it('la primera toma alta no arrastra la serie', () => {
    // 150/95 todos los días como primera toma: si contara, daría revisión.
    const r = evaluarMdpa(serie(7, 122, 76));
    expect(r.aviso).toBe('ok');
    expect(r.promedio).toEqual({ sistolica: 122, diastolica: 76 });
    expect(r.serieCompleta).toBe(true);
    expect(r.enObjetivoClinico).toBe(true);
    expect(r.diasCompletos).toBe(7);
  });

  it('reconoce el rango ideal (< 120/80)', () => {
    expect(evaluarMdpa(serie(7, 116, 74)).enObjetivoIdeal).toBe(true);
  });

  it('un promedio de serie ≥ 135/85 pide revisión', () => {
    const r = evaluarMdpa(serie(7, 136, 84));
    expect(r.aviso).toBe('revision');
    expect(r.motivos[0]).toMatch(/Promedio de la serie/);
  });

  it('alcanza con que suba la diastólica', () => {
    expect(evaluarMdpa(serie(7, 128, 86)).aviso).toBe('revision');
  });

  it('dos días con control ≥ 140/90 piden revisión aunque el promedio esté en objetivo', () => {
    const tomas = [
      ...dia(1, [[150, 95], [144, 88], [142, 88]]),
      ...dia(2, [[150, 95], [141, 92], [143, 90]]),
      ...dia(3, [[150, 95], [110, 68], [108, 66]]),
      ...dia(4, [[150, 95], [108, 66], [106, 64]]),
      ...dia(5, [[150, 95], [110, 68], [110, 66]]),
      ...dia(6, [[150, 95], [108, 68], [108, 66]]),
      ...dia(7, [[150, 95], [110, 70], [108, 68]]),
    ];
    const r = evaluarMdpa(tomas);
    expect(r.aviso).toBe('revision');
    expect(r.motivos.join(' ')).toMatch(/2 días con control/);
    expect(r.promedio!.sistolica).toBeLessThan(130); // el promedio solo no lo habría detectado
  });

  it('un solo día alto no alcanza para el aviso', () => {
    const tomas = [...serie(6, 112, 70), ...dia(7, [[150, 95], [144, 88], [142, 88]])];
    expect(evaluarMdpa(tomas).aviso).toBe('ok');
  });

  it('una toma de 180/110 dispara contacto urgente', () => {
    const tomas = [...serie(6, 118, 74), ...dia(7, [[130, 82], [182, 104], [140, 88]])];
    const r = evaluarMdpa(tomas);
    expect(r.aviso).toBe('urgente');
    expect(r.motivos[0]).toMatch(/urgencia/);
  });

  it('lo urgente cuenta aunque haya salido en la toma descartada', () => {
    // La primera se descarta para el promedio, pero 195/118 no se ignora.
    const tomas = [...serie(6, 118, 74), ...dia(7, [[195, 118], [120, 76], [118, 74]])];
    const r = evaluarMdpa(tomas);
    expect(r.aviso).toBe('urgente');
    expect(r.motivos[0]).toContain(fecha(7));
  });

  it('lo urgente gana sobre lo que sólo pide revisión', () => {
    const tomas = [...serie(6, 138, 88), ...dia(7, [[150, 95], [190, 112], [140, 90]])];
    expect(evaluarMdpa(tomas).aviso).toBe('urgente');
  });

  it('sin tomas no inventa un promedio', () => {
    const r = evaluarMdpa([]);
    expect(r.promedio).toBeUndefined();
    expect(r.aviso).toBe('ok');
    expect(r.dias).toEqual([]);
    expect(r.enObjetivoClinico).toBe(false);
  });
});

describe('mensajeParaPaciente', () => {
  it('nunca le da a la paciente el escalón de alarma', () => {
    const tomas = [...serie(6, 138, 88), ...dia(7, [[150, 95], [190, 112], [140, 90]])];
    const texto = mensajeParaPaciente(evaluarMdpa(tomas));
    expect(texto).not.toMatch(/urgen|alarma|hipertens|riesgo/i);
    expect(texto).toMatch(/tu control/i);
  });

  it('felicita cuando está en objetivo', () => {
    expect(mensajeParaPaciente(evaluarMdpa(serie(7, 116, 74)))).toMatch(/ideal/i);
    expect(mensajeParaPaciente(evaluarMdpa(serie(7, 126, 78)))).toMatch(/objetivo/i);
  });

  it('con la serie a medias dice cuántos días faltan', () => {
    expect(mensajeParaPaciente(evaluarMdpa(serie(6, 120, 76)))).toMatch(/Falta 1 día/);
    expect(mensajeParaPaciente(evaluarMdpa(serie(5, 120, 76)))).toMatch(/Faltan 2 días/);
  });

  it('sin tomas explica el protocolo: días, mañana y cuántas tomas', () => {
    const texto = mensajeParaPaciente(evaluarMdpa([]));
    expect(texto).toContain(String(MDPA_DIAS_DE_SERIE));
    expect(texto).toContain(String(MDPA_TOMAS_POR_DIA));
    expect(texto).toMatch(/mañana/);
  });
});

describe('MDPA_PASOS_MEDICION', () => {
  it('son 8 pasos numerados en orden', () => {
    expect(MDPA_PASOS_MEDICION).toHaveLength(8);
    expect(MDPA_PASOS_MEDICION.map((p) => p.orden)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('el último paso explica la regla de las 3 tomas y el descarte', () => {
    const ultimo = MDPA_PASOS_MEDICION[7];
    expect(ultimo.titulo).toContain(String(MDPA_TOMAS_POR_DIA));
    expect(ultimo.detalle).toMatch(/primera no cuenta/i);
  });
});
