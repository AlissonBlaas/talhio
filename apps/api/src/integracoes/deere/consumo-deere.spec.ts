import { DeereProvedor, acharIdsDeMedicao, lerConsumoDiario, type ConsumoDoDia, type ProvedorMaquinas } from '@talhio/deere';
import { criarBancoDeTeste } from '../../banco/banco-de-teste.js';
import { combustivelImportado, organizacoes } from '../../banco/schema.js';
import type { Config } from '../../core/config.js';
import { CombustivelAcumuladoRepository } from './combustivel-acumulado.repository.js';
import { ConsumoDeereRepository } from './consumo-deere.repository.js';
import { ConsumoDeereService, PASSADO_QUE_FALTA } from './consumo-deere.service.js';

const ID_COMBUSTIVEL = '254FA2D2-D79D-94C5-9B66-6A602648C98C';
const ID_UTILIZACAO = '21FDC863-B93D-9ED2-29C7-97E483877741';

const estados = [
  { description: 'Idle', sequenceNumber: '0' },
  { description: 'Working', sequenceNumber: '1' },
  { description: 'Transport', sequenceNumber: '2' },
];
type Dia = { inicio: string; ocioso: number; trabalhando: number; transporte?: number };
const baldes = (d: Dia, escala: number) => ({
  buckets: {
    buckets: [
      { value: d.transporte ?? 0, sequenceNumber: '2' },
      { value: d.ocioso * escala, sequenceNumber: '0' },
      { value: d.trabalhando * escala, sequenceNumber: '1' },
    ],
  },
});
/** Resposta no formato real da Deere: combustível em `l sec/hr` (litros x 3600) e utilização em `sec` (horas x 3600). */
function resposta(litros: Dia[], horas: Dia[], opcoes: { nivel?: string; unidadeCombustivel?: string } = {}) {
  const nivel = opcoes.nivel ?? 'daily';
  return {
    total: 2,
    values: [
      {
        machineMeasurementDefinition: { id: ID_COMBUSTIVEL, name: 'Fuel Consumed', unitOfMeasure: opcoes.unidadeCombustivel ?? 'l sec/hr', bucketDefinitions: { bucketDefinitions: estados } },
        series: { level: nivel, intervals: litros.map((d) => ({ intervalStartDate: d.inicio, ...baldes(d, 3600) })) },
      },
      {
        machineMeasurementDefinition: { id: ID_UTILIZACAO, name: 'Machine Utilization ', unitOfMeasure: 'sec', bucketDefinitions: { bucketDefinitions: estados } },
        series: { level: nivel, intervals: horas.map((d) => ({ intervalStartDate: d.inicio, ...baldes(d, 3600) })) },
      },
      { machineMeasurementDefinition: { id: 'x', name: 'Avg Engine Load Factor', unitOfMeasure: 'prcnt' }, series: { level: nivel, intervals: [] } },
    ],
  };
}
// 12/11 da 8270R - 29, como no Operations Center: 357,49 L (347,16 trabalhando, 10,33 ocioso) e 16,09 h (13,12 + 2,97).
const L12 = { inicio: '2026-11-12T03:00:00.000Z', ocioso: 10.33, trabalhando: 347.16 };
const H12 = { inicio: '2026-11-12T03:00:00.000Z', ocioso: 2.97, trabalhando: 13.12 };
const L06 = { inicio: '2026-11-06T03:00:00.000Z', ocioso: 6.89, trabalhando: 428.51 };
const H06 = { inicio: '2026-11-06T03:00:00.000Z', ocioso: 0.9, trabalhando: 15.67 };

