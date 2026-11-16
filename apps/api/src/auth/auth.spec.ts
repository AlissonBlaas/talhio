import { SessaoSchema } from '@talhio/shared';
import { Test } from '@nestjs/testing';
import { BANCO } from '../banco/banco.module.js';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import { CONFIG } from '../core/config.js';
import { AuthService } from './auth.service.js';
import { BloqueioService, JANELA_MS, MAX_TENTATIVAS, MAX_TENTATIVAS_NO_TOTAL } from './bloqueio.service.js';
import { conferirSenha, gerarHash } from './senha.js';
import { SessoesRepository } from './sessoes.repository.js';
import { TokenService } from './token.service.js';
import { UsuariosRepository } from './usuarios.repository.js';

const CONFIG_TESTE = { orgId: 'org-demo', jwtSegredo: 'segredo-de-teste-com-mais-de-32-caracteres', adminEmail: 'admin@teste.com', adminSenha: 'senha-de-teste-1', adminNome: 'Admin', cadastroAberto: true };

async function montar(config: typeof CONFIG_TESTE & { cadastroComAprovacao?: boolean; aprovacaoChave?: string } = CONFIG_TESTE) {
  const modulo = await Test.createTestingModule({
    providers: [AuthService, TokenService, UsuariosRepository, SessoesRepository, BloqueioService, { provide: BANCO, useValue: await criarBancoDeTeste() }, { provide: CONFIG, useValue: config }],
  }).compile();
  await modulo.init();
  return { auth: modulo.get(AuthService), tokens: modulo.get(TokenService) };
}

describe('senha', () => {
  it('guarda como hash e confere', async () => {
    const hash = await gerarHash('minha-senha');
    expect(hash).not.toContain('minha-senha');
    expect(await conferirSenha('minha-senha', hash)).toBe(true);
    expect(await conferirSenha('outra', hash)).toBe(false);
    expect(await conferirSenha('minha-senha', 'lixo')).toBe(false);
  });
});

describe('AuthService', () => {
  it('entra com a senha certa e o token carrega usuário e organização', async () => {
    const { auth, tokens } = await montar();
    const sessao = await auth.entrar('admin@teste.com', 'senha-de-teste-1');
    expect(sessao.usuario).toEqual({ id: 'u-admin', nome: 'Admin', email: 'admin@teste.com', orgId: 'org-demo', papel: 'admin' });
    expect(sessao).not.toHaveProperty('usuario.senhaHash');
    expect(await tokens.ler(sessao.tokenAcesso)).toEqual({ usuarioId: 'u-admin', orgId: 'org-demo', papel: 'admin' });
  });

  it('dá o mesmo erro para senha errada e e-mail que não existe', async () => {
    const { auth } = await montar();
    const errada = await auth.entrar('admin@teste.com', 'errada-123').catch((e) => e.getResponse());
    const inexistente = await auth.entrar('ninguem@teste.com', 'errada-123').catch((e) => e.getResponse());
    expect(errada).toEqual({ codigo: 'NAO_AUTENTICADO', mensagem: 'E-mail ou senha incorretos.' });
    expect(inexistente).toEqual(errada);
  });

  it('bloqueia o e-mail depois de 5 senhas erradas, mesmo com a senha certa em seguida', async () => {
    const { auth } = await montar();
    for (let i = 0; i < MAX_TENTATIVAS; i++) await auth.entrar('admin@teste.com', 'errada-123').catch(() => null);
    await expect(auth.entrar('admin@teste.com', 'senha-de-teste-1')).rejects.toMatchObject({ status: 429, response: { codigo: 'MUITAS_TENTATIVAS' } });
  });

  it('renova a sessão uma única vez por token', async () => {
    const { auth } = await montar();
    const primeira = await auth.entrar('admin@teste.com', 'senha-de-teste-1');
    const segunda = await auth.renovar(primeira.tokenRenovacao);
    expect(segunda.tokenRenovacao).not.toBe(primeira.tokenRenovacao);
    await expect(auth.renovar(primeira.tokenRenovacao)).rejects.toMatchObject({ status: 401 });
    await expect(auth.renovar('token-inventado-com-tamanho-suficiente')).rejects.toMatchObject({ status: 401 });
  });

  it('sair invalida o token de renovação', async () => {
    const { auth } = await montar();
    const sessao = await auth.entrar('admin@teste.com', 'senha-de-teste-1');
    await auth.sair(sessao.tokenRenovacao);
    await expect(auth.renovar(sessao.tokenRenovacao)).rejects.toMatchObject({ status: 401 });
  });
});

