import { Inject, Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { CONFIG, type Config } from '../core/config.js';

export const DURACAO_ACESSO_S = 15 * 60;
const EMISSOR = 'talhio-api';
const PUBLICO = 'talhio-app';

export interface DadosDoToken {
  usuarioId: string;
  orgId: string;
  papel: 'admin' | 'leitura';
}

/** Token de acesso: JWT assinado (HS256), curto, com emissor e público conferidos na leitura. */
@Injectable()
export class TokenService {
  private readonly chave: Uint8Array;

  constructor(@Inject(CONFIG) config: Config) {
    this.chave = new TextEncoder().encode(config.jwtSegredo);
  }

  assinar(dados: DadosDoToken): Promise<string> {
    return new SignJWT({ org: dados.orgId, papel: dados.papel })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(dados.usuarioId)
      .setIssuer(EMISSOR)
      .setAudience(PUBLICO)
      .setIssuedAt()
      .setExpirationTime(`${DURACAO_ACESSO_S}s`)
      .sign(this.chave);
  }

  /** Devolve os dados se o token é nosso, íntegro e está no prazo; senão, null. */
  async ler(token: string): Promise<DadosDoToken | null> {
    try {
      const { payload } = await jwtVerify(token, this.chave, { issuer: EMISSOR, audience: PUBLICO, algorithms: ['HS256'] });
      const papel = payload.papel === 'admin' || payload.papel === 'leitura' ? payload.papel : null;
      return typeof payload.sub === 'string' && typeof payload.org === 'string' && papel ? { usuarioId: payload.sub, orgId: payload.org, papel } : null;
    } catch {
      return null;
    }
  }
}
