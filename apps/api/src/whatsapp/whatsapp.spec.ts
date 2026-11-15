import { Test } from '@nestjs/testing';
import { PedirCodigoSchema, normalizarTelefone } from '@talhio/shared';
import { BANCO } from '../banco/banco.module.js';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import { organizacoes } from '../banco/schema.js';
import type { Banco } from '../banco/banco.js';
import { cifrar, decifrar } from '../shared/cripto.js';
import RedisMock from 'ioredis-mock';
import { ArmazemMemoria, ArmazemRedis } from './armazem-whatsapp.js';
import { candidatos } from './baileys-whatsapp.js';
import { FakeWhatsapp, GRUPOS_DE_EXEMPLO, WhatsappIndisponivel } from './fake-whatsapp.js';
import { WhatsappRepository } from './whatsapp.repository.js';
import { WhatsappService } from './whatsapp.service.js';
import { PROVEDOR_WHATSAPP, type ProvedorWhatsapp } from './whatsapp.tokens.js';

async function montar(provedor: ProvedorWhatsapp) {
  const db = await criarBancoDeTeste();
  const modulo = await Test.createTestingModule({
    providers: [WhatsappRepository, WhatsappService, { provide: BANCO, useValue: db }, { provide: PROVEDOR_WHATSAPP, useValue: provedor }],
  }).compile();
  return { service: modulo.get(WhatsappService), repo: modulo.get(WhatsappRepository), db };
}

describe('telefone', () => {
  it('aceita o número como a pessoa escreve e põe o 55 na frente', () => {
    expect(normalizarTelefone('(47) 99999-0000')).toBe('5547999990000');
    expect(normalizarTelefone('+55 47 99999-0000')).toBe('5547999990000');
    expect(normalizarTelefone('4733330000')).toBe('554733330000');
  });

  it('recusa número curto demais ou com letras sem dígitos', () => {
    expect(PedirCodigoSchema.safeParse({ telefone: '99999-0000' }).success).toBe(false);
    expect(PedirCodigoSchema.safeParse({ telefone: 'abc' }).success).toBe(false);
    expect(PedirCodigoSchema.parse({ telefone: '(47) 99999-0000' }).telefone).toBe('5547999990000');
  });

  it('tenta o celular com e sem o 9 depois do DDD', () => {
    expect(candidatos('5547999990000')).toEqual(['5547999990000', '554799990000']);
    expect(candidatos('554799990000')).toEqual(['554799990000', '5547999990000']);
    expect(candidatos('14155550123')).toEqual(['14155550123']);
  });
});

