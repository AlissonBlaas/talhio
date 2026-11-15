import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeereProvedor, lerAnaliseDaMaquina, nomeEmPortugues, type ProvedorMaquinas } from '@talhio/deere';
import type { AnaliseDaMaquina } from '@talhio/shared';
import { AnaliseDaMaquinaSchema } from '@talhio/shared';
import { MaquinasService } from './maquinas.service.js';

type Def = Record<string, unknown>;
const estados = [
  { description: 'Idle', sequenceNumber: '0', minimumValue: -1 },
  { description: 'Working', sequenceNumber: '1', minimumValue: 0 },
  { description: 'Transport', sequenceNumber: '2', minimumValue: 1 },
];
const medicao = (definicao: Def, baldes: { value: number; sequenceNumber: string }[]) => ({
  machineMeasurementDefinition: { uiVisibleIndicator: 'Y', ...definicao },
  series: { level: 'aggregated', intervals: [{ buckets: { buckets: baldes } }] },
});
/** Um pedaço da resposta real da 8270R - 29: valor simples, vetor por estado, vetor de um balde só, uma escondida e uma com nome desconhecido. */
const resposta = {
  values: [
    medicao({ id: 'a', name: 'Fuel Tank Level', unitOfMeasure: 'prcnt', measurementType: { value: 'SingleValue' }, aggregationType: { value: 'LAST' }, axesGroup: { value: 'Fuel Information', priority: 3 } }, [{ value: 82.8, sequenceNumber: '0' }]),
    medicao({ id: 'b', name: 'Machine Utilization', unitOfMeasure: 'sec', measurementType: { value: 'Vector' }, aggregationType: { value: 'SUM' }, axesGroup: { value: 'Machine Utilization by Machine State', priority: 1 }, bucketDefinitions: { bucketDefinitions: estados } }, [
      { value: 0, sequenceNumber: '2' },
      { value: 10692, sequenceNumber: '0' },
      { value: 47232, sequenceNumber: '1' },
    ]),
    medicao({ id: 'c', name: 'Fuel Consumed', unitOfMeasure: 'l sec/hr', measurementType: { value: 'Vector' }, aggregationType: { value: 'SUM' }, axesGroup: { value: 'Machine Utilization by Machine State', priority: 1 }, bucketDefinitions: { bucketDefinitions: estados } }, [
      { value: 37188, sequenceNumber: '0' },
      { value: 1249776, sequenceNumber: '1' },
    ]),
    medicao({ id: 'd', name: 'Period Fuel Consumed', unitOfMeasure: 'l sec/hr', measurementType: { value: 'Vector' }, aggregationType: { value: 'SUM' }, axesGroup: { value: 'Fuel Information', priority: 3 }, bucketDefinitions: { bucketDefinitions: [{ description: 'Period Fuel Consumed', sequenceNumber: '0', minimumValue: 0 }] } }, [{ value: 1286962.029, sequenceNumber: '0' }]),
    medicao({ id: 'e', name: 'SCV2 Extend Flow', unitOfMeasure: '', measurementType: { value: 'SingleValue' }, aggregationType: { value: 'LAST' }, axesGroup: { value: 'SCV Settings (251=Continuous)', priority: 5 } }, [{ value: 7.1, sequenceNumber: '0' }]),
    medicao({ id: 'f', name: 'Max Coolant Temp', unitOfMeasure: 'C', measurementType: { value: 'SingleValue' }, aggregationType: { value: 'MAX' }, axesGroup: { value: 'Temperatures', priority: 4 } }, [{ value: 95, sequenceNumber: '0' }]),
    medicao({ id: 'g', name: 'CalData1NCD7Trans', unitOfMeasure: '', measurementType: { value: 'SingleValue' }, aggregationType: { value: 'LAST' }, axesGroup: { value: 'OpsCenterExcluded', priority: 9 } }, [{ value: 3, sequenceNumber: '0' }]),
    medicao({ id: 'h', name: 'Nova Medição Da Deere', unitOfMeasure: 'kPa', measurementType: { value: 'SingleValue' }, aggregationType: { value: 'MAX' }, axesGroup: { value: 'Grupo Novo', priority: 6 } }, [{ value: 150.5, sequenceNumber: '0' }]),
    // Sem nenhum balde: a máquina não reportou essa medição no período.
    { machineMeasurementDefinition: { id: 'i', name: 'Avg System Voltage', unitOfMeasure: 'V', uiVisibleIndicator: 'Y', measurementType: { value: 'SingleValue' }, axesGroup: { value: 'NoAxesGroup' } }, series: { intervals: [] } },
  ],
};

