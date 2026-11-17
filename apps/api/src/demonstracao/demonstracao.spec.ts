import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DeereProvedor, FakeProvedor, type ProvedorMaquinas } from '@talhio/deere';
import { BANCO } from '../banco/banco.module.js';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import { organizacoes, usuarios } from '../banco/schema.js';
import type { Banco } from '../banco/banco.js';
import { CONFIG, type Config } from '../core/config.js';
import { AtividadeDeereRepository } from '../integracoes/deere/atividade-deere.repository.js';
import { ConexaoDeereRepository } from '../integracoes/deere/conexao-deere.repository.js';
import { ConexaoDeereService } from '../integracoes/deere/conexao-deere.service.js';
import { DEERE_HTTP } from '../integracoes/deere/deere.http.js';
import { ProvedorPorFazenda } from '../integracoes/deere/provedor-por-fazenda.js';
import { EscalaRepository } from '../escala/escala.repository.js';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { LarguraImplementoRepository } from '../integracoes/deere/largura-implemento.repository.js';
import { MaquinasService } from '../maquinas/maquinas.service.js';
import { PlanosRepository } from '../planos/planos.repository.js';
import { RelatoriosService } from '../relatorios/relatorios.service.js';
import { TalhoesRepository } from '../talhoes/talhoes.repository.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';
import { FakeWhatsapp } from '../whatsapp/fake-whatsapp.js';
import { WhatsappRepository } from '../whatsapp/whatsapp.repository.js';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { PROVEDOR_WHATSAPP } from '../whatsapp/whatsapp.tokens.js';
import { DemonstracaoService } from './demonstracao.service.js';

const DEMO = 'org-demo';
const REAL = 'org-real';
const config = (extra: Partial<Config> = {}) => ({ demoEmail: null, orgId: 'org-admin', deereProvedor: 'deere', deere: { clientId: 'a', clientSecret: 'b', baseUrl: 'https://x', redirectUri: 'https://x/cb', wellKnown: 'https://x/wk', escopos: 'ag1', criptoChave: 'c'.repeat(32), appRetorno: 'talhio://deere' }, ...extra }) as unknown as Config;

async function bancoComContas(): Promise<Banco> {
  const banco = await criarBancoDeTeste('org-admin');
  await banco.insert(organizacoes).values([{ id: DEMO, nome: 'Fazenda Demonstração' }, { id: REAL, nome: 'Fazenda Real' }]);
  await banco.insert(usuarios).values([
    { id: 'u-demo', orgId: DEMO, nome: 'Revisor', email: 'revisor@talhio.com', senhaHash: 'x', papel: 'admin', ativo: true },
    { id: 'u-real', orgId: REAL, nome: 'Dono', email: 'dono@fazenda.com', senhaHash: 'x', papel: 'admin', ativo: true },
  ]);
  return banco;
}

async function demonstracao(demoEmail: string | null, banco?: Banco) {
  const b = banco ?? (await bancoComContas());
  const s = new DemonstracaoService(config({ demoEmail }), b);
  await s.onModuleInit();
  return s;
}

/** DeereProvedor de mentira: qualquer chamada que chegue aqui é registrada. */
function deereEspia() {
  const chamadas: string[] = [];
  const p = new Proxy({}, { get: (_, nome) => (...args: unknown[]) => (chamadas.push(`${String(nome)}(${String(args[0])})`), Promise.resolve([])) }) as unknown as ProvedorMaquinas;
  return { p, chamadas };
}

