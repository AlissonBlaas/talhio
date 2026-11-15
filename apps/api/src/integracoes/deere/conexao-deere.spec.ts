import { Test } from '@nestjs/testing';
import { BANCO } from '../../banco/banco.module.js';
import { criarBancoDeTeste } from '../../banco/banco-de-teste.js';
import { CONFIG, type Config } from '../../core/config.js';
import { ConexaoDeereRepository } from './conexao-deere.repository.js';
import { ConexaoDeereService } from './conexao-deere.service.js';
import { cifrar, decifrar } from '../../shared/cripto.js';
import { DEERE_HTTP, type Http } from './deere.http.js';

const CHAVE = 'chave-de-teste-com-mais-de-32-caracteres!!';
const config = {
  deereProvedor: 'deere',
  deere: {
    clientId: 'app-id',
    clientSecret: 'segredo-do-app',
    baseUrl: 'https://sandboxapi.deere.com/platform',
    redirectUri: 'https://api.talhio.com.br/v1/deere/callback',
    wellKnown: 'https://login.exemplo/.well-known',
    escopos: 'offline_access ag1 eq1',
    criptoChave: CHAVE,
    appRetorno: 'talhio://deere',
  },
} as unknown as Config;

type Chamada = { url: string; init?: RequestInit };

/** `fetch` simulado: responde pelo endereço e guarda o que foi pedido. */
function http(respostas: Record<string, () => { status?: number; corpo: unknown; cabecalhos?: Record<string, string> }>) {
  const chamadas: Chamada[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, init });
    const achada = Object.entries(respostas).find(([prefixo]) => url.startsWith(prefixo));
    if (!achada) return new Response('{}', { status: 404 });
    const r = achada[1]();
    return new Response(JSON.stringify(r.corpo), { status: r.status ?? 200, headers: r.cabecalhos });
  }) as unknown as Http;
  return { fn, chamadas };
}

const LOGIN = {
  'https://login.exemplo/.well-known': () => ({ corpo: { authorization_endpoint: 'https://login.exemplo/authorize', token_endpoint: 'https://login.exemplo/token' } }),
};

async function montar(respostas: Parameters<typeof http>[0], cfg = config) {
  const rede = http({ ...LOGIN, ...respostas });
  const banco = await criarBancoDeTeste('org-a');
  const modulo = await Test.createTestingModule({
    providers: [ConexaoDeereService, ConexaoDeereRepository, { provide: BANCO, useValue: banco }, { provide: CONFIG, useValue: cfg }, { provide: DEERE_HTTP, useValue: rede.fn }],
  }).compile();
  return { servico: modulo.get(ConexaoDeereService), repo: modulo.get(ConexaoDeereRepository), rede, banco };
}

const estadoDe = (url: string) => new URL(url).searchParams.get('state')!;

describe('cripto', () => {
  it('cifra e decifra, e não deixa o texto à vista', () => {
    const guardado = cifrar('token-secreto', CHAVE);
    expect(guardado).not.toContain('token-secreto');
    expect(decifrar(guardado, CHAVE)).toBe('token-secreto');
  });
  it('falha com chave errada ou texto alterado', () => {
    const guardado = cifrar('token-secreto', CHAVE);
    expect(() => decifrar(guardado, 'outra-chave-com-mais-de-32-caracteres!!')).toThrow();
    expect(() => decifrar(`${guardado.slice(0, -2)}AA`, CHAVE)).toThrow();
  });
});

