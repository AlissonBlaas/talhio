import type { AreaDoDia, ProvedorMaquinas } from '@talhio/deere';
import { criarBancoDeTeste } from '../../banco/banco-de-teste.js';
import { organizacoes } from '../../banco/schema.js';
import type { Config } from '../../core/config.js';
import { AreaOperacoesRepository } from './area-operacoes.repository.js';
import { AreaOperacoesService, mesesAte } from './area-operacoes.service.js';

const dia = (maquinaId: string, d: string, areaHa: number, horas = 8): AreaDoDia => ({ maquinaId, dia: d, areaHa, horas });

describe('mesesAte', () => {
  it('devolve cada mês do dia 1 ao último dia, e o mês atual só até hoje', () => {
    expect(mesesAte('2026-11-16', 3)).toEqual([
      { mes: '2026-09', de: '2026-09-01', ate: '2026-09-30' },
      { mes: '2026-10', de: '2026-10-01', ate: '2026-10-31' },
      { mes: '2026-11', de: '2026-11-01', ate: '2026-11-16' },
    ]);
    // Atravessa o ano e acerta fevereiro.
    expect(mesesAte('2026-03-31', 14)[0]).toEqual({ mes: '2025-02', de: '2025-02-01', ate: '2025-02-28' });
    expect(mesesAte('2026-03-31', 2)[0]).toEqual({ mes: '2026-02', de: '2026-02-01', ate: '2026-02-28' });
  });
});

describe('AreaOperacoesRepository', () => {
  it('guarda por fazenda, troca o mês inteiro a cada leitura e o relatório lê dali', async () => {
    const db = await criarBancoDeTeste();
    await db.insert(organizacoes).values({ id: 'org-b', nome: 'B' });
    const repo = new AreaOperacoesRepository(db);
    expect(await repo.trocarPeriodo('org-demo', '2026-06-01', '2026-06-30', [dia('7', '2026-06-05', 62.5), dia('7', '2026-06-06', 30), dia('7', '2026-07-01', 99)])).toBe(2);
    await repo.trocarPeriodo('org-b', '2026-06-01', '2026-06-30', [dia('7', '2026-06-05', 1)]);
    expect(await repo.buscar('org-demo', '7', '2026-06-05')).toEqual({ areaHa: 62.5, horas: 8 });
    expect(await repo.buscar('org-b', '7', '2026-06-05')).toEqual({ areaHa: 1, horas: 8 });
    // Dia de fora do período pedido não é gravado.
    expect(await repo.buscar('org-demo', '7', '2026-07-01')).toBeNull();

    // A Deere corrigiu a operação: o dia 6 sumiu e o dia 5 mudou. Outro mês e outra fazenda não são tocados.
    await repo.trocarPeriodo('org-demo', '2026-10-01', '2026-10-31', [dia('8', '2026-10-02', 12)]);
    await repo.trocarPeriodo('org-demo', '2026-06-01', '2026-06-30', [dia('7', '2026-06-05', 60)]);
    expect(await repo.buscar('org-demo', '7', '2026-06-05')).toEqual({ areaHa: 60, horas: 8 });
    expect(await repo.buscar('org-demo', '7', '2026-06-06')).toBeNull();
    expect(await repo.buscar('org-demo', '8', '2026-10-02')).toEqual({ areaHa: 12, horas: 8 });
    expect(await repo.buscar('org-b', '7', '2026-06-05')).toEqual({ areaHa: 1, horas: 8 });
    expect([...(await repo.mesesGuardados('org-demo'))].sort()).toEqual(['2026-06', '2026-10']);
  });
});

describe('AreaOperacoesService', () => {
  const config = { deereProvedor: 'deere' } as unknown as Config;
  const agora = new Date('2026-11-16T15:00:00Z');

  function montar(jaGuardados: string[] = [], falhaEm?: string) {
    const pedidos: { de: string; ate: string }[] = [];
    const gravados: { de: string; ate: string; dias: number }[] = [];
    const provedor = {
      areaDasOperacoes: async (_o: string, de: string, ate: string) => {
        pedidos.push({ de, ate });
        if (falhaEm && de.startsWith(falhaEm)) throw new Error('A John Deere respondeu 500.');
        return [dia('7', de, 10)];
      },
    } as unknown as ProvedorMaquinas;
    const repo = {
      mesesGuardados: async () => new Set(jaGuardados),
      trocarPeriodo: async (_o: string, de: string, ate: string, dias: AreaDoDia[]) => (gravados.push({ de, ate, dias: dias.length }), dias.length),
    } as unknown as AreaOperacoesRepository;
    const fazendas = { fazendasProntas: async () => ['org-a'] } as never;
    return { service: new AreaOperacoesService(config, provedor, fazendas, repo), pedidos, gravados };
  }

  it('lê mês a mês, do dia 1 ao fim do mês, do mais antigo ao atual', async () => {
    const { service, pedidos, gravados } = montar();
    await service.rodar(4, agora);
    expect(pedidos).toEqual([
      { de: '2026-08-01', ate: '2026-08-31' },
      { de: '2026-09-01', ate: '2026-09-30' },
      { de: '2026-10-01', ate: '2026-10-31' },
      { de: '2026-11-01', ate: '2026-11-16' },
    ]);
    expect(gravados).toHaveLength(4);
  }, 30_000);

  it('mês antigo já guardado não é relido; o atual e o anterior sempre são', async () => {
    const { service, pedidos } = montar(['2026-08', '2026-10', '2026-11']);
    await service.rodar(4, agora);
    expect(pedidos.map((p) => p.de)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01']);
  }, 30_000);

  it('a falha de um mês não para os outros', async () => {
    const { service, pedidos, gravados } = montar([], '2026-09');
    await service.rodar(4, agora);
    expect(pedidos).toHaveLength(4);
    expect(gravados.map((g) => g.de)).toEqual(['2026-08-01', '2026-10-01', '2026-11-01']);
  }, 30_000);
});