describe('TokenService', () => {
  it('recusa token adulterado, de outro segredo e lixo', async () => {
    const { tokens } = await montar();
    const outro = (await montar({ ...CONFIG_TESTE, jwtSegredo: 'outro-segredo-tambem-com-mais-de-32-caracteres' })).tokens;
    const token = await tokens.assinar({ usuarioId: 'u1', orgId: 'org-a', papel: 'leitura' });
    expect(await tokens.ler(token.slice(0, -2) + 'xx')).toBeNull();
    expect(await outro.ler(token)).toBeNull();
    expect(await tokens.ler('nao.e.token')).toBeNull();
    // Trocar a organização no corpo do token quebra a assinatura.
    const [cabecalho, , assinatura] = token.split('.');
    const corpoFalso = Buffer.from(JSON.stringify({ sub: 'u1', org: 'org-b', papel: 'admin', iss: 'talhio-api', aud: 'talhio-app', exp: 9999999999 })).toString('base64url');
    expect(await tokens.ler(`${cabecalho}.${corpoFalso}.${assinatura}`)).toBeNull();
  });
});

describe('BloqueioService', () => {
  it('libera depois da janela e ao acertar a senha', () => {
    const bloqueio = new BloqueioService();
    for (let i = 0; i < MAX_TENTATIVAS; i++) bloqueio.registrarFalha('a@b.com', 1000);
    expect(bloqueio.bloqueadoPor('a@b.com', 2000)).toBeGreaterThan(0);
    expect(bloqueio.bloqueadoPor('outro@b.com', 2000)).toBe(0);
    expect(bloqueio.bloqueadoPor('a@b.com', 1000 + JANELA_MS)).toBe(0);
    for (let i = 0; i < MAX_TENTATIVAS; i++) bloqueio.registrarFalha('c@b.com', 1000);
    bloqueio.limpar('c@b.com');
    expect(bloqueio.bloqueadoPor('c@b.com', 2000)).toBe(0);
  });

  it('quem erra de propósito só tranca a si mesmo: o dono entra de outro endereço', () => {
    const bloqueio = new BloqueioService();
    for (let i = 0; i < MAX_TENTATIVAS; i++) bloqueio.registrarFalha('dono@b.com', 1000, '9.9.9.9');
    expect(bloqueio.bloqueadoPor('dono@b.com', 2000, '9.9.9.9')).toBeGreaterThan(0); // o atacante está travado
    expect(bloqueio.bloqueadoPor('dono@b.com', 2000, '1.1.1.1')).toBe(0); // o dono, não
  });

  it('ataque espalhado por muitos endereços bate no teto do e-mail', () => {
    const bloqueio = new BloqueioService();
    for (let i = 0; i < MAX_TENTATIVAS_NO_TOTAL; i++) bloqueio.registrarFalha('alvo@b.com', 1000, `10.0.0.${i}`);
    expect(bloqueio.bloqueadoPor('alvo@b.com', 2000, '1.1.1.1')).toBeGreaterThan(0);
    expect(bloqueio.bloqueadoPor('alvo@b.com', 1000 + JANELA_MS, '1.1.1.1')).toBe(0);
  });

  it('encher a memória com e-mails inventados não apaga um bloqueio recente', () => {
    const bloqueio = new BloqueioService();
    for (let i = 0; i < 25_000; i++) bloqueio.registrarFalha(`lixo${i}@x.com`, 1000, '9.9.9.9');
    for (let i = 0; i < MAX_TENTATIVAS; i++) bloqueio.registrarFalha('dono@b.com', 1500, '9.9.9.9');
    for (let i = 0; i < 500; i++) bloqueio.registrarFalha(`mais${i}@x.com`, 1600, '9.9.9.9');
    expect(bloqueio.bloqueadoPor('dono@b.com', 2000, '9.9.9.9')).toBeGreaterThan(0);
  });
});

describe('persistência', () => {
  it('sessão e talhão continuam no banco depois de "reiniciar" a aplicação', async () => {
    const banco = await criarBancoDeTeste();
    const subir = async () => {
      const modulo = await Test.createTestingModule({
        providers: [AuthService, TokenService, UsuariosRepository, SessoesRepository, BloqueioService, { provide: BANCO, useValue: banco }, { provide: CONFIG, useValue: CONFIG_TESTE }],
      }).compile();
      await modulo.init();
      return modulo.get(AuthService);
    };
    const sessao = await (await subir()).entrar('admin@teste.com', 'senha-de-teste-1');
    // Outra instância, mesmo banco: o token de renovação emitido antes ainda vale.
    const depois = await (await subir()).renovar(sessao.tokenRenovacao);
    expect(depois.usuario.email).toBe('admin@teste.com');
  });
});