describe('WhatsappService', () => {
  it('gera o código, espera a pessoa digitar e então fica conectado', async () => {
    const fake = new FakeWhatsapp();
    const { service } = await montar(fake);
    expect((await service.estado('org-demo')).estado).toBe('desconectado');
    const { codigo, telefone } = await service.pedirCodigo('org-demo', '5547999990000');
    expect(codigo).toHaveLength(8);
    expect(telefone).toBe('5547999990000');
    expect((await service.estado('org-demo')).estado).toBe('aguardando-codigo');
    fake.confirmar('org-demo');
    expect(await service.estado('org-demo')).toMatchObject({ estado: 'conectado', numero: '5547999990000' });
  });

  it('só envia com o WhatsApp conectado e devolve erro claro quando não está', async () => {
    const fake = new FakeWhatsapp();
    const { service } = await montar(fake);
    await expect(service.enviarTexto('org-demo', '47999990000', 'oi')).rejects.toMatchObject({ response: { codigo: 'WHATSAPP_NAO_CONECTADO' } });
    await service.pedirCodigo('org-demo', '5547999990000');
    fake.confirmar('org-demo');
    await service.enviarTexto('org-demo', '(47) 98888-1111', 'Escala de hoje');
    expect(fake.enviadas).toEqual([{ orgId: 'org-demo', telefone: '5547988881111', texto: 'Escala de hoje' }]);
  });

  it('o teste vai para o próprio número conectado', async () => {
    const fake = new FakeWhatsapp();
    const { service } = await montar(fake);
    await service.pedirCodigo('org-demo', '5547999990000');
    fake.confirmar('org-demo');
    await service.enviarTeste('org-demo');
    expect(fake.enviadas).toHaveLength(1);
    expect(fake.enviadas[0]?.telefone).toBe('5547999990000');
  });

  it('escolhe o grupo entre os do WhatsApp conectado e manda as notificações para ele', async () => {
    const fake = new FakeWhatsapp();
    const { service } = await montar(fake);
    await expect(service.grupos('org-demo')).rejects.toMatchObject({ response: { codigo: 'WHATSAPP_NAO_CONECTADO' } });
    await service.pedirCodigo('org-demo', '5547999990000');
    fake.confirmar('org-demo');
    expect((await service.estado('org-demo')).grupo).toBeNull();
    await expect(service.notificarGrupo('org-demo', 'oi')).rejects.toMatchObject({ response: { codigo: 'WHATSAPP_SEM_GRUPO' } });
    expect(await service.grupos('org-demo')).toEqual(GRUPOS_DE_EXEMPLO);
    const escolhido = GRUPOS_DE_EXEMPLO[0]!;
    expect((await service.escolherGrupo('org-demo', escolhido.id)).grupo).toEqual({ id: escolhido.id, nome: escolhido.nome });
    await service.notificarGrupo('org-demo', 'Trator parado');
    expect(fake.enviadasNoGrupo).toEqual([{ orgId: 'org-demo', grupoId: escolhido.id, texto: 'Trator parado' }]);
    await service.enviarTeste('org-demo'); // com grupo, o teste vai para o grupo
    expect(fake.enviadasNoGrupo).toHaveLength(2);
    expect(fake.enviadas).toHaveLength(0);
    expect((await service.tirarGrupo('org-demo')).grupo).toBeNull();
  });

  it('recusa um grupo que não está na lista do WhatsApp conectado', async () => {
    const fake = new FakeWhatsapp();
    const { service } = await montar(fake);
    await service.pedirCodigo('org-demo', '5547999990000');
    fake.confirmar('org-demo');
    await expect(service.escolherGrupo('org-demo', '999999999999@g.us')).rejects.toMatchObject({ response: { codigo: 'WHATSAPP_GRUPO_INEXISTENTE' } });
    expect((await service.estado('org-demo')).grupo).toBeNull();
  });

  it('desconectar volta ao começo', async () => {
    const fake = new FakeWhatsapp();
    const { service } = await montar(fake);
    await service.pedirCodigo('org-demo', '5547999990000');
    await service.desconectar('org-demo');
    expect((await service.estado('org-demo')).estado).toBe('desconectado');
  });

  it('servidor sem WhatsApp ligado responde 503 com código estável', async () => {
    const { service } = await montar(new WhatsappIndisponivel());
    expect((await service.estado('org-demo')).estado).toBe('indisponivel');
    await expect(service.pedirCodigo('org-demo', '5547999990000')).rejects.toMatchObject({ response: { codigo: 'WHATSAPP_INDISPONIVEL' } });
  });

  it('falha do provedor vira erro de negócio, sem vazar o motivo interno', async () => {
    const quebrado: ProvedorWhatsapp = { ...new FakeWhatsapp(), estado: async () => ({ estado: 'desconectado', numero: null, conectadoEm: null }), listarGrupos: async () => [], enviarNoGrupo: async () => {}, pedirCodigo: async () => { throw new Error('stack interna'); }, enviarTexto: async () => {}, desconectar: async () => {} };
    const { service } = await montar(quebrado);
    const erro = await service.pedirCodigo('org-demo', '5547999990000').catch((e) => e);
    expect(erro.response).toMatchObject({ codigo: 'WHATSAPP_CODIGO_FALHOU' });
    expect(JSON.stringify(erro.response)).not.toContain('stack interna');
  });
});

