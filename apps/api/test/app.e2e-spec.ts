import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PaginaDeConversasSchema, ListaMaquinasSchema, ListaTalhoesSchema, PainelSchema, RelatorioSchema, MaquinaSchema, SessaoSchema, EscalaSchema, PlanoSchema } from '@talhio/shared';
import request from 'supertest';
import { gerarHash } from './../src/auth/senha.js';
import { BANCO } from './../src/banco/banco.module.js';
import type { Banco } from './../src/banco/banco.js';
import { usuarios } from './../src/banco/schema.js';
import { AppModule } from './../src/app.module.js';
import { configurarApp } from './../src/configurar-app.js';

const LOGIN = { email: 'admin@talhio.local', senha: 'talhio-dev-123' };

describe('API (e2e, provedor falso)', () => {
  let app: NestExpressApplication;
  let token: string;
  const http = () => request(app.getHttpServer());
  const comLogin = (teste: request.Test) => teste.set('Authorization', `Bearer ${token}`);

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configurarApp(app);
    await app.init();
    const entrada = await http().post('/v1/auth/entrar').send(LOGIN).expect(200);
    token = SessaoSchema.parse(entrada.body).tokenAcesso;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('conta nova e John Deere', () => {
    it('cadastra fazenda e administrador, que entram e veem só o que é deles', async () => {
      const conta = { nome: 'Maria', fazenda: 'Fazenda Nova', email: 'maria@nova.com', senha: 'senha-bem-longa' };
      const r = await http().post('/v1/auth/cadastrar').send(conta).expect(201);
      const sessao = SessaoSchema.parse(r.body);
      expect(sessao.usuario.orgId).not.toBe(SessaoSchema.parse((await http().post('/v1/auth/entrar').send(LOGIN)).body).usuario.orgId);
      await http().post('/v1/auth/cadastrar').send(conta).expect(409);
      await http().post('/v1/auth/cadastrar').send({ ...conta, senha: 'curta' }).expect(400);
      await http().get('/v1/auth/eu').set('Authorization', `Bearer ${sessao.tokenAcesso}`).expect(200);
    });

    it('no modo demonstração a conexão aparece como pronta e não há login para abrir', async () => {
      const r = await comLogin(http().get('/v1/deere/conexao')).expect(200);
      expect(r.body).toMatchObject({ modo: 'demonstracao', estado: 'pronto' });
      await comLogin(http().post('/v1/deere/conexao/iniciar')).expect(400);
    });

    it('as rotas da conexão exigem login, menos a volta do navegador', async () => {
      await http().get('/v1/deere/conexao').expect(401);
      await http().post('/v1/deere/conexao/iniciar').expect(401);
      await http().get('/v1/deere/organizacoes').expect(401);
      await http().delete('/v1/deere/conexao').expect(401);
      await http().post('/v1/deere/conexao/concluir').send({ codigo: 'x', estado: 'y' }).expect(401);
      // A volta do navegador é aberta e não conclui nada: só repassa ao app, que conclui logado.
      const volta = await http().get('/v1/deere/callback?code=x&state=y');
      expect([302, 400]).toContain(volta.status);
    });
  });

  describe('WhatsApp', () => {
    it('exige login, mostra "indisponível" sem o provedor ligado e valida o número', async () => {
      await http().get('/v1/whatsapp').expect(401);
      await http().post('/v1/whatsapp/codigo').send({ telefone: '47999990000' }).expect(401);
      const r = await comLogin(http().get('/v1/whatsapp')).expect(200);
      expect(r.body).toEqual({ estado: 'indisponivel', numero: null, conectadoEm: null, grupo: null });
      await comLogin(http().post('/v1/whatsapp/codigo')).send({ telefone: '123' }).expect(400);
      const sem = await comLogin(http().post('/v1/whatsapp/codigo')).send({ telefone: '(47) 99999-0000' }).expect(503);
      expect(sem.body).toMatchObject({ codigo: 'WHATSAPP_INDISPONIVEL' });
      await comLogin(http().post('/v1/whatsapp/teste')).expect(422);
      await comLogin(http().get('/v1/whatsapp/grupos')).expect(422);
      await comLogin(http().post('/v1/whatsapp/mensagem')).send({ texto: '' }).expect(400);
      expect((await comLogin(http().post('/v1/whatsapp/mensagem')).send({ texto: 'Escala de hoje' }).expect(422)).body).toMatchObject({ codigo: 'WHATSAPP_NAO_CONECTADO' });
      expect((await comLogin(http().post('/v1/relatorios/dia/envio')).expect(422)).body).toMatchObject({ codigo: 'WHATSAPP_NAO_CONECTADO' });
      await http().post('/v1/relatorios/dia/envio').expect(401);
      await comLogin(http().post('/v1/whatsapp/grupo')).send({ grupoId: 'qualquer coisa' }).expect(400);
    });
  });

  describe('segurança', () => {
    it('saúde é aberta e não revela configuração', async () => {
      const r = await http().get('/v1/saude').expect(200);
      expect(Object.keys(r.body).sort()).toEqual(['hora', 'ok']);
    });

    it('toda rota de dados exige login', async () => {
      for (const rota of ['/v1/maquinas', '/v1/maquinas/m-8r410', '/v1/talhoes', '/v1/linhas', '/v1/painel', '/v1/auth/eu']) {
        const r = await http().get(rota).expect(401);
        expect(r.body.codigo).toBe('NAO_AUTENTICADO');
      }
      await http().post('/v1/talhoes').send({}).expect(401);
      await http().post('/v1/linhas').send({}).expect(401);
      await http().post('/v1/importacoes/gen4').send({}).expect(401);
    });

    it('recusa token inválido e cabeçalho malformado', async () => {
      await http().get('/v1/painel').set('Authorization', 'Bearer abc.def.ghi').expect(401);
      await http().get('/v1/painel').set('Authorization', token).expect(401);
      await http().get('/v1/painel').set('Authorization', `Basic ${token}`).expect(401);
    });

    it('senha errada devolve 401 sem dizer se o e-mail existe', async () => {
      const a = await http().post('/v1/auth/entrar').send({ ...LOGIN, senha: 'errada-123' }).expect(401);
      const b = await http().post('/v1/auth/entrar').send({ email: 'ninguem@talhio.local', senha: 'errada-123' }).expect(401);
      expect(a.body).toEqual(b.body);
    });

    it('limita tentativas de login por endereço de rede', async () => {
      const codigos: number[] = [];
      for (let i = 0; i < 6; i++) codigos.push((await http().post('/v1/auth/entrar').send({ email: `x${i}@talhio.local`, senha: 'errada-123' })).status);
      // O login do beforeEach já contou 1 das 5 por minuto.
      expect(codigos.filter((c) => c === 401)).toHaveLength(4);
      expect(codigos.at(-1)).toBe(429);
    });

    it('valida a entrada do login', async () => {
      const r = await http().post('/v1/auth/entrar').send({ email: 'nao-e-email', senha: '1' }).expect(400);
      expect(r.body.codigo).toBe('ENTRADA_INVALIDA');
    });

    it('renova a sessão e o token antigo de renovação deixa de valer', async () => {
      const entrada = SessaoSchema.parse((await http().post('/v1/auth/entrar').send(LOGIN).expect(200)).body);
      const nova = SessaoSchema.parse((await http().post('/v1/auth/renovar').send({ tokenRenovacao: entrada.tokenRenovacao }).expect(200)).body);
      await http().get('/v1/auth/eu').set('Authorization', `Bearer ${nova.tokenAcesso}`).expect(200);
      await http().post('/v1/auth/renovar').send({ tokenRenovacao: entrada.tokenRenovacao }).expect(401);
      await http().post('/v1/auth/sair').send({ tokenRenovacao: nova.tokenRenovacao }).expect(204);
      await http().post('/v1/auth/renovar').send({ tokenRenovacao: nova.tokenRenovacao }).expect(401);
    });

    it('manda cabeçalhos de segurança e recusa corpo grande fora da importação', async () => {
      const r = await http().get('/v1/saude');
      expect(r.headers['x-powered-by']).toBeUndefined();
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      await comLogin(http().post('/v1/talhoes')).send({ nome: 'x'.repeat(200_000) }).expect(413);
    });

    it('usuário só de leitura consulta, mas não cria nem importa', async () => {
      const db = app.get<Banco>(BANCO);
      await db.insert(usuarios).values({ id: 'u-leitor', orgId: 'org-demo', nome: 'Leitor', email: 'leitor@talhio.local', senhaHash: await gerarHash('senha-do-leitor'), papel: 'leitura' });
      const entrada = await http().post('/v1/auth/entrar').send({ email: 'leitor@talhio.local', senha: 'senha-do-leitor' }).expect(200);
      const leitor = `Bearer ${SessaoSchema.parse(entrada.body).tokenAcesso}`;
      await http().get('/v1/talhoes').set('Authorization', leitor).expect(200);
      for (const rota of ['/v1/talhoes', '/v1/linhas', '/v1/importacoes/gen4']) {
        const r = await http().post(rota).set('Authorization', leitor).send({}).expect(403);
        expect(r.body.codigo).toBe('SEM_PERMISSAO');
      }
    });

    it('recusa identificador estranho na URL', async () => {
      const r = await comLogin(http().get('/v1/maquinas/..%2F..%2Fetc')).expect(400);
      expect(r.body.codigo).toBe('ENTRADA_INVALIDA');
    });
  });

  it('GET /v1/maquinas devolve o contrato', async () => {
    const r = await comLogin(http().get('/v1/maquinas')).expect(200);
    expect(ListaMaquinasSchema.parse(r.body)).toHaveLength(5);
  });

  it('GET /v1/talhoes devolve o contrato', async () => {
    const r = await comLogin(http().get('/v1/talhoes')).expect(200);
    expect(ListaTalhoesSchema.parse(r.body)).toHaveLength(4);
  });

  it('GET /v1/painel devolve o contrato', async () => {
    const r = await comLogin(http().get('/v1/painel')).expect(200);
    const painel = PainelSchema.parse(r.body);
    expect(painel.contagem).toEqual({ trabalhando: 3, parada: 1, semSinal: 1 });
    expect(painel.alerta?.maquinaId).toBe('m-6m195');
  });

  it('POST /v1/talhoes cria e valida', async () => {
    const lado = 1000 / 111_319.49;
    const contorno = { type: 'Polygon', coordinates: [[[0, 0], [lado, 0], [lado, lado], [0, lado], [0, 0]]] };
    const criado = await comLogin(http().post('/v1/talhoes')).send({ nome: 'Baixada', contorno }).expect(201);
    expect(criado.body).toMatchObject({ nome: 'Baixada', operacao: null });
    const lista = await comLogin(http().get('/v1/talhoes')).expect(200);
    expect(ListaTalhoesSchema.parse(lista.body)).toHaveLength(5);
    const invalido = await comLogin(http().post('/v1/talhoes')).send({ nome: '', contorno }).expect(400);
    expect(invalido.body.codigo).toBe('ENTRADA_INVALIDA');
  });

  it('GET /v1/relatorios/:periodo devolve o contrato e recusa período inválido', async () => {
    for (const periodo of ['dia', 'semana', 'mes']) {
      const r = await comLogin(http().get(`/v1/relatorios/${periodo}`)).expect(200);
      expect(RelatorioSchema.parse(r.body).porMaquina).toHaveLength(5);
    }
    await comLogin(http().get('/v1/relatorios/ano')).expect(400);
    await http().get('/v1/relatorios/dia').expect(401);
  });

  it('assistente: exige login, valida a pergunta, avisa IA desligada e protege o histórico', async () => {
    await http().post('/v1/assistente/mensagens').send({ texto: 'Quanto fizemos hoje?' }).expect(401);
    await http().get('/v1/assistente/conversas').expect(401);
    await comLogin(http().post('/v1/assistente/mensagens')).send({ texto: '   ' }).expect(400);
    // Nos testes não há chave de IA.
    const r = await comLogin(http().post('/v1/assistente/mensagens')).send({ texto: 'Quanto fizemos hoje?' }).expect(503);
    expect(r.body.codigo).toBe('IA_NAO_CONFIGURADA');
    const lista = await comLogin(http().get('/v1/assistente/conversas')).expect(200);
    expect(PaginaDeConversasSchema.parse(lista.body)).toEqual({ conversas: [], proximo: null });
    expect((await comLogin(http().get('/v1/assistente/conversas?pular=abc')).expect(400)).body.codigo).toBe('ENTRADA_INVALIDA');
    await comLogin(http().get('/v1/assistente/conversas/c-nao-existe?limite=500')).expect(400);
    await comLogin(http().get('/v1/assistente/conversas/c-nao-existe')).expect(404);
    await comLogin(http().delete('/v1/assistente/conversas/c-nao-existe')).expect(404);
  });

  it('escala: exige login, grava, valida e recusa operador repetido', async () => {
    await http().get('/v1/escala').expect(401);
    const vazia = EscalaSchema.parse((await comLogin(http().get('/v1/escala')).expect(200)).body);
    expect(vazia.itens).toHaveLength(5);

    const gravada = await comLogin(http().post('/v1/escala/maquinas/m-8r410')).send({ operador: ' Rafael ', tarefa: 'Plantio de soja' }).expect(200);
    expect(EscalaSchema.parse(gravada.body).itens.find((i) => i.maquinaId === 'm-8r410')).toMatchObject({ operador: 'Rafael', turno: 'dia-todo', definida: true });

    expect((await comLogin(http().post('/v1/escala/maquinas/m-7r330')).send({ operador: 'Rafael' }).expect(409)).body.codigo).toBe('OPERADOR_JA_ESCALADO');
    expect((await comLogin(http().post('/v1/escala/maquinas/m-7r330')).send({ operador: '' }).expect(400)).body.codigo).toBe('ENTRADA_INVALIDA');
    await comLogin(http().post('/v1/escala/maquinas/nao-existe')).send({ operador: 'Ana' }).expect(404);

    const enviada = await comLogin(http().post('/v1/escala/envio')).expect(200);
    expect(enviada.body.itens.find((i: { maquinaId: string }) => i.maquinaId === 'm-8r410').enviadaEm).toBeTruthy();
    expect((await comLogin(http().get('/v1/escala?dia=2026-12-01')).expect(200)).body.dia).toBe('2026-12-01');
    await comLogin(http().get('/v1/escala?dia=amanha')).expect(400);
    const tirada = await comLogin(http().delete('/v1/escala/maquinas/m-8r410')).expect(200);
    expect(tirada.body.itens.find((i: { maquinaId: string }) => i.maquinaId === 'm-8r410').definida).toBe(false);
  });

  it('planos: exige login, valida o plantio e salva avisando que o envio aguarda a John Deere', async () => {
    await http().get('/v1/planos').expect(401);
    const talhaoId = (await comLogin(http().get('/v1/talhoes')).expect(200)).body[0].id;
    const base = { talhaoIds: [talhaoId], operacao: 'plantio', dataInicio: '2026-11-20', maquinaIds: ['m-8r410'] };
    const incompleto = await comLogin(http().post('/v1/planos')).send(base).expect(400);
    expect(incompleto.body.campos.map((c: { campo: string }) => c.campo)).toEqual(['cultura', 'variedade', 'sementesPorHa']);
    const criado = await comLogin(http().post('/v1/planos')).send({ ...base, cultura: 'Milho', variedade: 'Híbrido de teste', sementesPorHa: 65000 }).expect(201);
    expect(PlanoSchema.parse(criado.body).maquinas[0]).toMatchObject({ id: 'm-8r410', envio: 'aguardando-liberacao' });
    await comLogin(http().post('/v1/planos')).send({ ...base, operacao: 'colheita', maquinaIds: ['nao-existe'] }).expect(422);
    expect((await comLogin(http().get('/v1/planos')).expect(200)).body).toHaveLength(1);
  });

  it('largura do implemento: só o administrador grava, valida o valor, aparece na máquina e pode ser apagada', async () => {
    await http().post('/v1/maquinas/m-7r330/largura').send({ larguraM: 9 }).expect(401);
    await comLogin(http().post('/v1/maquinas/m-7r330/largura').send({ larguraM: 0 })).expect(400);
    await comLogin(http().post('/v1/maquinas/m-7r330/largura').send({ larguraM: 200 })).expect(400);
    await comLogin(http().post('/v1/maquinas/nao-existe/largura').send({ larguraM: 9 })).expect(404);
    const gravada = await comLogin(http().post('/v1/maquinas/m-7r330/largura').send({ larguraM: 9.5 })).expect(200);
    expect(MaquinaSchema.parse(gravada.body).larguraImplementoM).toBe(9.5);
    const lista = await comLogin(http().get('/v1/maquinas')).expect(200);
    expect(lista.body.find((m: { id: string }) => m.id === 'm-7r330').larguraImplementoM).toBe(9.5);
    expect(lista.body.find((m: { id: string }) => m.id === 'm-6m195').larguraImplementoM).toBeNull();
    const apagada = await comLogin(http().post('/v1/maquinas/m-7r330/largura').send({ larguraM: null })).expect(200);
    expect(apagada.body.larguraImplementoM).toBeNull();
  });

  it('GET /v1/maquinas/:id inexistente devolve 404', async () => {
    await comLogin(http().get('/v1/maquinas/nao-existe')).expect(404);
  });
});
