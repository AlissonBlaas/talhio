import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { DefinirEscalaSchema, EnvioDaEscalaSchema, PedidoDeEscalaSchema, PedidoDeTirarSchema, type Escala } from '@talhio/shared';
import type { z } from 'zod';
import { OrgAtual, SoAdmin } from '../auth/auth.decorators.js';
import { IdSchema, ZodPipe } from '../shared/zod.pipe.js';
import { EscalaService } from './escala.service.js';

type Pedido = z.output<typeof PedidoDeEscalaSchema>;

@Controller('escala')
export class EscalaController {
  constructor(@Inject(EscalaService) private readonly escala: EscalaService) {}

  /** A escala de hoje, ou do dia pedido em `?dia=AAAA-MM-DD`. As outras rotas aceitam o mesmo `?dia=`. */
  @Get()
  deHoje(@OrgAtual() orgId: string, @Query(new ZodPipe(PedidoDeEscalaSchema)) pedido: Pedido): Promise<Escala> {
    return this.escala.deHoje(orgId, undefined, pedido.dia);
  }

  @SoAdmin()
  @Post('maquinas/:maquinaId')
  @HttpCode(200)
  definir(
    @OrgAtual() orgId: string,
    @Param('maquinaId', new ZodPipe(IdSchema)) maquinaId: string,
    @Body(new ZodPipe(DefinirEscalaSchema)) dados: z.output<typeof DefinirEscalaSchema>,
    @Query(new ZodPipe(PedidoDeEscalaSchema)) pedido: Pedido,
  ): Promise<Escala> {
    return this.escala.definir(orgId, maquinaId, dados, undefined, pedido.dia);
  }

  @SoAdmin()
  @Delete('maquinas/:maquinaId')
  tirar(@OrgAtual() orgId: string, @Param('maquinaId', new ZodPipe(IdSchema)) maquinaId: string, @Query(new ZodPipe(PedidoDeTirarSchema)) pedido: z.output<typeof PedidoDeTirarSchema>): Promise<Escala> {
    return this.escala.tirar(orgId, maquinaId, undefined, pedido.dia, pedido.turno);
  }

  /** Confirma de uma vez a escala sugerida do dia (a repetida de ontem ou o operador que a máquina informa). */
  @SoAdmin()
  @Post('confirmar')
  @HttpCode(200)
  confirmar(@OrgAtual() orgId: string, @Query(new ZodPipe(PedidoDeEscalaSchema)) pedido: Pedido): Promise<Escala> {
    return this.escala.confirmar(orgId, undefined, pedido.dia);
  }

  @SoAdmin()
  @Post('envio')
  @HttpCode(200)
  marcarEnviada(@OrgAtual() orgId: string, @Query(new ZodPipe(PedidoDeEscalaSchema)) pedido: Pedido, @Body(new ZodPipe(EnvioDaEscalaSchema)) envio: z.output<typeof EnvioDaEscalaSchema>): Promise<Escala> {
    return this.escala.marcarEnviada(orgId, undefined, pedido.dia, envio.maquinaIds);
  }
}
