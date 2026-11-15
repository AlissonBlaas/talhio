import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

/** Valida e converte a entrada com um schema do contrato (@talhio/shared). */
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(valor: unknown): z.output<S> {
    const r = this.schema.safeParse(valor);
    if (!r.success) {
      throw new BadRequestException({
        codigo: 'ENTRADA_INVALIDA',
        mensagem: r.error.issues[0]?.message ?? 'Dados inválidos',
        campos: r.error.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
      });
    }
    return r.data;
  }
}

/** Identificador vindo na URL: curto e só com letras, números, hífen e sublinhado. */
export const IdSchema = z.string().min(1).max(100).regex(/^[\w-]+$/, 'Identificador inválido');
