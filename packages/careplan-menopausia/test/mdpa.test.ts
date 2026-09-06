import { describe, expect, it } from 'vitest';
import { MDPA_DIAS_DE_SERIE, evaluarMdpa, mensajeParaPaciente, type TomaPresion } from '../src/index.js';

/** Serie de `dias` días con dos tomas diarias del mismo valor. */
function serie(dias: number, sistolica: number, diastolica: number): TomaPresion[] {
  const tomas: TomaPresion[] = [];
  for (let d = 1; d <= dias; d++) {
    const fecha = `2026-03-${String(d).padStart(2, '0')}`;
    tomas.push({ fecha, momento: 'manana', sistolica, diastolica });
    tomas.push({ fecha, momento: 'noche', sistolica, diastolica });
  }
  return tomas;
}

describe('evaluarMdpa', () => {
  it('una semana en objetivo no genera aviso', () => {
    const r = evaluarMdpa(serie(7, 124, 76));
    expect(r.aviso).toBe('ok');
    expect(r.motivos).toEqual([]);
    expect(r.promedio).toEqual({ sistolica: 124, diastolica: 76 });
    expect(r.serieCompleta).toBe(true);
    expect(r.enObjetivoClinico).toBe(true);
    expect(r.enObjetivoIdeal).toBe(false); // 124 ≥ 120
  });

  it('reconoce el rango ideal (< 120/80)', () => {
    expect(evaluarMdpa(serie(7, 118, 74)).enObjetivoIdeal).toBe(true);
  });

  it('un promedio de 135/85 pide revisión', () => {
    const r = evaluarMdpa(serie(7, 136, 84));
    expect(r.aviso).toBe('revision');
    expect(r.motivos[0]).toMatch(/Promedio/);
    expect(r.enObjetivoClinico).toBe(false);
  });

  it('alcanza con que suba la diastólica: 128/86 también pide revisión', () => {
    // El umbral es por componente, no por promedio de ambos.
    expect(evaluarMdpa(serie(7, 128, 86)).aviso).toBe('revision');
  });

  it('dos tomas de 140/90 piden revisión aunque el promedio esté en objetivo', () => {
    const tomas = [...serie(7, 118, 72)];
    tomas[0] = { ...tomas[0], sistolica: 142, diastolica: 88 };
    tomas[3] = { ...tomas[3], sistolica: 141, diastolica: 89 };
    const r = evaluarMdpa(tomas);
    expect(r.aviso).toBe('revision');
    expect(r.motivos.join(' ')).toMatch(/2 tomas/);
    // El promedio sigue siendo bueno: por eso hace falta la regla por toma.
    expect(r.promedio!.sistolica).toBeLessThan(130);
  });

  it('una sola toma de 140/90 no alcanza para el aviso', () => {
    const tomas = [...serie(7, 118, 72)];
    tomas[0] = { ...tomas[0], sistolica: 142, diastolica: 88 };
    expect(evaluarMdpa(tomas).aviso).toBe('ok');
  });

  it('una sola toma de 180/110 dispara contacto urgente', () => {
    const tomas = [...serie(7, 118, 72)];
    tomas[5] = { ...tomas[5], sistolica: 182, diastolica: 104 };
    const r = evaluarMdpa(tomas);
    expect(r.aviso).toBe('urgente');
    expect(r.motivos[0]).toMatch(/urgencia/);
  });

  it('lo urgente gana sobre lo que sólo pide revisión', () => {
    const tomas = [...serie(7, 138, 88)];
    tomas[0] = { ...tomas[0], sistolica: 190, diastolica: 112 };
    expect(evaluarMdpa(tomas).aviso).toBe('urgente');
  });

  it('cuenta días completos: sólo los que tienen mañana y noche', () => {
    const tomas: TomaPresion[] = [
      { fecha: '2026-03-01', momento: 'manana', sistolica: 120, diastolica: 78 },
      { fecha: '2026-03-01', momento: 'noche', sistolica: 122, diastolica: 76 },
      { fecha: '2026-03-02', momento: 'manana', sistolica: 121, diastolica: 77 },
    ];
    const r = evaluarMdpa(tomas);
    expect(r.diasCompletos).toBe(1);
    expect(r.totalTomas).toBe(3);
    expect(r.serieCompleta).toBe(false);
  });

  it('una serie incompleta todavía se evalúa (no se calla un valor urgente)', () => {
    const r = evaluarMdpa([{ fecha: '2026-03-01', momento: 'manana', sistolica: 195, diastolica: 118 }]);
    expect(r.serieCompleta).toBe(false);
    expect(r.aviso).toBe('urgente');
  });

  it('sin tomas no inventa un promedio', () => {
    const r = evaluarMdpa([]);
    expect(r.promedio).toBeUndefined();
    expect(r.aviso).toBe('ok');
    expect(r.enObjetivoClinico).toBe(false);
  });
});

describe('mensajeParaPaciente', () => {
  it('nunca le da a la paciente el escalón de alarma', () => {
    const tomas = [...serie(7, 138, 88)];
    tomas[0] = { ...tomas[0], sistolica: 190, diastolica: 112 };
    const texto = mensajeParaPaciente(evaluarMdpa(tomas));
    expect(texto).not.toMatch(/urgen|alarma|hipertens|riesgo/i);
    expect(texto).toMatch(/tu control/i);
  });

  it('felicita cuando está en objetivo', () => {
    expect(mensajeParaPaciente(evaluarMdpa(serie(7, 118, 74)))).toMatch(/ideal/i);
    expect(mensajeParaPaciente(evaluarMdpa(serie(7, 126, 78)))).toMatch(/objetivo/i);
  });

  it('con la serie a medias dice cuántos días faltan', () => {
    expect(mensajeParaPaciente(evaluarMdpa(serie(6, 120, 76)))).toMatch(/Falta 1 día/);
    expect(mensajeParaPaciente(evaluarMdpa(serie(5, 120, 76)))).toMatch(/Faltan 2 días/);
  });

  it('sin tomas explica el protocolo', () => {
    expect(mensajeParaPaciente(evaluarMdpa([]))).toContain(String(MDPA_DIAS_DE_SERIE));
  });
});
