import { LIMITE_L_POR_HORA, leituraPossivel, litrosPorHora } from './relatorios.service.js';

const dia = (horas: number, combustivelL: number) => ({ horas, areaHa: 10, combustivelL, paradoMin: 0 });

describe('leituraPossivel (combustível impossível vira "sem leitura")', () => {
  it('mantém um consumo normal (24 L/h)', () => {
    expect(leituraPossivel(dia(10, 240)).combustivelL).toBe(240);
  });

  it('mantém o limite exato', () => {
    expect(leituraPossivel(dia(10, 10 * LIMITE_L_POR_HORA)).combustivelL).toBe(900);
  });

  it('zera quando passa do limite (105 L/h)', () => {
    expect(leituraPossivel(dia(2, 210)).combustivelL).toBe(0);
  });

  it('zera combustível sem nenhuma hora de motor', () => {
    expect(leituraPossivel(dia(0, 50)).combustivelL).toBe(0);
  });

  it('não mexe em quem não tem combustível', () => {
    expect(leituraPossivel(dia(5, 0))).toEqual(dia(5, 0));
  });

  it('com as horas de motor da mesma leitura, a trava usa elas e não as horas do rastro', () => {
    // O rastro diz 0 h, mas a ISO diz 10 h de motor para 240 L: 24 L/h, normal.
    const par = { ...dia(0, 240), combustivelComHorasL: 240, horasMotorLeitura: 10 };
    expect(leituraPossivel(par).combustivelL).toBe(240);
    // 210 L em 2 h de motor da ISO: 105 L/h, impossível.
    expect(leituraPossivel({ ...dia(10, 210), combustivelComHorasL: 210, horasMotorLeitura: 2 }).combustivelL).toBe(0);
  });

  it('L/h sai só do par litro+horas da ISO: 222 L em 10 h = 22,2 L/h', () => {
    expect(litrosPorHora({ ...dia(14, 222), combustivelComHorasL: 222, horasMotorLeitura: 10 })).toBe(22.2);
  });

  it('sem o par da ISO não há L/h, mesmo com horas do rastro', () => {
    expect(litrosPorHora(dia(10, 240))).toBeNull();
  });

  it('litro que conta só a partir de uma hora não gera L/h (as horas do dia incluem o que ficou de fora)', () => {
    expect(litrosPorHora({ ...dia(10, 50), combustivelComHorasL: 50, horasMotorLeitura: 2, combustivelDesde: '07:46' })).toBeNull();
  });

  it('litro estimado que cai na trava perde a marca de estimado', () => {
    expect(leituraPossivel({ ...dia(2, 210), combustivelEstimado: true })).toMatchObject({ combustivelL: 0, combustivelEstimado: false });
    expect(leituraPossivel({ ...dia(10, 240), combustivelEstimado: true }).combustivelEstimado).toBe(true);
  });
});
