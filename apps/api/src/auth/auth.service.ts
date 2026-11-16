import { timingSafeEqual } from 'node:crypto';
import { ConflictException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PedidoDeCadastro, ResultadoDoCadastro, Sessao, Usuario } from '@talhio/shared';
import { CONFIG, type Config } from '../core/config.js';
import { naoAutenticado } from './auth.guard.js';
import { BloqueioService } from './bloqueio.service.js';
import { conferirSenha, gerarHash } from './senha.js';
import { SessoesRepository } from './sessoes.repository.js';
import { DURACAO_ACESSO_S, TokenService } from './token.service.js';
import { UsuariosRepository, type UsuarioGuardado } from './usuarios.repository.js';

const DURACAO_RENOVACAO_MS = 30 * 24 * 60 * 60 * 1000;

/** Senha certa, mas a conta ainda não foi aprovada por nós. */
const emAnalise = () => new ForbiddenException({ codigo: 'CONTA_AGUARDANDO_APROVACAO', mensagem: 'Seu cadastro está em análise. Vamos entrar em contato e avisar por e-mail quando a conta for ativada.' });

const publico = ({ id, nome, email, orgId, papel }: UsuarioGuardado): Usuario => ({ id, nome, email, orgId, papel });

@Injectable()
export class AuthService {
  private readonly log = new Logger('Cadastro');

  constructor(
    @Inject(UsuariosRepository) private readonly usuarios: UsuariosRepository,
    @Inject(SessoesRepository) private readonly sessoes: SessoesRepository,
    @Inject(BloqueioService) private readonly bloqueio: BloqueioService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** `origem`: endereço de rede de quem tenta, para a trava de força bruta valer por e-mail E por endereço. */
  async entrar(email: string, senha: string, origem = ''): Promise<Sessao> {
    const faltam = this.bloqueio.bloqueadoPor(email, Date.now(), origem);
    if (faltam > 0) {
      throw new HttpException(
        { codigo: 'MUITAS_TENTATIVAS', mensagem: `Muitas tentativas. Tente de novo em ${Math.ceil(faltam / 60_000)} min.` },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const usuario = await this.usuarios.buscarPorEmail(email);
    // Confere a senha mesmo sem usuário, para o tempo de resposta não revelar se o e-mail existe.
    const senhaCerta = await conferirSenha(senha, usuario?.senhaHash ?? this.usuarios.hashDeIsca);
    if (!usuario || !senhaCerta) {
      this.bloqueio.registrarFalha(email, Date.now(), origem);
      // Mesma mensagem para e-mail inexistente e senha errada.
      throw naoAutenticado('E-mail ou senha incorretos.');
    }

    this.bloqueio.limpar(email, origem);
    // Só depois da senha certa: quem não é o dono da conta não descobre que ela existe nem em que pé está.
    if (!usuario.ativo) throw emAnalise();
    return this.abrirSessao(usuario);
  }

  /**
   * Conta nova: cria a fazenda e o administrador. Com aprovação ligada, a conta nasce parada e a resposta avisa que
   * entraremos em contato; sem ela, já abre a sessão.
   */
  async cadastrar(dados: { nome: string; fazenda: string; email: string; senha: string }): Promise<ResultadoDoCadastro> {
    if (!this.config.cadastroAberto) {
      throw new ForbiddenException({ codigo: 'CADASTRO_FECHADO', mensagem: 'O cadastro está fechado. Peça o acesso a quem administra a fazenda.' });
    }
    const comAprovacao = this.config.cadastroComAprovacao ?? false;
    const usuario = await this.usuarios.criarContaNova({ nome: dados.nome, fazenda: dados.fazenda, email: dados.email, senhaHash: await gerarHash(dados.senha), ativo: !comAprovacao });
    if (!usuario) throw new ConflictException({ codigo: 'EMAIL_EM_USO', mensagem: 'Já existe uma conta com este e-mail. Entre com ela.' });
    if (!comAprovacao) return this.abrirSessao(usuario);
    // Para quem aprova achar no log; a lista completa sai de GET /auth/pedidos.
    this.log.log(`cadastro novo esperando aprovação: ${usuario.email} (${dados.fazenda})`);
    return { aguardandoAprovacao: true };
  }

  /** Troca o token de renovação por uma sessão nova. O token usado deixa de valer. */
  async renovar(tokenRenovacao: string): Promise<Sessao> {
    const usuarioId = await this.sessoes.consumir(tokenRenovacao);
    const usuario = usuarioId ? await this.usuarios.buscarPorId(usuarioId) : null;
    if (!usuario || !usuario.ativo) throw naoAutenticado('Sua sessão expirou. Entre de novo.');
    return this.abrirSessao(usuario);
  }

  /** Cadastros esperando aprovação. Só com a chave de aprovação certa. */
  async pedidos(chave: string | undefined): Promise<PedidoDeCadastro[]> {
    this.exigirChave(chave);
    return this.usuarios.pendentes();
  }

  /** Libera uma conta que estava esperando. A pessoa passa a conseguir entrar; avisar ela é com quem aprovou. */
  async aprovar(chave: string | undefined, email: string): Promise<void> {
    this.exigirChave(chave);
    if (!(await this.usuarios.aprovar(email))) throw new NotFoundException({ codigo: 'PEDIDO_NAO_ENCONTRADO', mensagem: 'Não há cadastro esperando aprovação com esse e-mail.' });
    this.log.log(`cadastro aprovado: ${email}`);
  }

  /** Sem chave configurada as rotas respondem como se não existissem; chave errada também, para não dar pista. */
  private exigirChave(chave: string | undefined): void {
    const certa = this.config.aprovacaoChave;
    const a = Buffer.from(chave ?? '');
    const b = Buffer.from(certa ?? '');
    if (!certa || a.length !== b.length || !timingSafeEqual(a, b)) throw new NotFoundException();
  }

  async sair(tokenRenovacao: string): Promise<void> {
    await this.sessoes.revogar(tokenRenovacao);
  }

  async eu(usuarioId: string): Promise<Usuario> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario) throw naoAutenticado();
    return publico(usuario);
  }

  private async abrirSessao(usuario: UsuarioGuardado): Promise<Sessao> {
    return {
      tokenAcesso: await this.tokens.assinar({ usuarioId: usuario.id, orgId: usuario.orgId, papel: usuario.papel }),
      tokenRenovacao: await this.sessoes.criar(usuario.id, DURACAO_RENOVACAO_MS),
      expiraEmSegundos: DURACAO_ACESSO_S,
      usuario: publico(usuario),
    };
  }
}
