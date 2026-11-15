import { Catch, Logger, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { DeereErro } from '@talhio/deere';
import type { Response } from 'express';

const STATUS: Record<DeereErro['codigo'], HttpStatus> = {
  DEERE_LIMITE: HttpStatus.SERVICE_UNAVAILABLE,
  DEERE_TERMOS: HttpStatus.BAD_GATEWAY,
  DEERE_SEM_ACESSO: HttpStatus.BAD_GATEWAY,
  DEERE_NAO_ENCONTRADO: HttpStatus.NOT_FOUND,
  DEERE_ERRO: HttpStatus.BAD_GATEWAY,
};

/** Erro vindo da John Deere vira resposta com `codigo` estável, em vez de um 500 sem explicação. */
@Catch(DeereErro)
export class DeereErroFilter implements ExceptionFilter {
  private readonly log = new Logger('Deere');

  catch(erro: DeereErro, host: ArgumentsHost): void {
    this.log.warn(`${erro.codigo} (${erro.status}) em ${erro.rota ?? '?'}`);
    host.switchToHttp().getResponse<Response>().status(STATUS[erro.codigo]).json({ codigo: erro.codigo, mensagem: erro.message, rota: erro.rota });
  }
}