describe('lerConsumoDiario (Machine Measurements)', () => {
  it('converte litros·s/h e segundos, por estado, e põe cada balde no dia de Brasília', () => {
    const dias = lerConsumoDiario(resposta([L06, L12], [H06, H12]));
    expect(dias.map((d) => d.dia)).toEqual(['2026-11-06', '2026-11-12']);
    expect(dias[1]).toEqual({
      dia: '2026-11-12',
      litros: 357.49,
      litrosTrabalhando: 347.16,
      litrosOcioso: 10.33,
      litrosTransporte: 0,
      horasMotor: 16.09,
      horasTrabalhando: 13.12,
      horasOcioso: 2.97,
      horasTransporte: 0,
    });
    expect(dias[0]!.litros).toBe(435.4);
  });

  it('dia sem balde, ou sem nada medido, não aparece (não é zero litro)', () => {
    const vazio = { inicio: '2026-11-08T03:00:00.000Z', ocioso: 0, trabalhando: 0 };
    expect(lerConsumoDiario(resposta([vazio, L12], [vazio, H12])).map((d) => d.dia)).toEqual(['2026-11-12']);
  });

  it('não confia se a unidade, o nível ou as medições não são os esperados', () => {
    expect(lerConsumoDiario(resposta([L12], [H12], { unidadeCombustivel: 'gal' }))).toEqual([]);
    expect(lerConsumoDiario(resposta([L12], [H12], { nivel: 'weekly' }))).toEqual([]);
    expect(lerConsumoDiario({ values: [] })).toEqual([]);
    expect(lerConsumoDiario(null)).toEqual([]);
  });

  it('descobre os ids das medições pelo nome', () => {
    expect(acharIdsDeMedicao(resposta([L12], [H12]))).toEqual({ combustivel: ID_COMBUSTIVEL, utilizacao: ID_UTILIZACAO });
    expect(acharIdsDeMedicao({ values: [] })).toEqual({ combustivel: null, utilizacao: null });
  });
});

describe('DeereProvedor.consumoDiario', () => {
  const BASE = 'https://sandboxapi.deere.com/platform';

  function provedor(chamadas: { url: string; headers: Record<string, string> }[]) {
    const http = (async (url: string, init?: RequestInit) => {
      chamadas.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
      if (url.includes('interval=aggregated')) return new Response(JSON.stringify(resposta([L12], [H12])), { status: 200 });
      return new Response(JSON.stringify(resposta([L06, L12], [H06, H12])), { status: 200 });
    }) as unknown as typeof fetch;
    return new DeereProvedor({ clientId: 'a', clientSecret: 'b', baseUrl: BASE, obterToken: async () => 'tok', obterOrganizacao: async () => '111', http, esperar: async () => undefined });
  }

  it('pede os baldes diários em datas locais com utcOffSet=-03, só com as duas medições, sem paginar', async () => {
    const chamadas: { url: string; headers: Record<string, string> }[] = [];
    const dias = await provedor(chamadas).consumoDiario('org', '1439669', '2026-11-05', '2026-11-12');
    expect(dias.map((d) => d.dia)).toEqual(['2026-11-06', '2026-11-12']);
    // 1ª chamada: descobre os ids (agregado). 2ª: o período.
    expect(chamadas).toHaveLength(2);
    expect(chamadas[0]!.url).toContain('/machines/1439669/machineMeasurements?embed=measurementDefinition');
    expect(chamadas[0]!.url).toContain('interval=aggregated');
    const url = chamadas[1]!.url;
    expect(url).toContain(`measurementDefinitionId=${ID_COMBUSTIVEL},${ID_UTILIZACAO}`);
    expect(url).toContain('startDate=2026-11-05T00:00:00.000&endDate=2026-11-12T23:59:59.999&utcOffSet=-03');
    expect(url).not.toMatch(/Date=[^&]*Z/);
    expect(chamadas[1]!.headers['x-deere-no-paging']).toBe('true');
  });

  it('guarda os ids por máquina: a segunda consulta não descobre de novo', async () => {
    const chamadas: { url: string; headers: Record<string, string> }[] = [];
    const p = provedor(chamadas);
    await p.consumoDiario('org', '1439669', '2026-11-05', '2026-11-12');
    await p.consumoDiario('org', '1439669', '2026-11-10', '2026-11-12');
    expect(chamadas.filter((c) => c.url.includes('interval=aggregated'))).toHaveLength(1);
    expect(chamadas).toHaveLength(3);
  });

  it('um dia só começa um dia antes (a Deere só dá baldes diários para mais de 1 dia) e devolve só o pedido', async () => {
    const chamadas: { url: string; headers: Record<string, string> }[] = [];
    const dias = await provedor(chamadas).consumoDiario('org', '1439669', '2026-11-12', '2026-11-12');
    expect(chamadas[1]!.url).toContain('startDate=2026-11-11T00:00:00.000&endDate=2026-11-12T23:59:59.999');
    expect(dias.map((d) => d.dia)).toEqual(['2026-11-12']);
  });

  it('recusa período maior que 30 dias', async () => {
    await expect(provedor([]).consumoDiario('org', '1', '2026-01-01', '2026-03-01')).rejects.toThrow(/1 a 30 dias/);
  });
});

