import { lerAlertas, type AlertaDaMaquina, type ProvedorMaquinas } from '@talhio/deere';
import type { Maquina } from '@talhio/shared';
import { RegistrarDispositivoSchema } from '@talhio/shared';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import type { Banco } from '../banco/banco.js';
import { organizacoes, usuarios } from '../banco/schema.js';
import type { Config } from '../core/config.js';
import { DispositivosRepository } from './dispositivos.repository.js';
import { ExpoPushService } from './expo-push.service.js';
import { MotorDeAlertasService } from './motor-de-alertas.service.js';
import { NotificacoesRepository } from './notificacoes.repository.js';
import { NotificacoesService } from './notificacoes.service.js';

const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

async function montarBanco() {
  const db = await criarBancoDeTeste();
  await db.insert(organizacoes).values({ id: 'org-b', nome: 'Outra fazenda' });
  await db.insert(usuarios).values([
    { id: 'u1', orgId: 'org-demo', nome: 'Ana', email: 'ana@x.com', senhaHash: 'x' },
    { id: 'u2', orgId: 'org-demo', nome: 'Beto', email: 'beto@x.com', senhaHash: 'x' },
    { id: 'u3', orgId: 'org-b', nome: 'Caio', email: 'caio@x.com', senhaHash: 'x' },
  ]);
  return db;
}

describe('lerAlertas (falhas que a máquina registra)', () => {
  const bruto = (extra: Record<string, unknown> = {}) => ({ id: '1', time: '2026-11-13T12:11:51.000Z', severity: 'MEDIUM', color: 'YELLOW', acknowledgementStatus: 'N', occurrences: '2', definition: { description: 'Chaffer   Adjust System Problem  -  sensor fora da faixa.' }, ...extra });

  it('traduz a severidade, limpa o texto e ordena do mais antigo para o mais novo', () => {
    const r = lerAlertas([bruto({ id: '2', time: '2026-11-13T13:00:00.000Z', severity: 'HIGH', color: 'RED' }), bruto(), bruto({ id: '3', severity: 'NONE', color: 'BLUE' })]);
    expect(r.map((a) => [a.id, a.severidade])).toEqual([['1', 'media'], ['3', 'info'], ['2', 'alta']]);
    expect(r[0]).toMatchObject({ descricao: 'Chaffer Adjust System Problem - sensor fora da faixa.', reconhecido: false, ocorrencias: 2, quando: '2026-11-13T12:11:51.000Z' });
  });

  it('sem severidade usa a cor; escondido, ignorado, sem id ou sem hora não entram; sem descrição usa o código', () => {
    const r = lerAlertas([
      bruto({ id: 'a', severity: undefined, color: 'RED' }),
      bruto({ id: 'b', invisible: true }),
      bruto({ id: 'c', ignored: true }),
      bruto({ id: undefined }),
      bruto({ id: 'd', time: 'lixo' }),
      bruto({ id: 'e', acknowledgementStatus: 'Y', definition: { threeLetterAcronym: 'AIC', suspectParameterName: '524019', failureModeIndicator: '31' } }),
    ]);
    expect(r.map((a) => [a.id, a.severidade, a.reconhecido])).toEqual([['a', 'alta', false], ['e', 'media', true]]);
    expect(r[1]!.descricao).toBe('AIC 524019.31');
    expect(lerAlertas(null)).toEqual([]);
  });
});

