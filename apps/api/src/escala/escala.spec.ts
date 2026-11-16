import { Test } from '@nestjs/testing';
import { LarguraImplementoRepository } from '../integracoes/deere/largura-implemento.repository.js';
import { FakeProvedor } from '@talhio/deere';
import { EscalaSchema } from '@talhio/shared';
import { BANCO } from '../banco/banco.module.js';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import { organizacoes } from '../banco/schema.js';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { MaquinasService } from '../maquinas/maquinas.service.js';
import { TalhoesRepository } from '../talhoes/talhoes.repository.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';
import { EscalaRepository } from './escala.repository.js';
import { EscalaService } from './escala.service.js';

// Meio-dia em Brasília de 10/11/2026.
const AGORA = new Date('2026-11-10T15:00:00.000Z');
const AMANHA = new Date('2026-11-11T15:00:00.000Z');
const ORG = 'org-demo';

describe('EscalaService', () => {
  let service: EscalaService;
  let maquinas: MaquinasService;

  beforeAll(async () => {
    const banco = await criarBancoDeTeste();
    await banco.insert(organizacoes).values({ id: 'outra-org', nome: 'Vizinho' });
    const modulo = await Test.createTestingModule({
      providers: [EscalaService, EscalaRepository, MaquinasService, LarguraImplementoRepository, TalhoesService, TalhoesRepository, { provide: BANCO, useValue: banco }, { provide: PROVEDOR_MAQUINAS, useValue: new FakeProvedor(() => AGORA) }],
    }).compile();
    service = modulo.get(EscalaService);
    maquinas = modulo.get(MaquinasService);
  });

  it('sem nada gravado, sugere o operador que cada máquina informa', async () => {
    const escala = EscalaSchema.parse(await service.deHoje(ORG, AGORA));
    expect(escala.dia).toBe('2026-11-10');
    expect(escala.itens).toHaveLength(5);
    expect(escala.itens.every((i) => !i.definida && i.enviadaEm === null)).toBe(true);
    expect(escala.itens.find((i) => i.maquinaId === 'm-8r410')).toMatchObject({ operador: 'João', turno: 'dia-todo' });
  });

  it('grava a escala, a máquina passa a mostrar o escalado e o envio fica registrado até a escala mudar', async () => {
    const talhaoId = (await service.deHoje(ORG, AGORA)).itens.find((i) => i.talhaoId)!.talhaoId!;
    await service.definir(ORG, 'm-8r410', { operador: 'Rafael', tarefa: 'Plantio de soja', talhaoId, turno: 'manha' }, AGORA);
    let item = (await service.deHoje(ORG, AGORA)).itens.find((i) => i.maquinaId === 'm-8r410')!;
    expect(item).toMatchObject({ operador: 'Rafael', tarefa: 'Plantio de soja', talhaoId, turno: 'manha', definida: true, enviadaEm: null });
    expect(item.talhaoNome).toBeTruthy();
    expect((await maquinas.listar(ORG, AGORA)).find((m) => m.id === 'm-8r410')?.operador).toBe('Rafael');

    await service.marcarEnviada(ORG, AGORA);
    item = (await service.deHoje(ORG, AGORA)).itens.find((i) => i.maquinaId === 'm-8r410')!;
    expect(item.enviadaEm).toBe(AGORA.toISOString());
    // As sugestões que foram na mensagem ficam gravadas como escala.
    expect((await service.deHoje(ORG, AGORA)).itens.every((i) => i.definida && i.enviadaEm)).toBe(true);

    await service.definir(ORG, 'm-8r410', { operador: 'Rafael', tarefa: 'Plantio de milho', talhaoId: null, turno: 'manha' }, AGORA);
    item = (await service.deHoje(ORG, AGORA)).itens.find((i) => i.maquinaId === 'm-8r410')!;
    expect(item).toMatchObject({ tarefa: 'Plantio de milho', talhaoId: null, enviadaEm: null });
  });

  it('não deixa o mesmo operador em duas máquinas no mesmo turno', async () => {
    await expect(service.definir(ORG, 'm-7r330', { operador: ' rafael ', tarefa: null, talhaoId: null, turno: 'dia-todo' }, AGORA)).rejects.toMatchObject({
      status: 409,
      response: { codigo: 'OPERADOR_JA_ESCALADO', mensagem: 'rafael já está em Trator 8R 410 nesse turno.' },
    });
    // Em outro turno pode.
    await service.definir(ORG, 'm-7r330', { operador: 'Rafael', tarefa: null, talhaoId: null, turno: 'tarde' }, AGORA);
    expect((await service.deHoje(ORG, AGORA)).itens.filter((i) => i.operador === 'Rafael')).toHaveLength(2);
  });

  it('recusa máquina e talhão que não existem', async () => {
    const dados = { operador: 'Ana', tarefa: null, talhaoId: null, turno: 'dia-todo' as const };
    await expect(service.definir(ORG, 'nao-existe', dados, AGORA)).rejects.toMatchObject({ status: 404 });
    await expect(service.definir(ORG, 'm-6m195', { ...dados, talhaoId: 'nao-existe' }, AGORA)).rejects.toMatchObject({ status: 422, response: { codigo: 'TALHAO_NAO_ENCONTRADO' } });
  });

  it('a escala é do dia e da organização: amanhã e o vizinho começam em branco', async () => {
    expect((await service.deHoje(ORG, AMANHA)).itens.every((i) => !i.definida)).toBe(true);
    expect((await service.deHoje('outra-org', AGORA)).itens.every((i) => !i.definida)).toBe(true);
  });

  it('a escala de outro dia é gravada e lida à parte', async () => {
    await service.definir(ORG, 'm-6m195', { operador: 'Bia', tarefa: 'Gradagem', talhaoId: null, turno: 'dia-todo' }, AGORA, '2026-11-15');
    const futura = await service.deHoje(ORG, AGORA, '2026-11-15');
    expect(futura.dia).toBe('2026-11-15');
    expect(futura.itens.filter((i) => i.definida).map((i) => i.operador)).toEqual(['Bia']);
    expect((await service.deHoje(ORG, AGORA)).itens.some((i) => i.operador === 'Bia')).toBe(false);
    // Envio só das máquinas do plano: as outras continuam como sugestão.
    const enviada = await service.marcarEnviada(ORG, AGORA, '2026-11-15', ['m-6m195']);
    expect(enviada.itens.filter((i) => i.enviadaEm).map((i) => i.maquinaId)).toEqual(['m-6m195']);
    expect(enviada.itens.filter((i) => i.definida)).toHaveLength(1);
  });

  it('repete a escala de ontem como sugestão e o confirmar grava tudo sem marcar como enviada', async () => {
    const hoje = '2026-11-20';
    const ontem = '2026-11-19';
    await service.definir(ORG, 'm-7r330', { operador: 'Rafael', tarefa: 'Plantio de soja', talhaoId: null, turno: 'manha' }, AGORA, ontem);
    const sugerida = await service.deHoje(ORG, AGORA, hoje);
    expect(sugerida.itens.find((i) => i.maquinaId === 'm-7r330')).toMatchObject({ operador: 'Rafael', tarefa: 'Plantio de soja', turno: 'manha', definida: false });
    // Máquina sem escala ontem segue com o operador que ela mesma informa (o de hoje, gravado nos testes acima).
    const daMaquina = (await maquinas.listar(ORG, AGORA)).find((m) => m.id === 'm-8r410')!.operador;
    expect(sugerida.itens.find((i) => i.maquinaId === 'm-8r410')).toMatchObject({ operador: daMaquina, definida: false });
    expect(sugerida.itens.some((i) => i.definida)).toBe(false);

    const confirmada = await service.confirmar(ORG, AGORA, hoje);
    expect(confirmada.itens.filter((i) => i.operador).every((i) => i.definida && i.enviadaEm === null)).toBe(true);
    expect(confirmada.itens.find((i) => i.maquinaId === 'm-7r330')).toMatchObject({ operador: 'Rafael', definida: true });
    // Outra fazenda não herda a escala de ninguém.
    expect((await service.deHoje('outra-org', AGORA, hoje)).itens.every((i) => !i.definida)).toBe(true);
  });

  it('tirar da escala volta para a sugestão da máquina', async () => {
    await service.tirar(ORG, 'm-8r410', AGORA);
    expect((await service.deHoje(ORG, AGORA)).itens.find((i) => i.maquinaId === 'm-8r410')).toMatchObject({ operador: 'João', definida: false });
  });

  describe('por turno', () => {
    const DIA = '2026-11-20';
    const daMaquina = async (id: string) => (await service.deHoje(ORG, AGORA, DIA)).itens.filter((i) => i.maquinaId === id);

    it('a mesma máquina tem um operador por turno, e cada linha traz como a máquina está agora', async () => {
      await service.definir(ORG, 'm-8r410', { operador: 'Ana', tarefa: 'Plantio', talhaoId: null, turno: 'tarde' }, AGORA, DIA);
      await service.definir(ORG, 'm-8r410', { operador: 'Beto', tarefa: 'Plantio', talhaoId: null, turno: 'manha' }, AGORA, DIA);
      const linhas = await daMaquina('m-8r410');
      expect(linhas.map((l) => [l.turno, l.operador])).toEqual([['manha', 'Beto'], ['tarde', 'Ana']]);
      expect(linhas.every((l) => ['trabalhando', 'parada', 'sem-sinal'].includes(l.maquinaStatus))).toBe(true);
      // O mesmo operador pode pegar outra máquina em OUTRO turno, mas não no mesmo.
      await service.definir(ORG, 'm-7r330', { operador: 'Ana', tarefa: null, talhaoId: null, turno: 'manha' }, AGORA, DIA);
      await expect(service.definir(ORG, 'm-7r330', { operador: 'Beto', tarefa: null, talhaoId: null, turno: 'manha' }, AGORA, DIA)).rejects.toMatchObject({ response: { codigo: 'OPERADOR_JA_ESCALADO' } });
    });

    it('editar trocando o turno move a linha; "dia todo" e turno separado não convivem', async () => {
      await service.definir(ORG, 'm-8r410', { operador: 'Beto', tarefa: 'Plantio', talhaoId: null, turno: 'noite', substitui: 'manha' }, AGORA, DIA);
      expect((await daMaquina('m-8r410')).map((l) => l.turno)).toEqual(['tarde', 'noite']);
      await service.definir(ORG, 'm-8r410', { operador: 'Caio', tarefa: null, talhaoId: null, turno: 'dia-todo' }, AGORA, DIA);
      expect((await daMaquina('m-8r410')).map((l) => [l.turno, l.operador])).toEqual([['dia-todo', 'Caio']]);
      await service.definir(ORG, 'm-8r410', { operador: 'Beto', tarefa: null, talhaoId: null, turno: 'tarde' }, AGORA, DIA);
      expect((await daMaquina('m-8r410')).map((l) => l.turno)).toEqual(['tarde']);
    });

    it('tirar um turno deixa os outros; o dia seguinte repete os turnos como sugestão', async () => {
      await service.definir(ORG, 'm-8r410', { operador: 'Dora', tarefa: null, talhaoId: null, turno: 'noite' }, AGORA, DIA);
      await service.tirar(ORG, 'm-8r410', AGORA, DIA, 'tarde');
      expect((await daMaquina('m-8r410')).map((l) => [l.turno, l.operador])).toEqual([['noite', 'Dora']]);
      await service.definir(ORG, 'm-8r410', { operador: 'Beto', tarefa: null, talhaoId: null, turno: 'manha' }, AGORA, DIA);
      const amanha = (await service.deHoje(ORG, AGORA, '2026-11-21')).itens.filter((i) => i.maquinaId === 'm-8r410');
      expect(amanha.map((l) => [l.turno, l.operador, l.definida])).toEqual([['manha', 'Beto', false], ['noite', 'Dora', false]]);
    });
  });
});