describe('lerAnaliseDaMaquina', () => {
  const analise = lerAnaliseDaMaquina('1439669', '2026-11-12', '2026-11-12', resposta);
  const item = (grupo: string, nome: string) => analise.grupos.find((g) => g.nome === grupo)?.itens.find((i) => i.nome === nome);

  it('agrupa como o Operations Center, na ordem de prioridade, e traduz grupos e nomes', () => {
    expect(analise.grupos.map((g) => g.nome)).toEqual(['Uso da máquina por estado', 'Combustível', 'Temperaturas', 'Válvulas hidráulicas (SCV)', 'Grupo Novo']);
    expect(item('Combustível', 'Nível do tanque de combustível')).toMatchObject({ tipo: 'valor', valor: 82.8, unidade: '%', agregacao: 'ultimo' });
  });

  it('segundos viram horas e litros·s/h viram litros, por estado, na ordem do ocioso para o transporte', () => {
    expect(item('Uso da máquina por estado', 'Utilização da máquina')).toMatchObject({
      tipo: 'faixas',
      unidade: 'h',
      agregacao: 'soma',
      faixas: [
        { rotulo: 'Ocioso', valor: 2.97 },
        { rotulo: 'Em operação', valor: 13.12 },
        { rotulo: 'Transporte', valor: 0 },
      ],
    });
    expect(item('Uso da máquina por estado', 'Combustível consumido')?.faixas).toEqual([
      { rotulo: 'Ocioso', valor: 10.33 },
      { rotulo: 'Em operação', valor: 347.16 },
    ]);
  });

  it('vetor de um balde só vira valor simples', () => {
    expect(item('Combustível', 'Combustível consumido no período')).toMatchObject({ tipo: 'valor', valor: 357.49, unidade: 'L', faixas: [] });
  });

  it('padrão das válvulas hidráulicas e unidades de temperatura', () => {
    expect(item('Válvulas hidráulicas (SCV)', 'Fluxo de extensão da SCV2')).toMatchObject({ valor: 7.1, unidade: '' });
    expect(item('Temperaturas', 'Temp. máxima do líquido de arrefecimento')).toMatchObject({ valor: 95, unidade: '°C', agregacao: 'maximo' });
    expect(nomeEmPortugues('SCV5 Detent Time')).toBe('Tempo de retenção da SCV5');
    expect(nomeEmPortugues(' Rear PTO ')).toBe('TDP traseira');
  });

  it('medição escondida pelo Operations Center e medição sem balde não entram; nome desconhecido sai como a Deere manda', () => {
    expect(analise.grupos.flatMap((g) => g.itens).some((i) => i.nome === 'CalData1NCD7Trans')).toBe(false);
    expect(analise.grupos.some((g) => g.id === 'OpsCenterExcluded' || g.id === 'NoAxesGroup')).toBe(false);
    expect(item('Grupo Novo', 'Nova Medição Da Deere')).toMatchObject({ valor: 150.5, unidade: 'kPa' });
  });

  it('respeita o contrato compartilhado e responde vazio a lixo', () => {
    expect(AnaliseDaMaquinaSchema.parse(analise)).toEqual(analise);
    expect(lerAnaliseDaMaquina('1', 'a', 'b', null).grupos).toEqual([]);
    expect(lerAnaliseDaMaquina('1', 'a', 'b', { values: [] }).grupos).toEqual([]);
  });
});

