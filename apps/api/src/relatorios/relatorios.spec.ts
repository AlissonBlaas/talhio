import { Test } from '@nestjs/testing';
import { PlanosRepository } from '../planos/planos.repository.js';
import { LarguraImplementoRepository } from '../integracoes/deere/largura-implemento.repository.js';
import { FakeProvedor } from '@talhio/deere';
import { RelatorioSchema } from '@talhio/shared';
import { BANCO } from '../banco/banco.module.js';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { MaquinasService } from '../maquinas/maquinas.service.js';
import { EscalaRepository } from '../escala/escala.repository.js';
import { TalhoesRepository } from '../talhoes/talhoes.repository.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';
import { RelatoriosService } from './relatorios.service.js';
import { escreverResumo } from './resumo.js';

// Meio-dia em Brasília de 10/11/2026.
const AGORA = new Date('2026-11-10T15:00:00.000Z');

describe('RelatoriosService', () => {
  let service: RelatoriosService;
  let planos: PlanosRepository;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      providers: [RelatoriosService, PlanosRepository, MaquinasService, LarguraImplementoRepository, TalhoesService, TalhoesRepository, EscalaRepository, { provide: BANCO, useValue: await criarBancoDeTeste() }, { provide: PROVEDOR_MAQUINAS, useValue: new FakeProvedor(() => AGORA) }],
    }).compile();
    service = modulo.get(RelatoriosService);
    planos = modulo.get(PlanosRepository);
  });

  it('o dia soma as máquinas e bate com o que as outras telas mostram', async () => {
    const relatorio = RelatorioSchema.parse(await service.montar('org-demo', 'dia', undefined, AGORA));
    expect(relatorio).toMatchObject({ periodo: 'dia', inicio: '2026-11-10', fim: '2026-11-10' });
    // 38 + 41 + 44 + 210 + 9 hectares, como nos cartões das máquinas.
    expect(relatorio.indicadores.areaHa.valor).toBe(342);
    expect(relatorio.porMaquina.map((m) => m.nome)).toEqual(['Trator 7R 330', 'Trator 8R 370', 'Trator 8R 410', 'Pulverizador M4040', 'Trator 6M 195']); // por horas
    expect(relatorio.maiorParada).toMatchObject({ maquinaId: 'm-6m195', minutos: 80 });
    expect(relatorio.porMaquina.filter((m) => m.destaque).map((m) => m.maquinaId)).toEqual(['m-6m195']);
  });

  it('divide os hectares pela operação do plano que valia para cada máquina; sem plano algum, não divide', async () => {
    const semPlanos = await service.montar('org-demo', 'mes', '2026-10-15', AGORA); // outro período: o do dia fica guardado por 10 s
    expect(semPlanos.porOperacao).toEqual([]);
    expect(semPlanos.resumo).not.toContain('Pelos planos');

    const base = { talhaoIds: ['t-1'], cultura: 'Soja', variedade: 'X', sementesPorHa: 300000, espacamentoCm: 50, produto: null, doseProduto: null, recado: null };
    // Plano antigo de adubação e, por cima dele, um de plantio que começa no dia pedido: vale o mais recente já começado.
    await planos.salvar('org-demo', { ...base, operacao: 'adubacao', dataInicio: '2026-11-01', maquinaIds: ['m-6m195', 'm-7r330'] } as never);
    await planos.salvar('org-demo', { ...base, operacao: 'plantio', dataInicio: '2026-11-09', maquinaIds: ['m-7r330'] } as never);
    await planos.salvar('org-demo', { ...base, operacao: 'colheita', dataInicio: '2026-11-10', maquinaIds: ['m-7r330'] } as never); // ainda não começou
    await planos.salvar('outra-org', { ...base, operacao: 'colheita', dataInicio: '2026-11-01', maquinaIds: ['m-6m195'] } as never).catch(() => undefined); // outra fazenda não entra

    const depois = await service.montar('org-demo', 'dia', '2026-11-09', AGORA);
    const area = (id: string) => depois.porMaquina.find((m) => m.maquinaId === id)!.areaHa;
    expect(depois.porOperacao).toEqual([
      { operacao: 'plantio', areaHa: area('m-7r330') },
      { operacao: 'adubacao', areaHa: area('m-6m195') },
      { operacao: null, areaHa: Math.round((depois.indicadores.areaHa.valor - area('m-7r330') - area('m-6m195')) * 10) / 10 },
    ]);
    expect(depois.resumo).toContain('Pelos planos:');
    expect(depois.resumo).toContain('de plantio');
    expect(depois.resumo).toContain('de máquinas sem plano');
  });

  it('cada máquina do relatório traz litros, consumo e parada, e sem leitura de combustível fica nulo (nunca zero)', async () => {
    const r = await service.montar('org-demo', 'semana', '2026-11-08', AGORA);
    expect(r.porMaquina.length).toBeGreaterThan(0);
    for (const m of r.porMaquina) {
      expect(m.paradoMin).toBeGreaterThanOrEqual(0);
      if (m.litros === null) expect([m.consumoLPorHa, m.consumoLPorHora]).toEqual([null, null]);
      else expect(m.litros).toBeGreaterThan(0);
      if (m.consumoLPorHa !== null) expect(m.consumoLPorHa).toBeCloseTo(m.litros! / m.areaHa, 0);
    }
  });

  it('a semana cobre 7 dias e dá o mesmo resultado a cada chamada', async () => {
    const a = await service.montar('org-demo', 'semana', undefined, AGORA);
    const b = await service.montar('org-demo', 'semana', undefined, AGORA);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ inicio: '2026-11-04', fim: '2026-11-10' });
    const dia = await service.montar('org-demo', 'dia', undefined, AGORA);
    expect(a.indicadores.areaHa.valor).toBeGreaterThan(dia.indicadores.areaHa.valor * 5);
    expect(a.indicadores.areaHa.anterior).toBeGreaterThan(0);
  });

  it('o texto do resumo usa exatamente os números dos indicadores', async () => {
    const relatorio = await service.montar('org-demo', 'dia', undefined, AGORA);
    expect(relatorio.resumo).toContain('Hoje foram 342 ha');
    expect(relatorio.resumo).toContain('Trator 6M 195 ficou 1h20 parado');
    expect(relatorio.resumo).toContain('Trator 7R 330 está sem sinal');
  });
});

