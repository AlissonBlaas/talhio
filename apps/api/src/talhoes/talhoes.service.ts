import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type { ProvedorMaquinas, ResumoFazendaExterno } from '@talhio/deere';
import { areaHaDoPoligono, NovoTalhaoSchema, type Talhao } from '@talhio/shared';
import type { z } from 'zod';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { paraTalhao } from '../integracoes/deere/mapeadores.js';
import { TalhoesRepository } from './talhoes.repository.js';

/** Menor área aceita para um talhão: evita salvar toque acidental. */
const AREA_MINIMA_HA = 0.1;

@Injectable()
export class TalhoesService {
  constructor(
    @Inject(PROVEDOR_MAQUINAS) private readonly provedor: ProvedorMaquinas,
    @Inject(TalhoesRepository) private readonly repositorio: TalhoesRepository,
  ) {}

  /** Talhões importados do provedor mais os criados no app. */
  async listar(orgId: string): Promise<Talhao[]> {
    const [externos, resumo] = await Promise.all([
      this.provedor.listarTalhoes(orgId),
      // O andamento é um extra: se a Deere falhar nele, os talhões ainda aparecem.
      this.provedor.resumoDaFazenda(orgId).catch((): ResumoFazendaExterno => ({ nome: '', operacoesPorTalhao: {}, percentualPorTalhao: {}, operacaoAtual: null })),
    ]);
    const importados = externos
      // Só sai o que o contrato aceita: um talhão sem área ou com contorno incompleto não pode derrubar a lista no app.
      .filter((externo) => externo.areaHa > 0 && externo.contorno.length >= 4 && externo.nome.trim().length > 0)
      .map((externo) => paraTalhao(externo, resumo.operacoesPorTalhao[externo.id] ?? null, resumo.percentualPorTalhao[externo.id] ?? 0));
    return [...importados, ...(await this.repositorio.listar(orgId))];
  }

  async criar(orgId: string, dados: z.output<typeof NovoTalhaoSchema>): Promise<Talhao> {
    const anel = dados.contorno.coordinates[0] ?? [];
    const primeiro = anel[0];
    const ultimo = anel[anel.length - 1];
    // O contorno é sempre salvo fechado: o último ponto repete o primeiro.
    const fechado = primeiro && ultimo && (primeiro[0] !== ultimo[0] || primeiro[1] !== ultimo[1]) ? [...anel, primeiro] : anel;
    const contorno = { type: 'Polygon' as const, coordinates: [fechado] };

    const areaHa = areaHaDoPoligono(contorno);
    if (areaHa < AREA_MINIMA_HA) {
      throw new BadRequestException({ codigo: 'TALHAO_MUITO_PEQUENO', mensagem: 'O contorno desenhado é pequeno demais para um talhão.' });
    }
    const existentes = await this.listar(orgId);
    if (existentes.some((t) => t.nome.toLowerCase() === dados.nome.toLowerCase())) {
      throw new ConflictException({ codigo: 'TALHAO_NOME_REPETIDO', mensagem: `Já existe um talhão chamado "${dados.nome}".` });
    }

    const talhao: Talhao = {
      id: `t-${randomUUID()}`,
      nome: dados.nome,
      areaHa: Math.round(areaHa * 10) / 10,
      cultura: dados.cultura,
      contorno,
      operacao: null,
      percentualFeito: null,
    };
    await this.repositorio.salvar(orgId, talhao);
    return talhao;
  }
}