describe('ExpoPushService', () => {
  const config = { expoAccessToken: null } as unknown as Config;
  const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

  it('manda em lotes de 100, com título, texto e dados, e devolve os tokens que o Expo diz que não existem mais', async () => {
    const chamadas: { corpo: { to: string; title: string; data: Record<string, string> }[] }[] = [];
    const http = (async (_url: string, init: RequestInit) => {
      const corpo = JSON.parse(String(init.body)) as { to: string; title: string; data: Record<string, string> }[];
      chamadas.push({ corpo });
      return resposta({ data: corpo.map((m) => (m.to.endsWith('x]') ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' })) });
    }) as unknown as typeof fetch;
    const tokens = Array.from({ length: 150 }, (_, i) => `ExponentPushToken[t${i}]`);
    tokens[120] = 'ExponentPushToken[morto-x]';
    const { invalidos } = await new ExpoPushService(config, http).enviar(tokens, { titulo: 'Titulo', texto: 'Texto', dados: { maquinaId: '7' } });
    expect(chamadas.map((c) => c.corpo.length)).toEqual([100, 50]);
    expect(chamadas[0]!.corpo[0]).toMatchObject({ title: 'Titulo', data: { maquinaId: '7' } });
    expect(invalidos).toEqual(['ExponentPushToken[morto-x]']);
  });

  it('com o token do Expo configurado, manda o cabeçalho de autorização', async () => {
    let cabecalhos: Record<string, string> = {};
    const http = (async (_u: string, init: RequestInit) => ((cabecalhos = init.headers as Record<string, string>), resposta({ data: [{ status: 'ok' }] }))) as unknown as typeof fetch;
    await new ExpoPushService({ expoAccessToken: 'segredo-do-expo' } as unknown as Config, http).enviar([TOKEN_A], { titulo: 'a', texto: 'b', dados: {} });
    expect(cabecalhos.Authorization).toBe('Bearer segredo-do-expo');
  });

  it('nunca lança: erro de rede, resposta ruim ou lista vazia só não enviam', async () => {
    const quebrado = (async () => {
      throw new Error('sem internet');
    }) as unknown as typeof fetch;
    expect(await new ExpoPushService(config, quebrado).enviar([TOKEN_A], { titulo: 'a', texto: 'b', dados: {} })).toEqual({ invalidos: [] });
    const erro500 = (async () => resposta({}, 500)) as unknown as typeof fetch;
    expect(await new ExpoPushService(config, erro500).enviar([TOKEN_A], { titulo: 'a', texto: 'b', dados: {} })).toEqual({ invalidos: [] });
    expect(await new ExpoPushService(config, quebrado).enviar([], { titulo: 'a', texto: 'b', dados: {} })).toEqual({ invalidos: [] });
  });

  it('o contrato só aceita token do Expo', () => {
    expect(RegistrarDispositivoSchema.safeParse({ token: TOKEN_A, plataforma: 'ios' }).success).toBe(true);
    expect(RegistrarDispositivoSchema.safeParse({ token: 'abc', plataforma: 'ios' }).success).toBe(false);
    expect(RegistrarDispositivoSchema.safeParse({ token: TOKEN_A, plataforma: 'web' }).success).toBe(false);
  });
});

describe('repositórios', () => {
  it('aparelhos: o token é de um usuário só, cada um remove o seu e os mortos saem', async () => {
    const db = await montarBanco();
    const repo = new DispositivosRepository(db);
    await repo.registrar('u1', 'org-demo', TOKEN_A, 'ios');
    await repo.registrar('u2', 'org-demo', TOKEN_B, 'android');
    await repo.registrar('u3', 'org-b', 'ExponentPushToken[ccccccccccccccccccccc]', 'ios');
    expect((await repo.tokensDaFazenda('org-demo')).sort()).toEqual([TOKEN_A, TOKEN_B]);
    expect(await repo.tokensDaFazenda('org-b')).toHaveLength(1);
    // O aparelho trocou de conta: o token passa para o usuário novo, sem duplicar.
    await repo.registrar('u2', 'org-demo', TOKEN_A, 'ios');
    expect((await repo.tokensDaFazenda('org-demo')).sort()).toEqual([TOKEN_A, TOKEN_B]);
    await repo.remover('u1', TOKEN_A); // não é mais do u1: nada some
    expect(await repo.tokensDaFazenda('org-demo')).toContain(TOKEN_A);
    await repo.remover('u2', TOKEN_A);
    await repo.removerInvalidos([TOKEN_B]);
    expect(await repo.tokensDaFazenda('org-demo')).toEqual([]);
  });

  it('notificações: o mesmo id não duplica, a lista é por fazenda, e o não lido conta o que veio depois da leitura', async () => {
    const db = await montarBanco();
    const repo = new NotificacoesRepository(db);
    const nova = (id: string, extra: Partial<Parameters<NotificacoesRepository['criar']>[1]> = {}) => ({ id, chave: `maquina-parada:7`, tipo: 'maquina-parada' as const, severidade: 'media' as const, maquinaId: '7', maquinaNome: 'M7', titulo: 'T', texto: 'X', ...extra });
    const t0 = new Date('2026-11-13T10:00:00Z');
    expect(await repo.criar('org-demo', nova('n1', { criadaEm: t0 }))).toBe(true);
    expect(await repo.criar('org-demo', nova('n1', { criadaEm: t0 }))).toBe(false);
    await repo.criar('org-demo', nova('n2', { criadaEm: new Date('2026-11-13T11:00:00Z'), chave: 'sem-sinal:7', tipo: 'sem-sinal' }));
    await repo.criar('org-b', nova('n3'));
    expect((await repo.listar('org-demo', 10)).map((n) => n.id)).toEqual(['n2', 'n1']);
    expect(await repo.listar('org-b', 10)).toHaveLength(1);

    const agora = new Date('2026-11-13T12:00:00Z');
    expect(await repo.naoLidas('org-demo', 'u1', agora)).toBe(2);
    await repo.marcarLidas('u1', new Date('2026-11-13T10:30:00Z'));
    expect(await repo.naoLidas('org-demo', 'u1', agora)).toBe(1); // só a das 11:00 veio depois
    expect(await repo.naoLidas('org-demo', 'u2', agora)).toBe(2); // cada usuário lê por si

    expect((await repo.abertas('org-demo', 'maquina-parada')).map((a) => a.id)).toEqual(['n1']);
    await repo.resolver('org-demo', 'n1', new Date('2026-11-13T11:30:00Z'));
    expect(await repo.abertas('org-demo', 'maquina-parada')).toEqual([]);
    await repo.resolver('org-b', 'n2'); // de outra fazenda: nada acontece
    expect((await repo.abertas('org-demo', 'sem-sinal')).map((a) => a.id)).toEqual(['n2']);
    expect((await repo.listar('org-demo', 10)).find((n) => n.id === 'n1')?.resolvidaEm).toBe('2026-11-13T11:30:00.000Z');
  });
});

describe('MotorDeAlertasService', () => {
  const MIN = 60_000;
  const t0 = new Date('2026-11-13T15:00:00Z').getTime();
  const em = (minutos: number) => new Date(t0 + minutos * MIN);

  type Estado = Partial<Maquina> & { status: Maquina['status'] };
  const maquina = (e: Estado): Maquina => ({ id: '7', nome: '8270R - 29', tipo: 'trator', telemetriaAtiva: true, ultimoSinal: new Date(t0).toISOString(), paradaDesde: null, combustivelPct: 60, combustivelSuspeito: false, talhaoNome: null, ...e }) as unknown as Maquina;

  async function montar(alertas: AlertaDaMaquina[] = []) {
    const db: Banco = await montarBanco();
    const dispositivos = new DispositivosRepository(db);
    await dispositivos.registrar('u1', 'org-demo', TOKEN_A, 'ios');
    const enviados: { titulo: string; texto: string; dados: Record<string, string>; tokens: string[] }[] = [];
    const push = { enviar: async (tokens: string[], m: { titulo: string; texto: string; dados: Record<string, string> }) => (enviados.push({ ...m, tokens }), { invalidos: [] }) } as unknown as ExpoPushService;
    const repo = new NotificacoesRepository(db);
    const servico = new NotificacoesService(repo, dispositivos, push);
    const provedor = { alertasDaMaquina: async () => alertas } as unknown as ProvedorMaquinas;
    const config = { deereProvedor: 'deere', pushAlertas: true } as unknown as Config;
    const motor = new MotorDeAlertasService(config, provedor, {} as never, {} as never, repo, servico);
    return { motor, repo, enviados };
  }

  it('máquina que trabalhou e parou 20 min avisa uma vez; acaba quando volta a andar; não repete antes de 2 h', async () => {
    const { motor, repo, enviados } = await montar();
    await motor.verificarMaquinas('org-demo', [maquina({ status: 'trabalhando' })], em(0));
    const parada = (m: number) => maquina({ status: 'parada', paradaDesde: em(5).toISOString(), talhaoNome: 'Talhão Norte', ultimoSinal: em(m).toISOString() });
    await motor.verificarMaquinas('org-demo', [parada(10)], em(10)); // parada há 5 min: ainda não
    expect(enviados).toHaveLength(0);
    await motor.verificarMaquinas('org-demo', [parada(26)], em(26)); // parada há 21 min
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ titulo: '8270R - 29 parada', tokens: [TOKEN_A], dados: { tipo: 'maquina-parada', maquinaId: '7' } });
    expect(enviados[0]!.texto).toMatch(/Parada há 21 min no talhão norte, desde \d{2}:\d{2}\./);
    await motor.verificarMaquinas('org-demo', [parada(30)], em(30)); // continua parada: não repete
    expect(enviados).toHaveLength(1);
    await motor.verificarMaquinas('org-demo', [maquina({ status: 'trabalhando' })], em(40)); // voltou: o episódio fecha
    expect(await repo.abertas('org-demo', 'maquina-parada')).toEqual([]);
    // Parou de novo logo em seguida: dentro das 2 h, não avisa outra vez.
    const outra = (m: number) => maquina({ status: 'parada', paradaDesde: em(45).toISOString(), ultimoSinal: em(m).toISOString() });
    await motor.verificarMaquinas('org-demo', [outra(70)], em(70));
    expect(enviados).toHaveLength(1);
    // Depois de 2 h do primeiro aviso, avisa.
    await motor.verificarMaquinas('org-demo', [maquina({ status: 'trabalhando' })], em(200));
    await motor.verificarMaquinas('org-demo', [maquina({ status: 'parada', paradaDesde: em(205).toISOString() })], em(230));
    expect(enviados).toHaveLength(2);
    expect((await repo.listar('org-demo', 10)).length).toBe(2);
  });

  it('máquina parada na garagem (que não trabalhou antes) não é alerta', async () => {
    const { motor, enviados } = await montar();
    await motor.verificarMaquinas('org-demo', [maquina({ status: 'parada', paradaDesde: em(-600).toISOString() })], em(0));
    await motor.verificarMaquinas('org-demo', [maquina({ status: 'parada', paradaDesde: em(-600).toISOString() })], em(60));
    expect(enviados).toHaveLength(0);
  });

  it('sem sinal depois de estar ativa avisa; máquina que já estava sem sinal há dias não', async () => {
    const { motor, enviados } = await montar();
    await motor.verificarMaquinas('org-demo', [maquina({ status: 'trabalhando' }), maquina({ id: '8', nome: 'S550', status: 'sem-sinal', ultimoSinal: em(-99999).toISOString() })], em(0));
    expect(enviados).toHaveLength(0);
    const sem = (m: number) => [maquina({ status: 'sem-sinal', ultimoSinal: em(0).toISOString() }), maquina({ id: '8', nome: 'S550', status: 'sem-sinal', ultimoSinal: em(-99999).toISOString() })].map((x) => ({ ...x, _m: m }));
    await motor.verificarMaquinas('org-demo', sem(10), em(10));
    expect(enviados).toHaveLength(0);
    await motor.verificarMaquinas('org-demo', sem(25), em(25));
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ titulo: '8270R - 29 sem sinal', dados: { tipo: 'sem-sinal' } });
  });

  it('combustível baixo avisa abaixo de 20%, só volta a poder avisar depois de passar de 30%, e ignora leitura suspeita', async () => {
    const { motor, enviados } = await montar();
    const com = (pct: number | null, extra: Partial<Maquina> = {}) => [maquina({ status: 'trabalhando', combustivelPct: pct, ...extra })];
    await motor.verificarMaquinas('org-demo', com(25), em(0));
    await motor.verificarMaquinas('org-demo', com(15, { combustivelSuspeito: true }), em(5));
    expect(enviados).toHaveLength(0);
    await motor.verificarMaquinas('org-demo', com(18), em(10));
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ titulo: 'Combustível baixo: 8270R - 29', texto: '8270R - 29 está com 18% de combustível.' });
    // Oscila entre 18% e 22%: segue o mesmo episódio, sem novo aviso.
    await motor.verificarMaquinas('org-demo', com(22), em(15));
    await motor.verificarMaquinas('org-demo', com(19), em(20));
    expect(enviados).toHaveLength(1);
    // Abasteceu (passou de 30%): o episódio fecha. Cair de novo dentro das 2 h não avisa; depois delas, sim.
    await motor.verificarMaquinas('org-demo', com(90), em(30));
    await motor.verificarMaquinas('org-demo', com(15), em(60));
    expect(enviados).toHaveLength(1);
    await motor.verificarMaquinas('org-demo', com(15), em(200));
    expect(enviados).toHaveLength(2);
  });

  it('abaixo de 10% a notificação é de severidade alta', async () => {
    const { motor, repo } = await montar();
    await motor.verificarMaquinas('org-demo', [maquina({ status: 'trabalhando', combustivelPct: 8 })], em(0));
    expect((await repo.listar('org-demo', 5))[0]).toMatchObject({ tipo: 'combustivel-baixo', severidade: 'alta' });
  });

  it('falhas da máquina: só severidade alta e média, não reconhecidas, das últimas 6 h, uma vez cada', async () => {
    const alerta = (id: string, over: Partial<AlertaDaMaquina>): AlertaDaMaquina => ({ id, quando: em(-30).toISOString(), severidade: 'media', descricao: `Falha ${id}`, reconhecido: false, ocorrencias: 1, ...over });
    const { motor, repo, enviados } = await montar([
      alerta('1', {}),
      alerta('2', { severidade: 'alta' }),
      alerta('3', { severidade: 'info' }),
      alerta('4', { reconhecido: true }),
      alerta('5', { severidade: 'baixa' }),
    ]);
    const lista = [maquina({ status: 'trabalhando' }), maquina({ id: '9', nome: 'Sem telemetria', status: 'sem-sinal', telemetriaAtiva: false })];
    await motor.verificarFalhas('org-demo', lista, em(0));
    await motor.verificarFalhas('org-demo', lista, em(10)); // a mesma falha vista de novo: não repete
    expect(enviados.map((e) => e.titulo).sort()).toEqual(['Falha grave: 8270R - 29', 'Falha na 8270R - 29']);
    expect(enviados.every((e) => e.dados.tipo === 'falha-maquina' && e.dados.maquinaId === '7')).toBe(true);
    expect((await repo.listar('org-demo', 10)).map((n) => n.severidade).sort()).toEqual(['alta', 'media']);
  });

  it('um erro da Deere em uma máquina não derruba a rodada', async () => {
    const { motor, enviados } = await montar();
    (motor as unknown as { provedor: { alertasDaMaquina: () => Promise<never> } }).provedor = { alertasDaMaquina: async () => Promise.reject(new Error('403')) };
    await motor.verificarFalhas('org-demo', [maquina({ status: 'trabalhando' })], em(0));
    expect(enviados).toHaveLength(0);
  });
});