describe('períodos escolhidos', () => {
  let service: RelatoriosService;
  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      providers: [RelatoriosService, PlanosRepository, MaquinasService, LarguraImplementoRepository, TalhoesService, TalhoesRepository, EscalaRepository, { provide: BANCO, useValue: await criarBancoDeTeste() }, { provide: PROVEDOR_MAQUINAS, useValue: new FakeProvedor(() => AGORA) }],
    }).compile();
    service = modulo.get(RelatoriosService);
  });

  it('um dia específico traz o dia pedido e a série de um ponto só', async () => {
    const r = RelatorioSchema.parse(await service.montar('org-demo', 'dia', '2026-11-05', AGORA));
    expect(r).toMatchObject({ inicio: '2026-11-05', fim: '2026-11-05', anteriorInicio: '2026-11-04' });
    expect(r.porDia).toHaveLength(1);
    expect(r.resumo).toContain('Em 5 de novembro foram');
  });

  it('o mês vai do dia 1 até hoje e compara com os mesmos dias do mês anterior', async () => {
    const r = RelatorioSchema.parse(await service.montar('org-demo', 'mes', undefined, AGORA));
    expect(r).toMatchObject({ inicio: '2026-11-01', fim: '2026-11-10', anteriorInicio: '2026-10-01', anteriorFim: '2026-10-10' });
    expect(r.porDia).toHaveLength(10);
    // A soma dos dias bate com o total do período.
    const soma = Math.round(r.porDia.reduce((t, d) => t + d.areaHa, 0));
    expect(Math.abs(soma - r.indicadores.areaHa.valor)).toBeLessThanOrEqual(1);
  });

  it('mês fechado traz o mês inteiro, e data no futuro vale hoje', async () => {
    const r = await service.montar('org-demo', 'mes', '2026-10-15', AGORA);
    expect(r).toMatchObject({ inicio: '2026-10-01', fim: '2026-10-31' });
    expect(r.porDia).toHaveLength(31);
    expect(r.resumo).toContain('Em outubro de 2026 foram');
    const futuro = await service.montar('org-demo', 'dia', '2027-01-01', AGORA);
    expect(futuro.fim).toBe('2026-11-10');
  });
});

