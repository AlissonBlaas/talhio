import { Test } from '@nestjs/testing';
import { LarguraImplementoRepository } from '../integracoes/deere/largura-implemento.repository.js';
import { FakeProvedor } from '@talhio/deere';
import { MaquinaSchema } from '@talhio/shared';
import { BANCO } from '../banco/banco.module.js';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { EscalaRepository } from '../escala/escala.repository.js';
import { TalhoesRepository } from '../talhoes/talhoes.repository.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';
import { calcularStatus, MaquinasService } from './maquinas.service.js';

const AGORA = new Date('2026-11-09T15:00:00.000Z');

describe('calcularStatus', () => {
  const posicao = { maquinaId: 'm', lat: 0, lng: 0, registradaEm: AGORA.toISOString(), velocidadeKmH: 7, motorLigado: true, paradaDesde: null };

  it('trabalhando: motor ligado e em movimento, com dado recente', () => {
    expect(calcularStatus({ telemetriaAtiva: true }, posicao, AGORA)).toBe('trabalhando');
  });
  it('parada: dado recente, mas sem movimento', () => {
    expect(calcularStatus({ telemetriaAtiva: true }, { ...posicao, velocidadeKmH: 0, motorLigado: false }, AGORA)).toBe('parada');
  });
  it('sem sinal: último dado há mais de 15 minutos', () => {
    const velha = { ...posicao, registradaEm: new Date(AGORA.getTime() - 16 * 60 * 1000).toISOString() };
    expect(calcularStatus({ telemetriaAtiva: true }, velha, AGORA)).toBe('sem-sinal');
  });
  it('sem sinal: máquina sem telemetria ou sem posição', () => {
    expect(calcularStatus({ telemetriaAtiva: false }, posicao, AGORA)).toBe('sem-sinal');
    expect(calcularStatus({ telemetriaAtiva: true }, null, AGORA)).toBe('sem-sinal');
  });
});

describe('MaquinasService com o provedor falso', () => {
  let service: MaquinasService;

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({
      providers: [MaquinasService, LarguraImplementoRepository, TalhoesService, TalhoesRepository, EscalaRepository, { provide: BANCO, useValue: await criarBancoDeTeste() }, { provide: PROVEDOR_MAQUINAS, useValue: new FakeProvedor(() => AGORA) }],
    }).compile();
    service = modulo.get(MaquinasService);
  });

  it('devolve máquinas no formato do contrato', async () => {
    const maquinas = await service.listar('org-demo', AGORA);
    expect(maquinas).toHaveLength(5);
    for (const m of maquinas) expect(() => MaquinaSchema.parse(m)).not.toThrow();
  });

  it('cruza a posição com o talhão e calcula o status', async () => {
    const maquinas = await service.listar('org-demo', AGORA);
    const por = (id: string) => maquinas.find((m) => m.id === id);
    expect(por('m-8r410')).toMatchObject({ status: 'trabalhando', talhaoId: 't7' });
    expect(por('m-m4040')).toMatchObject({ status: 'trabalhando', talhaoId: 't5' });
    expect(por('m-6m195')).toMatchObject({ status: 'parada', talhaoId: null, operador: 'Antônio' });
    expect(por('m-6m195')?.paradaDesde).toBe(new Date(AGORA.getTime() - 80 * 60 * 1000).toISOString());
    expect(por('m-7r330')).toMatchObject({ status: 'sem-sinal' });
  });

  it('erro 404 com código estável quando a máquina não existe', async () => {
    await expect(service.buscar('org-demo', 'nao-existe')).rejects.toMatchObject({
      response: { codigo: 'MAQUINA_NAO_ENCONTRADA' },
    });
  });
});

describe('tempoPorTalhao', () => {
  it('reparte o dia entre o talhão e fora dele, separando andando de parado', async () => {
    const { tempoPorTalhao } = await import('./maquinas.service.js');
    const quadrado = { type: 'Polygon' as const, coordinates: [[[-52, -31], [-51.99, -31], [-51.99, -30.99], [-52, -30.99], [-52, -31]] as [number, number][]] };
    const min = 60_000;
    const dentro = (t: number, kmh: number) => ({ t: t * min, lng: -51.995, lat: -30.995, kmh });
    const fora = (t: number, kmh: number) => ({ t: t * min, lng: -51.9, lat: -30.9, kmh });
    // 30 min andando dentro, 12 min parado dentro, 18 min andando fora
    const pontos = [...Array.from({ length: 10 }, (_, i) => dentro(i * 3, 6)), ...Array.from({ length: 4 }, (_, i) => dentro(30 + i * 3, 0)), ...Array.from({ length: 7 }, (_, i) => fora(42 + i * 3, 20))];
    expect(tempoPorTalhao(pontos, [{ id: 't1', nome: 'Sulco 26', contorno: quadrado }])).toEqual([
      { talhaoId: 't1', nome: 'Sulco 26', andandoH: 0.5, paradoH: 0.2 },
      { talhaoId: null, nome: 'Fora dos talhões', andandoH: 0.3, paradoH: 0 },
    ]);
  });
});
