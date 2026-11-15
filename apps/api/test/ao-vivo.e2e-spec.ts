import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { FECHAMENTO_NAO_AUTENTICADO, QuadroDoServidorSchema, SessaoSchema, type QuadroDoServidor } from '@talhio/shared';
import request from 'supertest';
import WebSocket from 'ws';
import { AppModule } from './../src/app.module.js';
import { configurarApp } from './../src/configurar-app.js';

describe('Canal ao vivo (e2e, provedor falso)', () => {
  let app: NestExpressApplication;
  let url: string;
  let token: string;

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configurarApp(app);
    await app.listen(0, '127.0.0.1');
    url = `ws://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/v1/ao-vivo`;
    const entrada = await request(app.getHttpServer()).post('/v1/auth/entrar').send({ email: 'admin@talhio.local', senha: 'talhio-dev-123' }).expect(200);
    token = SessaoSchema.parse(entrada.body).tokenAcesso;
  });

  afterEach(async () => {
    await app.close();
  });

  /** Abre o canal e junta os quadros até `parar` dizer que basta (ou o canal fechar). */
  function conversar(enviar: (ws: WebSocket) => void, parar: (quadros: QuadroDoServidor[]) => boolean): Promise<{ quadros: QuadroDoServidor[]; codigo: number | null }> {
    return new Promise((ok, falhou) => {
      const ws = new WebSocket(url);
      const quadros: QuadroDoServidor[] = [];
      const limite = setTimeout(() => falhou(new Error('Sem resposta do canal')), 8000);
      ws.on('open', () => enviar(ws));
      ws.on('message', (bruto) => {
        quadros.push(QuadroDoServidorSchema.parse(JSON.parse(bruto.toString())));
        if (parar(quadros)) {
          clearTimeout(limite);
          ws.close();
          ok({ quadros, codigo: null });
        }
      });
      ws.on('close', (codigo) => {
        clearTimeout(limite);
        ok({ quadros, codigo });
      });
    });
  }

  it('sem login em 5 s o canal é fechado, e token falso também', async () => {
    const { codigo } = await conversar((ws) => ws.send(JSON.stringify({ tipo: 'auth', token: 'falso' })), () => false);
    expect(codigo).toBe(FECHAMENTO_NAO_AUTENTICADO);
  });

  it('quadro de chat antes do login fecha o canal', async () => {
    const { codigo } = await conversar((ws) => ws.send(JSON.stringify({ tipo: 'chat', id: '1', pergunta: { texto: 'oi' } })), () => false);
    expect(codigo).toBe(FECHAMENTO_NAO_AUTENTICADO);
  });

  it('com token válido entrega "pronto" e as máquinas na hora', async () => {
    const { quadros } = await conversar(
      (ws) => ws.send(JSON.stringify({ tipo: 'auth', token })),
      (q) => q.some((x) => x.tipo === 'maquinas'),
    );
    expect(quadros[0]).toEqual({ tipo: 'pronto' });
    const maquinas = quadros.find((q) => q.tipo === 'maquinas');
    expect(maquinas && maquinas.tipo === 'maquinas' && maquinas.maquinas.length).toBeGreaterThan(0);
  });

  it('a pergunta ao assistente responde pelo canal (sem IA ligada, com o erro claro)', async () => {
    const { quadros } = await conversar(
      (ws) => {
        ws.send(JSON.stringify({ tipo: 'auth', token }));
        ws.send(JSON.stringify({ tipo: 'chat', id: 'p1', pergunta: { texto: 'Como está a fazenda?' } }));
      },
      (q) => q.some((x) => x.tipo === 'chat.fim' || x.tipo === 'chat.erro'),
    );
    const fim = quadros.find((q) => q.tipo === 'chat.erro');
    expect(fim).toMatchObject({ tipo: 'chat.erro', id: 'p1', codigo: 'IA_NAO_CONFIGURADA' });
  });
});
