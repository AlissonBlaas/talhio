import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { LinhaExterna, ProvedorMaquinas } from '@talhio/deere';
import { direcaoGraus, distanciaM, NovaLinhaSchema, type Linha } from '@talhio/shared';
import type { z } from 'zod';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';
import { LinhasRepository } from './linhas.repository.js';

/** Menor distância entre A e B: abaixo disso a direção não é confiável. */
const DISTANCIA_MINIMA_M = 10;

function paraLinha(externa: LinhaExterna): Linha {
  const a = { lng: externa.a[0], lat: externa.a[1] };
  const b = { lng: externa.b[0], lat: externa.b[1] };
  return { id: externa.id, nome: externa.nome, talhaoId: externa.talhaoId, a, b, direcaoGraus: direcaoGraus(a, b), padraoDaFazenda: externa.padrao,
    tipo: externa.passadas ? 'curva' : 'reta',
    passadas: externa.passadas ?? null,
  };
}

@Injectable()
export class LinhasService {
  constructor(
    @Inject(PROVEDOR_MAQUINAS) private readonly provedor: ProvedorMaquinas,
    @Inject(LinhasRepository) private readonly repositorio: LinhasRepository,
    @Inject(TalhoesService) private readonly talhoes: TalhoesService,
  ) {}

  /** Linhas vindas do provedor mais as criadas no app. */
  async listar(orgId: string): Promise<Linha[]> {
    const externas = await this.provedor.listarLinhas(orgId);
    return [...externas.map(paraLinha), ...(await this.repositorio.listar(orgId))];
  }

  async criar(orgId: string, dados: z.output<typeof NovaLinhaSchema>): Promise<Linha> {
    const talhao = (await this.talhoes.listar(orgId)).find((t) => t.id === dados.talhaoId);
    if (!talhao) throw new NotFoundException({ codigo: 'TALHAO_NAO_ENCONTRADO', mensagem: 'Talhão não encontrado.' });
    if (distanciaM(dados.a, dados.b) < DISTANCIA_MINIMA_M) {
      throw new BadRequestException({ codigo: 'LINHA_MUITO_CURTA', mensagem: 'Os pontos A e B estão perto demais um do outro.' });
    }

    const linha: Linha = {
      id: `l-${randomUUID()}`,
      nome: dados.nome,
      talhaoId: dados.talhaoId,
      a: dados.a,
      b: dados.b,
      direcaoGraus: direcaoGraus(dados.a, dados.b),
      padraoDaFazenda: dados.padraoDaFazenda,
      tipo: 'reta',
      passadas: null,
    };
    await this.repositorio.salvar(orgId, linha);
    // A linha vai para o Operations Center, que entrega aos monitores. O id serve de chave de idempotência.
    await this.provedor.enviarLinha(
      orgId,
      { id: linha.id, nome: linha.nome, talhaoId: linha.talhaoId, a: [linha.a.lng, linha.a.lat], b: [linha.b.lng, linha.b.lat], padrao: linha.padraoDaFazenda },
      linha.id,
    );
    return linha;
  }
}