describe('escreverResumo', () => {
  const base = { periodo: 'dia' as const, maiorParada: null, porMaquina: [], semSinal: [] };
  const indicadores = (valor: number, anterior: number) => ({ areaHa: { valor, anterior }, areaForaDosTalhoesHa: 0, horas: { valor: 0, anterior: 0 }, consumoLPorHa: { valor: null, anterior: null }, consumoLPorHora: { valor: null, anterior: null }, paradoMin: { valor: 0, anterior: 0 }, litros: { valor: null, anterior: null } });

  it('compara para cima, para baixo e sem base de comparação', () => {
    expect(escreverResumo({ ...base, indicadores: indicadores(109, 100) })).toBe('Hoje foram 109 ha, 9% a mais que ontem.');
    expect(escreverResumo({ ...base, indicadores: indicadores(90, 100) })).toBe('Hoje foram 90 ha, 10% a menos que ontem.');
    expect(escreverResumo({ ...base, indicadores: indicadores(50, 0) })).toBe('Hoje foram 50 ha.');
    // Área pequena aparece com uma casa; e o texto separa o que foi dentro do que foi fora dos talhões.
    expect(escreverResumo({ ...base, indicadores: indicadores(0.3, 0) })).toBe('Hoje foram 0,3 ha.');
    expect(escreverResumo({ ...base, indicadores: { ...indicadores(120, 0), areaForaDosTalhoesHa: 95.5 } })).toBe('Hoje foram 120 ha. Desse total, 25 ha foram dentro dos talhões e 96 ha fora.');
    expect(escreverResumo({ ...base, indicadores: { ...indicadores(40, 0), areaForaDosTalhoesHa: 40 } })).toBe('Hoje foram 40 ha. Toda essa área foi fora dos talhões que têm contorno no mapa.');
    expect(escreverResumo({ ...base, indicadores: indicadores(50, 0), semSinal: ['A', 'B', 'C', 'D'] })).toContain('4 máquinas que deram sinal nos últimos dias estão sem sinal agora');
    expect(escreverResumo({ ...base, indicadores: indicadores(0, 80) })).toBe('Hoje ainda não há área trabalhada registrada.');
  });

  it('só menciona parada que importa', () => {
    const parada = (minutos: number) => ({ maquinaId: 'm', maquinaNome: 'Trator A', minutos, talhaoNome: 'Talhão 3' });
    expect(escreverResumo({ ...base, indicadores: indicadores(10, 10), maiorParada: parada(20) })).not.toContain('parado');
    expect(escreverResumo({ ...base, indicadores: indicadores(10, 10), maiorParada: parada(95) })).toContain('O Trator A ficou 1h35 parado no Talhão 3.');
  });
});

describe('relatório só de algumas máquinas', () => {
  let service: RelatoriosService;
  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      providers: [RelatoriosService, PlanosRepository, MaquinasService, LarguraImplementoRepository, TalhoesService, TalhoesRepository, EscalaRepository, { provide: BANCO, useValue: await criarBancoDeTeste() }, { provide: PROVEDOR_MAQUINAS, useValue: new FakeProvedor(() => AGORA) }],
    }).compile();
    service = modulo.get(RelatoriosService);
  });

  it('com máquinas escolhidas, só elas entram nos totais, na lista e na comparação', async () => {
    const todas = await service.montar('org-demo', 'semana', '2026-11-08', AGORA);
    expect(todas.soMaquinas).toBeNull();
    const [primeira, segunda] = todas.porMaquina;
    const so = await service.montar('org-demo', 'semana', '2026-11-08', AGORA, [primeira!.maquinaId]);
    expect(so.soMaquinas).toEqual([{ maquinaId: primeira!.maquinaId, nome: primeira!.nome }]);
    expect(so.porMaquina.map((m) => m.maquinaId)).toEqual([primeira!.maquinaId]);
    expect(so.indicadores.areaHa.valor).toBe(primeira!.areaHa);
    expect(so.indicadores.horas.valor).toBe(primeira!.horas);
    expect(so.porDia.reduce((t, d) => t + d.horas, 0)).toBeCloseTo(primeira!.horas, 0);
    const duas = await service.montar('org-demo', 'semana', '2026-11-08', AGORA, [primeira!.maquinaId, segunda!.maquinaId]);
    expect(duas.indicadores.horas.valor).toBeCloseTo(primeira!.horas + segunda!.horas, 1);
    expect(duas.indicadores.horas.valor).toBeLessThan(todas.indicadores.horas.valor);
  });

  it('máquina que não é da fazenda dá erro com código estável', async () => {
    await expect(service.montar('org-demo', 'dia', '2026-11-07', AGORA, ['nao-existe'])).rejects.toMatchObject({ response: { codigo: 'MAQUINA_NAO_ENCONTRADA' } });
  });
});