describe.each([
  ['Redis', () => new ArmazemRedis(new RedisMock() as never)],
  ['memória', () => new ArmazemMemoria()],
])('armazém de credenciais e chaves (%s)', (_nome, criar) => {
  it('guarda e lê chaves por fazenda, sem misturar', async () => {
    const a = criar();
    await a.gravarChaves('org-1', 'pre-key', new Map([['1', 'a'], ['2', 'b']]));
    await a.gravarChaves('org-2', 'pre-key', new Map([['1', 'x']]));
    expect([...(await a.lerChaves('org-1', 'pre-key', ['1', '2', '3']))].sort()).toEqual([['1', 'a'], ['2', 'b']]);
    expect([...(await a.lerChaves('org-2', 'pre-key', ['1', '2']))]).toEqual([['1', 'x']]);
  });

  it('regravar troca o valor e nulo apaga a chave', async () => {
    const a = criar();
    await a.gravarChaves('org-1', 'session', new Map([['5', 'velho']]));
    await a.gravarChaves('org-1', 'session', new Map<string, string | null>([['5', 'novo'], ['6', 'outro']]));
    expect((await a.lerChaves('org-1', 'session', ['5'])).get('5')).toBe('novo');
    await a.gravarChaves('org-1', 'session', new Map<string, string | null>([['5', null]]));
    expect([...(await a.lerChaves('org-1', 'session', ['5', '6']))]).toEqual([['6', 'outro']]);
  });

  it('apagar leva credenciais e todos os tipos de chave da fazenda, e só dela', async () => {
    const a = criar();
    for (const org of ['org-1', 'org-2']) {
      await a.gravarCredenciais(org, `creds-${org}`);
      await a.gravarChaves(org, 'pre-key', new Map([['1', 'a']]));
      await a.gravarChaves(org, 'sender-key', new Map([['9', 'b']]));
    }
    await a.apagarTudo('org-1');
    expect(await a.lerCredenciais('org-1')).toBeNull();
    expect((await a.lerChaves('org-1', 'pre-key', ['1'])).size + (await a.lerChaves('org-1', 'sender-key', ['9'])).size).toBe(0);
    expect(await a.lerCredenciais('org-2')).toBe('creds-org-2');
    expect((await a.lerChaves('org-2', 'sender-key', ['9'])).get('9')).toBe('b');
  });
});

describe('WhatsappRepository', () => {
  it('só volta sozinha a fazenda que já foi conectada, e apagar tira da lista', async () => {
    const { repo, db } = await montar(new WhatsappIndisponivel());
    await (db as Banco).insert(organizacoes).values({ id: 'org-outra', nome: 'Outra' });
    expect(await repo.pareadas()).toEqual([]);
    await repo.marcarConectado('org-demo', '5547999990000');
    await repo.marcarConectado('org-demo', '5547999990000'); // religar não duplica
    expect(await repo.pareadas()).toEqual(['org-demo']);
    expect((await repo.buscar('org-demo'))?.numero).toBe('5547999990000');
    await repo.apagar('org-demo');
    expect(await repo.pareadas()).toEqual([]);
  });

  it('o que vai ao armazém é cifrado e só abre com a mesma chave', () => {
    const chave = 'k'.repeat(32);
    const guardado = cifrar('{"noiseKey":"segredo"}', chave);
    expect(guardado).not.toContain('segredo');
    expect(decifrar(guardado, chave)).toBe('{"noiseKey":"segredo"}');
    expect(() => decifrar(guardado, 'x'.repeat(32))).toThrow();
  });
});

describe('provedor real (Baileys), sem falar com o WhatsApp', () => {
  it('a API religa as fazendas já conectadas ao subir, e a config exige a chave de cifra', async () => {
    const { carregarConfig } = await import('../core/config.js');
    expect(() => carregarConfig({ NODE_ENV: 'test', WHATSAPP_PROVEDOR: 'baileys' })).toThrow(/WHATSAPP_CRIPTO_CHAVE e REDIS_URL/);
    const config = carregarConfig({ NODE_ENV: 'test', WHATSAPP_PROVEDOR: 'baileys', WHATSAPP_CRIPTO_CHAVE: 'k'.repeat(32), REDIS_URL: 'redis://localhost:6379' });
    const { BaileysWhatsapp } = await import('./baileys-whatsapp.js');
    const { CONFIG } = await import('../core/config.js');
    const db = await criarBancoDeTeste();
    const modulo = await Test.createTestingModule({
      providers: [WhatsappRepository, { provide: BANCO, useValue: db }, { provide: CONFIG, useValue: config }, { provide: PROVEDOR_WHATSAPP, inject: [CONFIG, WhatsappRepository], useFactory: (c: typeof config, r: WhatsappRepository) => new BaileysWhatsapp(c, r, new ArmazemMemoria()) }],
    }).compile();
    const repo = modulo.get(WhatsappRepository);
    const pareadas = vi.spyOn(repo, 'pareadas');
    const app = modulo.createNestApplication();
    await app.init();
    await vi.waitFor(() => expect(pareadas).toHaveBeenCalledTimes(1));
    const provedor = modulo.get<ProvedorWhatsapp>(PROVEDOR_WHATSAPP);
    expect((await provedor.estado('org-demo')).estado).toBe('desconectado');
    await app.close();
  });
});