describe('DeereProvedor.analiseDaMaquina', () => {
  it('pede o período inteiro agregado, em datas locais com utcOffSet=-03, sem paginar, e guarda 1 min', async () => {
    const chamadas: { url: string; headers: Record<string, string> }[] = [];
    const http = (async (url: string, init?: RequestInit) => {
      chamadas.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
      return new Response(JSON.stringify(resposta), { status: 200 });
    }) as unknown as typeof fetch;
    const p = new DeereProvedor({ clientId: 'a', clientSecret: 'b', baseUrl: 'https://sandboxapi.deere.com/platform', obterToken: async () => 'tok', obterOrganizacao: async () => '111', http, esperar: async () => undefined });
    const a = await p.analiseDaMaquina('org', '1439669', '2026-11-12', '2026-11-12');
    await p.analiseDaMaquina('org', '1439669', '2026-11-12', '2026-11-12');
    expect(a.grupos.length).toBeGreaterThan(0);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]!.url).toContain('/machines/1439669/machineMeasurements?embed=measurementDefinition&startDate=2026-11-12T00:00:00.000&endDate=2026-11-12T23:59:59.999&utcOffSet=-03&interval=aggregated');
    expect(chamadas[0]!.headers['x-deere-no-paging']).toBe('true');
    await expect(p.analiseDaMaquina('org', '1', '2026-01-01', '2026-03-01')).rejects.toThrow(/1 a 30 dias/);
  });
});

describe('MaquinasService.analise', () => {
  const agora = new Date('2026-11-13T15:00:00Z'); // 13/11 12:00 em Brasília
  function servico(provedorExtra: Partial<ProvedorMaquinas> = {}) {
    const pedidos: unknown[][] = [];
    const provedor = {
      listarMaquinas: async () => [{ id: '7', nome: '8270R - 29', tipo: 'trator', numeroSerie: 'X', telemetriaAtiva: true }],
      ultimaPosicao: async () => null,
      listarTalhoes: async () => [],
      medicoes: async () => ({}),
      analiseDaMaquina: async (...args: unknown[]) => (pedidos.push(args), { maquinaId: '7', de: String(args[2]), ate: String(args[3]), grupos: [] }) as AnaliseDaMaquina,
      ...provedorExtra,
    } as unknown as ProvedorMaquinas;
    const talhoes = { listar: async () => [] } as never;
    const escalas = { buscarDia: async () => null, listar: async () => [] } as never;
    const larguras = { todas: async () => new Map(), buscar: async () => null } as never;
    return { s: new MaquinasService(provedor, talhoes, escalas, larguras), pedidos };
  }

  it('sem datas pede hoje; com datas pede o período', async () => {
    const { s, pedidos } = servico();
    await s.analise('org', '7', undefined, undefined, agora);
    await s.analise('org', '7', '2026-11-07', '2026-11-13', agora);
    expect(pedidos).toEqual([
      ['org', '7', '2026-11-13', '2026-11-13'],
      ['org', '7', '2026-11-07', '2026-11-13'],
    ]);
  });

  it('só de máquina da fazenda, e recusa período invertido, no futuro ou maior que 30 dias', async () => {
    const { s } = servico();
    await expect(s.analise('org', '99', undefined, undefined, agora)).rejects.toBeInstanceOf(NotFoundException);
    await expect(s.analise('org', '7', '2026-11-10', '2026-11-05', agora)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.analise('org', '7', '2026-11-12', '2026-11-20', agora)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.analise('org', '7', '2026-10-01', '2026-11-13', agora)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('provedor sem essa leitura (demonstração) devolve a lista vazia, não erro', async () => {
    const { s } = servico({ analiseDaMaquina: undefined });
    expect(await s.analise('org', '7', undefined, undefined, agora)).toEqual({ maquinaId: '7', de: '2026-11-13', ate: '2026-11-13', grupos: [] });
  });
});