describe('NotificacoesService', () => {
  it('guarda a notificação, manda o push para os aparelhos da fazenda e apaga o que o Expo diz estar morto', async () => {
    const db = await montarBanco();
    const dispositivos = new DispositivosRepository(db);
    await dispositivos.registrar('u1', 'org-demo', TOKEN_A, 'ios');
    await dispositivos.registrar('u3', 'org-b', TOKEN_B, 'ios');
    const enviados: string[][] = [];
    const push = { enviar: async (tokens: string[]) => (enviados.push(tokens), { invalidos: [TOKEN_A] }) } as unknown as ExpoPushService;
    const repo = new NotificacoesRepository(db);
    const s = new NotificacoesService(repo, dispositivos, push);
    const nova = { id: 'n1', chave: 'k', tipo: 'sem-sinal' as const, severidade: 'media' as const, maquinaId: '7', maquinaNome: 'M7', titulo: 'T', texto: 'X' };
    expect(await s.emitir('org-demo', nova)).toBe(true);
    expect(await s.emitir('org-demo', nova)).toBe(false); // mesmo id: nem guarda nem manda de novo
    expect(enviados).toEqual([[TOKEN_A]]); // só a fazenda dona, e uma vez
    expect(await dispositivos.tokensDaFazenda('org-demo')).toEqual([]); // o token morto saiu
    expect(await dispositivos.tokensDaFazenda('org-b')).toEqual([TOKEN_B]);
    expect(await s.listar('org-demo', 'u1')).toMatchObject({ naoLidas: 1, itens: [{ id: 'n1' }] });
    await s.marcarLidas('u1');
    expect((await s.listar('org-demo', 'u1')).naoLidas).toBe(0);
  });
});
