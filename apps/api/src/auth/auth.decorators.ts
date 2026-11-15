import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { DadosDoToken } from './token.service.js';

export const ROTA_PUBLICA = 'rotaPublica';
/** Marca a rota como aberta. Sem isso, toda rota exige login (ver AuthGuard). */
export const Publico = () => SetMetadata(ROTA_PUBLICA, true);

export const SO_ADMIN = 'soAdmin';
/** Rota que muda dados da fazenda: só para quem tem papel de administrador. */
export const SoAdmin = () => SetMetadata(SO_ADMIN, true);

export interface RequisicaoAutenticada {
  usuario?: DadosDoToken;
}

const usuarioDa = (contexto: ExecutionContext): DadosDoToken => {
  const usuario = contexto.switchToHttp().getRequest<RequisicaoAutenticada>().usuario;
  // Só acontece se alguém usar o decorator numa rota marcada como pública.
  if (!usuario) throw new Error('Rota sem usuário autenticado');
  return usuario;
};

/** Organização (fazenda) do usuário logado. É por ela que todo dado é filtrado. */
export const OrgAtual = createParamDecorator((_dado: unknown, contexto: ExecutionContext): string => usuarioDa(contexto).orgId);
/** Id do usuário logado. */
export const UsuarioAtual = createParamDecorator((_dado: unknown, contexto: ExecutionContext): string => usuarioDa(contexto).usuarioId);