describe('ConsumoDeereRepository', () => {
  const dia = (d: string, litros: number): ConsumoDoDia => ({ dia: d, litros, litrosTrabalhando: litros - 10, litrosOcioso: 10, litrosTransporte: 0, horasMotor: 16, horasTrabalhando: 13, horasOcioso: 3, horasTransporte: 0 });

  it('grava por fazenda, o dia mais novo substitui o antigo (inclusive o que veio do CSV) e o relatório lê dali', async () => {
    const db = await criarBancoDeTeste();
    await db.insert(organizacoes).values({ id: 'org-b', nome: 'B' });
    await db.insert(combustivelImportado).values({ orgId: 'org-demo', maquinaId: '7', dia: '2026-11-12', litros: 355, horasMotor: 16.21, fonte: 'csv' });
    const repo = new ConsumoDeereRepository(db);
    expect(await repo.guardar('org-demo', '7', [dia('2026-11-12', 357.49), dia('2026-11-13', 31.8)])).toBe(2);
    await repo.guardar('org-b', '7', [dia('2026-11-12', 1)]);
    expect(await repo.guardar('org-demo', '7', [])).toBe(0);

    const leitura = new CombustivelAcumuladoRepository(db);
    expect(await leitura.importado('org-demo', '7', '2026-11-12')).toEqual({ litros: 357.49, horasMotor: 16, horasOcioso: 3 });
    expect(await leitura.importado('org-demo', '7', '2026-11-13')).toEqual({ litros: 31.8, horasMotor: 16, horasOcioso: 3 });
    expect(await leitura.importado('org-b', '7', '2026-11-12')).toEqual({ litros: 1, horasMotor: 16, horasOcioso: 3 });
    const linha = (await db.select().from(combustivelImportado)).find((l) => l.orgId === 'org-demo' && l.dia === '2026-11-12')!;
    expect(linha).toMatchObject({ fonte: 'api', litrosTrabalhando: 347.49, litrosOcioso: 10 });
  });

  it('soma por mês e por máquina, só da fazenda pedida e a partir do dia pedido, e diz o dia mais antigo de cada máquina', async () => {
    const db = await criarBancoDeTeste();
    await db.insert(organizacoes).values({ id: 'org-b', nome: 'B' });
    const repo = new ConsumoDeereRepository(db);
    await repo.guardar('org-demo', '7', [dia('2026-09-30', 999), dia('2026-10-03', 100), dia('2026-10-20', 250), dia('2026-11-12', 357.49)]);
    await repo.guardar('org-demo', '8', [dia('2026-10-05', 40)]);
    await repo.guardar('org-b', '7', [dia('2026-10-05', 5000)]);

    const meses = await repo.porMes('org-demo', '2026-10-01');
    expect(meses.map((m) => [m.mes, m.maquinaId, m.dias, m.litros])).toEqual([
      ['2026-10', '7', 2, 350],
      ['2026-10', '8', 1, 40],
      ['2026-11', '7', 1, 357.49],
    ]);
    expect(meses[0]).toMatchObject({ horasMotor: 32, horasTrabalhando: 26, horasOcioso: 6, litrosOcioso: 20, litrosTrabalhando: 330 });
    expect(await repo.porMes('org-demo', '2027-01-01')).toEqual([]);

    expect([...(await repo.maisAntigoPorMaquina('org-demo'))]).toEqual([
      ['7', '2026-09-30'],
      ['8', '2026-10-05'],
    ]);
    expect((await repo.maisAntigoPorMaquina('org-vazia')).size).toBe(0);
  });
});