describe('cadastro de conta nova', () => {
  const dados = { nome: 'Maria', fazenda: 'Fazenda Boa Safra', email: 'maria@fazenda.com', senha: 'senha-bem-longa' };

  it('cria a fazenda e o administrador e já abre a sessão', async () => {
    const { auth, tokens } = await montar();
    const sessao = SessaoSchema.parse(await auth.cadastrar(dados));
    expect(sessao.usuario).toMatchObject({ nome: 'Maria', email: 'maria@fazenda.com', papel: 'admin' });
    expect(sessao.usuario.orgId).not.toBe('org-demo');
    expect((await tokens.ler(sessao.tokenAcesso))?.orgId).toBe(sessao.usuario.orgId);
    // Depois consegue entrar com o e-mail e a senha.
    expect((await auth.entrar(dados.email, dados.senha)).usuario.id).toBe(sessao.usuario.id);
  });

  it('cada conta nova tem a sua própria fazenda', async () => {
    const { auth } = await montar();
    const a = SessaoSchema.parse(await auth.cadastrar(dados));
    const b = SessaoSchema.parse(await auth.cadastrar({ ...dados, email: 'joao@fazenda.com' }));
    expect(a.usuario.orgId).not.toBe(b.usuario.orgId);
  });

  it('recusa e-mail já usado', async () => {
    const { auth } = await montar();
    await auth.cadastrar(dados);
    const erro = await auth.cadastrar(dados).catch((e) => e.getResponse());
    expect(erro.codigo).toBe('EMAIL_EM_USO');
  });

  it('recusa quando o cadastro está fechado', async () => {
    const { auth } = await montar({ ...CONFIG_TESTE, cadastroAberto: false });
    const erro = await auth.cadastrar(dados).catch((e) => e.getResponse());
    expect(erro.codigo).toBe('CADASTRO_FECHADO');
  });

  describe('com aprovação', () => {
    const CHAVE = 'chave-de-aprovacao-de-teste-123';
    const COM_APROVACAO = { ...CONFIG_TESTE, cadastroComAprovacao: true, aprovacaoChave: CHAVE };

    it('a conta nova fica em análise: não abre sessão e não entra até ser aprovada', async () => {
      const { auth } = await montar(COM_APROVACAO);
      expect(await auth.cadastrar(dados)).toEqual({ aguardandoAprovacao: true });
      const erro = await auth.entrar(dados.email, dados.senha).catch((e) => e.getResponse());
      expect(erro.codigo).toBe('CONTA_AGUARDANDO_APROVACAO');
      // Senha errada continua com a mensagem de sempre: não entrega que a conta existe e está em análise.
      expect((await auth.entrar(dados.email, 'senha-errada-1').catch((e) => e.getResponse())).codigo).not.toBe('CONTA_AGUARDANDO_APROVACAO');

      expect(await auth.pedidos(CHAVE)).toEqual([expect.objectContaining({ nome: 'Maria', email: dados.email, fazenda: dados.fazenda })]);
      await auth.aprovar(CHAVE, dados.email);
      expect(await auth.pedidos(CHAVE)).toEqual([]);
      expect((await auth.entrar(dados.email, dados.senha)).usuario.email).toBe(dados.email);
      // Aprovar de novo, ou um e-mail que não pediu, não acha nada.
      await expect(auth.aprovar(CHAVE, dados.email)).rejects.toMatchObject({ status: 404 });
    });

    it('sem a chave certa (ou sem chave configurada) as rotas de aprovação não respondem', async () => {
      const { auth } = await montar(COM_APROVACAO);
      await auth.cadastrar(dados);
      await expect(auth.pedidos('chave-errada-de-mesmo-tamanho-1234')).rejects.toMatchObject({ status: 404 });
      await expect(auth.pedidos(undefined)).rejects.toMatchObject({ status: 404 });
      await expect(auth.aprovar('x', dados.email)).rejects.toMatchObject({ status: 404 });
      const semChave = (await montar({ ...CONFIG_TESTE, cadastroComAprovacao: true })).auth;
      await expect(semChave.pedidos('')).rejects.toMatchObject({ status: 404 });
    });

    it('o administrador do servidor continua entrando', async () => {
      const { auth } = await montar(COM_APROVACAO);
      expect((await auth.entrar('admin@teste.com', 'senha-de-teste-1')).usuario.papel).toBe('admin');
    });
  });
});
