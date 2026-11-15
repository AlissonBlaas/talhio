import { ForbiddenException, Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROTA_PUBLICA, SO_ADMIN, type RequisicaoAutenticada } from './auth.decorators.js';
import { TokenService } from './token.service.js';

export const naoAutenticado = (mensagem = 'Faça login para continuar.') => new UnauthorizedException({ codigo: 'NAO_AUTENTICADO', mensagem });

/** Guarda global: toda rota exige um token de acesso válido, exceto as marcadas com @Publico(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(ROTA_PUBLICA, [contexto.getHandler(), contexto.getClass()])) return true;

    const requisicao = contexto.switchToHttp().getRequest<RequisicaoAutenticada & { headers: Record<string, string | string[] | undefined> }>();
    const cabecalho = requisicao.headers.authorization;
    const [tipo, token] = typeof cabecalho === 'string' ? cabecalho.split(' ') : [];
    const dados = tipo === 'Bearer' && token ? await this.tokens.ler(token) : null;
    if (!dados) throw naoAutenticado();

    if (dados.papel !== 'admin' && this.reflector.getAllAndOverride<boolean>(SO_ADMIN, [contexto.getHandler(), contexto.getClass()])) {
      throw new ForbiddenException({ codigo: 'SEM_PERMISSAO', mensagem: 'Só o administrador da fazenda pode fazer isso.' });
    }

    requisicao.usuario = dados;
    return true;
  }
}