describe('ConsumoDeereService', () => {
  const config = { deereProvedor: 'deere', deereMedicoes: true, medicoesPreencherDesde: null } as unknown as Config;
  const agora = new Date('2026-11-13T15:00:00Z'); // 12:00 em Brasília

  function montar(jaGuardado: Record<string, string> = {}, falhaAntesDe?: string) {
    const pedidos: { maquina: string; ini: string; fim: string }[] = [];
    const gravados: { maquina: string; dias: number }[] = [];
    const provedor = {
      listarMaquinas: async () => [
        { id: '1', nome: 'M1' },
        { id: '2', nome: 'M2' },
      ],
      consumoDiario: async (_o: string, maquina: string, ini: string, fim: string) => {
        pedidos.push({ maquina, ini, fim });
        if (maquina === '2') throw new Error('A John Deere respondeu 500.');
        if (falhaAntesDe && fim < falhaAntesDe) throw new Error('A John Deere respondeu 400.');
        return [{ dia: fim, litros: 1, litrosTrabalhando: 1, litrosOcioso: 0, litrosTransporte: 0, horasMotor: 1, horasTrabalhando: 1, horasOcioso: 0, horasTransporte: 0 }] as ConsumoDoDia[];
      },
    } as unknown as ProvedorMaquinas;
    const repo = {
      guardar: async (_o: string, maquina: string, dias: ConsumoDoDia[]) => (gravados.push({ maquina, dias: dias.length }), dias.length),
      maisAntigoPorMaquina: async () => new Map(Object.entries(jaGuardado)),
    } as unknown as ConsumoDeereRepository;
    const fazendas = { fazendasProntas: async () => ['org-a'] } as never;
    return { service: new ConsumoDeereService(config, provedor, fazendas, repo), pedidos, gravados };
  }

  it('relê os últimos 3 dias de cada máquina, e uma falha não para as outras', async () => {
    const { service, pedidos, gravados } = montar();
    await service.rodar(null, agora);
    expect(pedidos).toEqual([
      { maquina: '1', ini: '2026-11-11', fim: '2026-11-13' },
      { maquina: '2', ini: '2026-11-11', fim: '2026-11-13' },
    ]);
    expect(gravados).toEqual([{ maquina: '1', dias: 1 }]);
  });

  it('preenche o passado em pedaços de até 30 dias, sem repetir dia, e termina na janela recente', async () => {
    const { service, pedidos } = montar();
    await service.rodar('2026-09-01', agora);
    const da1 = pedidos.filter((p) => p.maquina === '1');
    expect(da1[0]).toEqual({ maquina: '1', ini: '2026-09-01', fim: '2026-09-30' });
    expect(da1[1]).toEqual({ maquina: '1', ini: '2026-10-01', fim: '2026-10-30' });
    expect(da1[2]).toEqual({ maquina: '1', ini: '2026-10-31', fim: '2026-11-10' });
    expect(da1[3]).toEqual({ maquina: '1', ini: '2026-11-11', fim: '2026-11-13' });
    for (const p of da1) expect((Date.parse(p.fim) - Date.parse(p.ini)) / 86_400_000).toBeLessThanOrEqual(29);
  });

  it('sem data configurada, busca sozinho os últimos 12 meses, só das máquinas que ainda não têm esse histórico', async () => {
    // A máquina 1 só tem dias recentes guardados: busca desde o dia 1 do mês de 12 meses atrás.
    const semHistorico = montar({ '1': '2026-11-05' });
    await semHistorico.service.rodar(PASSADO_QUE_FALTA, agora);
    const da1 = semHistorico.pedidos.filter((p) => p.maquina === '1');
    expect(da1[0]).toEqual({ maquina: '1', ini: '2025-11-01', fim: '2025-11-30' });
    expect(da1.at(-1)).toEqual({ maquina: '1', ini: '2026-11-11', fim: '2026-11-13' });
    for (let i = 1; i < da1.length; i++) expect(Date.parse(da1[i]!.ini) - Date.parse(da1[i - 1]!.fim)).toBe(86_400_000);

    // Já tem o histórico (dia mais antigo perto do alvo): só relê os últimos dias.
    const comHistorico = montar({ '1': '2025-11-20' });
    await comHistorico.service.rodar(PASSADO_QUE_FALTA, agora);
    expect(comHistorico.pedidos.filter((p) => p.maquina === '1')).toEqual([{ maquina: '1', ini: '2026-11-11', fim: '2026-11-13' }]);
  }, 60_000);

  it('no modo automático, pedaço antigo que a Deere recusa não tira os dias recentes', async () => {
    const { service, pedidos, gravados } = montar({}, '2026-06-01');
    await service.rodar(PASSADO_QUE_FALTA, agora);
    const da1 = pedidos.filter((p) => p.maquina === '1');
    expect(da1.at(-1)).toEqual({ maquina: '1', ini: '2026-11-11', fim: '2026-11-13' });
    // Os pedaços que responderam foram gravados, inclusive a janela recente.
    expect(gravados.length).toBe(da1.filter((p) => p.fim >= '2026-06-01').length);
    expect(gravados.length).toBeGreaterThan(1);
  }, 60_000);

  it('não roda duas rodadas ao mesmo tempo', async () => {
    const { service, pedidos } = montar();
    await Promise.all([service.rodar(null, agora), service.rodar(null, agora)]);
    expect(pedidos.filter((p) => p.maquina === '1')).toHaveLength(1);
  });
});