describe('ConexaoDeereService', () => {
  const token = { corpo: { access_token: 'acesso-1', refresh_token: 'renova-1', expires_in: 43200, scope: 'offline_access ag1 eq1' } };

  it('no modo demonstração não há o que conectar', async () => {
    const { servico } = await montar({}, { ...config, deereProvedor: 'fake' } as Config);
    expect(await servico.estado('org-a')).toEqual({ modo: 'demonstracao', estado: 'pronto', organizacaoNome: null, organizacaoIds: [], conectadoEm: null });
  });

  it('monta o endereço de login com os escopos e um state assinado', async () => {
    const { servico } = await montar({});
    expect(await servico.estado('org-a')).toMatchObject({ modo: 'deere', estado: 'desconectado' });
    const { url } = await servico.iniciar('org-a');
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://login.exemplo/authorize');
    expect(u.searchParams.get('client_id')).toBe('app-id');
    expect(u.searchParams.get('redirect_uri')).toBe(config.deere!.redirectUri);
    expect(u.searchParams.get('scope')).toBe('offline_access ag1 eq1');
    expect(u.searchParams.get('response_type')).toBe('code');
  });

  it('troca o código por tokens, guarda cifrados e volta ao app', async () => {
    const { servico, repo, rede } = await montar({ 'https://login.exemplo/token': () => token });
    const { url } = await servico.iniciar('org-a');
    // A volta do navegador só repassa o código e o state ao app; quem conclui é o app, logado.
    const volta = new URL(servico.voltaDoNavegador({ code: 'cod', state: estadoDe(url) }));
    expect(volta.searchParams.get('codigo')).toBe('cod');
    expect(volta.searchParams.get('estado')).toBe(estadoDe(url));
    expect(await repo.buscar('org-a')).toBeNull();
    await servico.concluir('org-a', { codigo: 'cod', estado: estadoDe(url) });

    const pedido = rede.chamadas.find((c) => c.url.endsWith('/token'))!;
    expect(String(pedido.init?.body)).toContain('grant_type=authorization_code');
    expect(String(pedido.init?.body)).toContain('client_id=app-id');
    expect(String(pedido.init?.body)).toContain('client_secret=segredo-do-app');
    expect((pedido.init?.headers as Record<string, string>).Authorization).toBeUndefined();

    const guardado = (await repo.buscar('org-a'))!;
    expect(guardado.acessoCifrado).not.toContain('acesso-1');
    expect(decifrar(guardado.acessoCifrado, CHAVE)).toBe('acesso-1');
    expect(decifrar(guardado.renovacaoCifrada, CHAVE)).toBe('renova-1');
    expect((await servico.estado('org-a')).estado).toBe('escolher-organizacao');
  });

  it('recusa state forjado, adulterado ou vencido', async () => {
    const { servico, repo } = await montar({ 'https://login.exemplo/token': () => token });
    const { url } = await servico.iniciar('org-a', 1_000);
    const certo = estadoDe(url);
    const [corpo] = certo.split('.');
    const outraOrg = Buffer.from(JSON.stringify({ o: 'org-b', e: 9e15, n: 'x' })).toString('base64url');
    for (const estado of ['lixo', `${corpo}.assinaturafalsa`, `${outraOrg}.${certo.split('.')[1]}`]) {
      await expect(servico.concluir('org-a', { codigo: 'cod', estado }, 1_000)).rejects.toMatchObject({ response: { codigo: 'DEERE_SESSAO_INVALIDA' } });
    }
    await expect(servico.concluir('org-a', { codigo: 'cod', estado: certo }, 1_000 + 11 * 60 * 1000)).rejects.toMatchObject({ response: { codigo: 'DEERE_SESSAO_INVALIDA' } });
    // Link gerado pela fazenda A e concluído por quem está logado na fazenda B: nada é guardado, para nenhuma das duas.
    await expect(servico.concluir('org-b', { codigo: 'cod', estado: certo }, 1_000)).rejects.toMatchObject({ response: { codigo: 'DEERE_PEDIDO_DE_OUTRA_FAZENDA' } });
    expect(await repo.buscar('org-a')).toBeNull();
    expect(await repo.buscar('org-b')).toBeNull();
  });

  it('avisa quando o usuário nega ou a Deere recusa', async () => {
    const { servico } = await montar({ 'https://login.exemplo/token': () => ({ status: 400, corpo: {} }) });
    const { url } = await servico.iniciar('org-a');
    expect(servico.voltaDoNavegador({ error: 'access_denied', state: estadoDe(url) })).toBe('talhio://deere?erro=negado');
    expect(servico.voltaDoNavegador({ state: estadoDe(url) })).toBe('talhio://deere?erro=sessao-invalida');
    await expect(servico.concluir('org-a', { codigo: 'cod', estado: estadoDe(url) })).rejects.toMatchObject({ response: { codigo: 'DEERE_NAO_CONFIRMOU' } });
  });

  it('lista organizações, escolhe uma e acompanha a liberação do acesso', async () => {
    let liberada = false;
    const { servico } = await montar({
      'https://login.exemplo/token': () => token,
      'https://sandboxapi.deere.com/platform/organizations': () => ({
        corpo: { values: [{ id: '111', name: 'Fazenda Boa Safra', links: liberada ? [] : [{ rel: 'connections', uri: 'https://connections.deere.com/x' }] }, { id: '222', name: 'Outra', links: [] }] },
      }),
    });
    await servico.concluir('org-a', { codigo: 'cod', estado: estadoDe((await servico.iniciar('org-a')).url) });

    const lista = await servico.organizacoes('org-a');
    expect(lista[0]).toEqual({ id: '111', nome: 'Fazenda Boa Safra', precisaLiberar: true, urlLiberar: 'https://connections.deere.com/x?redirect_uri=talhio%3A%2F%2Fdeere' });
    expect(lista[1]?.precisaLiberar).toBe(false);

    await expect(servico.escolher('org-a', ['999'])).rejects.toMatchObject({ response: { codigo: 'ORGANIZACAO_INVALIDA' } });
    expect(await servico.escolher('org-a', ['111'])).toMatchObject({ estado: 'liberar-acesso', organizacaoNome: 'Fazenda Boa Safra' });
    expect((await servico.conferirLiberacao('org-a')).estado).toBe('liberar-acesso');
    liberada = true;
    expect((await servico.conferirLiberacao('org-a')).estado).toBe('pronto');

    // Duas organizações juntas: a primeira é a principal.
    expect(await servico.escolher('org-a', ['222', '111'])).toMatchObject({ estado: 'pronto', organizacaoNome: 'Outra + Fazenda Boa Safra', organizacaoIds: ['222', '111'] });
    expect(await servico.organizacoesDaDeere('org-a')).toEqual(['222', '111']);
  });

  it('liga os avisos uma vez só: confere antes, não duplica e religa o que venceu', async () => {
    const assinaturas: Record<string, unknown>[] = [];
    const { servico, rede } = await montar({
      'https://login.exemplo/token': () => token,
      'https://sandboxapi.deere.com/platform/organizations': () => ({ corpo: { values: [{ id: '111', name: 'Fazenda', links: [] }] } }),
      'https://sandboxapi.deere.com/platform/eventSubscriptions': () => ({ corpo: { values: assinaturas } }),
    });
    await servico.concluir('org-a', { codigo: 'cod', estado: estadoDe((await servico.iniciar('org-a')).url) });
    await servico.escolher('org-a', ['111']);
    const enviados = (metodo: string) => rede.chamadas.filter((c) => c.init?.method === metodo && c.url.includes('/eventSubscriptions')).map((c) => JSON.parse(String(c.init?.body)));

    const primeiro = await servico.ativarAviso('org-a');
    expect(primeiro.avisos.map((a) => `${a.evento}:${a.situacao}`)).toEqual(['operationsExport:criado', 'fieldOperation:criado', 'field:criado', 'boundary:criado', 'guidanceLine:criado']);
    const criados = enviados('POST');
    expect(criados[0]).toMatchObject({
      eventTypeId: 'operationsExport',
      targetEndpoint: { targetType: 'https', uri: 'https://api.talhio.com.br/v1/deere/webhook' },
      filters: [{ key: 'orgId', values: ['111'] }, { key: 'clientId', values: ['app-id'] }],
      status: 'Active',
    });
    expect(criados[1].filters).toEqual([{ key: 'orgId', values: ['111'] }]);

    // Já existem na Deere (um deles vencido): nada é criado de novo, e o vencido é religado.
    criados.forEach((c, i) => assinaturas.push({ ...c, id: `id-${i}`, status: i === 2 ? 'Expired' : 'Active' }));
    const segundo = await servico.ativarAviso('org-a');
    expect(segundo).toMatchObject({ novo: false, id: 'id-0', status: 'Active' });
    expect(segundo.avisos.map((a) => a.situacao)).toEqual(['ja-ligado', 'ja-ligado', 'reativado', 'ja-ligado', 'ja-ligado']);
    expect(enviados('POST')).toHaveLength(5);
    expect(enviados('PUT')).toHaveLength(1);
    const linha = (await servico.diagnosticar('org-a')).find((p) => p.passo.startsWith('aviso de export'));
    expect(linha?.total).toBe(4);
  });

  it('renova o token vencido uma única vez, mesmo com várias chamadas juntas', async () => {
    let n = 0;
    const { servico, rede } = await montar({
      'https://login.exemplo/token': () => {
        n++;
        return n === 1 ? token : { corpo: { access_token: 'acesso-2', refresh_token: 'renova-2', expires_in: 43200 } };
      },
    });
    const agora = 1_700_000_000_000;
    await servico.concluir('org-a', { codigo: 'cod', estado: estadoDe((await servico.iniciar('org-a', agora)).url) }, agora);
    expect(await servico.obterToken('org-a', agora)).toBe('acesso-1');

    const depois = agora + 13 * 60 * 60 * 1000;
    const todos = await Promise.all([servico.obterToken('org-a', depois), servico.obterToken('org-a', depois), servico.obterToken('org-a', depois)]);
    expect(todos).toEqual(['acesso-2', 'acesso-2', 'acesso-2']);
    expect(rede.chamadas.filter((c) => String(c.init?.body).includes('refresh_token')).length).toBe(1);
    expect(String(rede.chamadas.at(-1)?.init?.body)).toContain('refresh_token=renova-1');
  });

  it('pede para conectar de novo se a renovação falhar, e sem conexão não dá token', async () => {
    const { servico } = await montar({ 'https://login.exemplo/token': () => ({ status: 400, corpo: {} }) });
    await expect(servico.obterToken('org-a')).rejects.toMatchObject({ response: { codigo: 'DEERE_NAO_CONECTADA' } });
  });

  it('desconectar apaga os tokens só daquela fazenda', async () => {
    const { servico, repo } = await montar({ 'https://login.exemplo/token': () => token });
    await servico.concluir('org-a', { codigo: 'cod', estado: estadoDe((await servico.iniciar('org-a')).url) });
    await servico.desconectar('org-a');
    expect(await repo.buscar('org-a')).toBeNull();
    expect((await servico.estado('org-a')).estado).toBe('desconectado');
  });
});