describe('DemonstracaoService', () => {
  it('a fazenda da conta DEMO_EMAIL é a de demonstração e as outras não', async () => {
    const s = await demonstracao('revisor@talhio.com');
    expect(s.ehDemo(DEMO)).toBe(true);
    expect(s.ehDemo(REAL)).toBe(false);
  });

  it('sem DEMO_EMAIL (ou com e-mail sem conta) nenhuma fazenda é de demonstração e nada é criado', async () => {
    const banco = await bancoComContas();
    const antes = (await banco.select().from(usuarios)).length;
    const sem = await demonstracao(null, banco);
    const semConta = await demonstracao('ninguem@talhio.com', banco);
    expect([sem.ehDemo(DEMO), sem.ehDemo(REAL), semConta.ehDemo(DEMO)]).toEqual([false, false, false]);
    expect((await banco.select().from(usuarios)).length).toBe(antes);
    expect((await banco.select().from(organizacoes)).length).toBe(3);
  });

  it('a fazenda do administrador do servidor nunca vira demonstração', async () => {
    const banco = await bancoComContas();
    await banco.insert(usuarios).values({ id: 'u-adm', orgId: 'org-admin', nome: 'Adm', email: 'adm@talhio.com', senhaHash: 'x', papel: 'admin', ativo: true });
    expect((await demonstracao('adm@talhio.com', banco)).ehDemo('org-admin')).toBe(false);
  });
});

describe('ProvedorPorFazenda', () => {
  it('a demonstração lista as máquinas e os talhões de exemplo e monta o relatório, sem tocar na Deere', async () => {
    const espia = deereEspia();
    const fake = new FakeProvedor();
    const roteador = new ProvedorPorFazenda(fake, espia.p, (o) => o === DEMO);
    expect((await roteador.listarMaquinas(DEMO)).length).toBeGreaterThan(0);
    expect((await roteador.listarTalhoes(DEMO)).length).toBeGreaterThan(0);
    expect((await roteador.resumoDaFazenda(DEMO)).nome).toBeTruthy();
    expect(await roteador.nomeDaFazenda(DEMO)).toBeTruthy();
    const m = await Test.createTestingModule({
      providers: [RelatoriosService, PlanosRepository, MaquinasService, LarguraImplementoRepository, TalhoesService, TalhoesRepository, EscalaRepository, { provide: BANCO, useValue: await bancoComContas() }, { provide: PROVEDOR_MAQUINAS, useValue: roteador }],
    }).compile();
    const relatorio = await m.get(RelatoriosService).montar(DEMO, 'dia', undefined, new Date('2026-11-10T15:00:00.000Z'));
    expect(relatorio.porMaquina.length).toBeGreaterThan(0);
    expect(espia.chamadas).toEqual([]);
  });

  it('outra fazenda continua indo para o provedor da Deere', async () => {
    const espia = deereEspia();
    const roteador = new ProvedorPorFazenda(new FakeProvedor(), espia.p, (o) => o === DEMO);
    await roteador.listarMaquinas(REAL);
    await roteador.listarTalhoes(REAL);
    await roteador.sincronizar(REAL);
    expect(espia.chamadas).toEqual([`listarMaquinas(${REAL})`, `listarTalhoes(${REAL})`, `sincronizar(${REAL})`]);
  });

  it('métodos opcionais que a fonte da demonstração não tem devolvem vazio ou nulo, sem quebrar', async () => {
    const espia = deereEspia();
    const sozinho = new ProvedorPorFazenda({ ...new FakeProvedor() } as unknown as ProvedorMaquinas, espia.p, () => true);
    expect(await sozinho.usoDeHoje(DEMO, 'm1')).toBeNull();
    expect(await sozinho.alertasDaMaquina(DEMO, 'm1', new Date())).toEqual([]);
    expect(await sozinho.consumoDiario(DEMO, 'm1', '2026-11-01', '2026-11-02')).toEqual([]);
    expect(await sozinho.areaDasOperacoes(DEMO, '2026-11-01', '2026-11-02')).toEqual([]);
    expect(sozinho.caminhoDeHoje(DEMO, 'm1')).toEqual([]);
    expect(await sozinho.sincronizar(DEMO)).toEqual({ lidas: 0, esperando: 0, falhas: 0 });
    expect(await sozinho.recuperarPassado(DEMO)).toEqual({ fechados: 0, faltam: 0 });
    expect((await sozinho.analiseDaMaquina(DEMO, 'm1', 'a', 'b')).grupos).toEqual([]);
    await expect(sozinho.enviarTalhao(DEMO, { nome: 'T', contorno: [] })).rejects.toThrow();
    expect(espia.chamadas).toEqual([]);
  });

  it('criar talhão e linha na demonstração não chega à Deere', async () => {
    const espia = deereEspia();
    const roteador = new ProvedorPorFazenda(new FakeProvedor(), espia.p, (o) => o === DEMO);
    await roteador.enviarTalhao(DEMO, { nome: 'Novo', contorno: [[0, 0], [0, 1], [1, 1]] });
    await roteador.enviarLinha(DEMO, { id: 'l1', talhaoId: 't1', nome: 'AB', pontoA: [0, 0], pontoB: [0, 1] } as never, 'chave').catch(() => undefined);
    expect(espia.chamadas).toEqual([]);
  });
});

describe('ConexaoDeereService na demonstração', () => {
  async function montar() {
    const banco = await bancoComContas();
    const demo = await demonstracao('revisor@talhio.com', banco);
    const modulo = await Test.createTestingModule({
      providers: [ConexaoDeereService, ConexaoDeereRepository, { provide: BANCO, useValue: banco }, { provide: CONFIG, useValue: config() }, { provide: DEERE_HTTP, useValue: (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch }, { provide: DemonstracaoService, useValue: demo }],
    }).compile();
    return modulo.get(ConexaoDeereService);
  }

  it('o estado é demonstracao/pronto, para o app não mandar o revisor ao onboarding', async () => {
    const s = await montar();
    expect(await s.estado(DEMO)).toMatchObject({ modo: 'demonstracao', estado: 'pronto' });
    expect(await s.estado(REAL)).toMatchObject({ modo: 'deere', estado: 'desconectado' });
  });

  it('iniciar, concluir, escolher e desconectar são recusados', async () => {
    const s = await montar();
    await expect(s.iniciar(DEMO)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(s.concluir(DEMO, { codigo: 'c', estado: 'e' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(s.escolher(DEMO, ['1'])).rejects.toBeInstanceOf(ForbiddenException);
    await expect(s.desconectar(DEMO)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(s.obterToken(DEMO)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('WhatsappService na demonstração', () => {
  async function montar() {
    const banco = await bancoComContas();
    const demo = await demonstracao('revisor@talhio.com', banco);
    const fake = new FakeWhatsapp();
    const modulo = await Test.createTestingModule({
      providers: [WhatsappService, WhatsappRepository, { provide: BANCO, useValue: banco }, { provide: PROVEDOR_WHATSAPP, useValue: fake }, { provide: DemonstracaoService, useValue: demo }],
    }).compile();
    return { s: modulo.get(WhatsappService), fake };
  }

  it('o estado é indisponível e conectar ou mandar mensagem é recusado', async () => {
    const { s } = await montar();
    expect(await s.estado(DEMO)).toMatchObject({ estado: 'indisponivel', grupo: null });
    await expect(s.pedirCodigo(DEMO, '5547999990000')).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(s.enviarTexto(DEMO, '5547999990000', 'oi')).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(s.notificarGrupo(DEMO, 'oi')).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(s.enviarTeste(DEMO)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(s.desconectar(DEMO)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('outra fazenda continua com o WhatsApp normal', async () => {
    const { s } = await montar();
    expect((await s.estado(REAL)).estado).not.toBe('indisponivel');
  });
});

describe('segundo plano', () => {
  it('a fazenda de demonstração fica de fora da lista de fazendas com a Deere pronta', async () => {
    const banco = await bancoComContas();
    const { conexoesDeere } = await import('../banco/schema.js');
    const base = { acessoCifrado: 'x', renovacaoCifrada: 'y', escopos: 'ag1', expiraEm: new Date(Date.now() + 3600_000), deereOrgId: '1', deereOrgNome: 'N', deereOrgExtras: '', precisaLiberar: false };
    await banco.insert(conexoesDeere).values([{ orgId: DEMO, ...base } as never, { orgId: REAL, ...base } as never]);
    const demo = await demonstracao('revisor@talhio.com', banco);
    expect(await new AtividadeDeereRepository(banco, demo).fazendasProntas()).toEqual([REAL]);
    expect((await new AtividadeDeereRepository(banco).fazendasProntas()).sort()).toEqual([DEMO, REAL].sort());
  });
});
