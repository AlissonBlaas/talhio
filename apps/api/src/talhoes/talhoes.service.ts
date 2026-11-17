import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ProvedorMaquinas, ResumoFazendaExterno } from '@talhio/deere';
import { areaHaDoPoligono, EditarTalhaoSchema, NovoTalhaoSchema, type Poligono, type Talhao, type TalhaoApagado } from '@talhio/shared';
import type { z } from 'zod';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { paraTalhao } from '../integracoes/deere/mapeadores.js';
import { TalhoesRepository } from './talhoes.repository.js';

/** Menor área aceita para um talhão: evita salvar toque acidental. */
const AREA_MINIMA_HA = 0.1;

@Injectable()
export class TalhoesService {
  private readonly log = new Logger('Talhoes');

  constructor(
    @Inject(PROVEDOR_MAQUINAS) private readonly provedor: ProvedorMaquinas,
    @Inject(TalhoesRepository) private readonly repositorio: TalhoesRepository,
  ) {}

  /** Talhões importados do provedor mais os criados no app. */
  async listar(orgId: string): Promise<Talhao[]> {
    const [externos, resumo, naDeere] = await Promise.all([
      this.provedor.listarTalhoes(orgId),
      // O andamento é um extra: se a Deere falhar nele, os talhões ainda aparecem.
      this.provedor.resumoDaFazenda(orgId).catch((): ResumoFazendaExterno => ({ nome: '', operacoesPorTalhao: {}, percentualPorTalhao: {}, operacaoAtual: null })),
      this.repositorio.naDeere(orgId),
    ]);
    // Talhão desenhado no app e criado também na John Deere volta de lá como outro talhão: fica só o do app, que é
    // o id que as linhas e os planos conhecem.
    const copias = new Set(naDeere.values());
    const importados = externos
      // Só sai o que o contrato aceita: um talhão sem área ou com contorno incompleto não pode derrubar a lista no app.
      .filter((externo) => !copias.has(externo.id) && externo.areaHa > 0 && externo.contorno.length >= 4 && externo.nome.trim().length > 0)
      .map((externo) => paraTalhao(externo, resumo.operacoesPorTalhao[externo.id] ?? null, resumo.percentualPorTalhao[externo.id] ?? 0));
    return [...importados, ...(await this.repositorio.listar(orgId))];
  }

  async criar(orgId: string, dados: z.output<typeof NovoTalhaoSchema>): Promise<Talhao> {
    const { contorno, areaHa } = this.conferirContorno(dados.contorno);
    const fechado = contorno.coordinates[0] ?? [];
    await this.conferirNome(orgId, dados.nome, null);

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
    if (!dados.enviarParaDeere) return { ...talhao, envioDeere: 'nao-pedido' };
    // O talhão JÁ está salvo no Talhio. Criar na John Deere é um extra pedido por quem salvou: se ela recusa
    // (sem permissão de escrita, fora do ar, servidor de demonstração), o talhão continua valendo aqui.
    try {
      if (!this.provedor.enviarTalhao) throw new Error('este servidor não está ligado à John Deere');
      const deereId = await this.provedor.enviarTalhao(orgId, { nome: talhao.nome, contorno: fechado as [number, number][] });
      await this.repositorio.ligarADeere(orgId, talhao.id, deereId);
      return { ...talhao, envioDeere: 'enviado' };
    } catch (erro) {
      this.log.warn(`talhão ${talhao.id} salvo, mas não criado na John Deere: ${erro instanceof Error ? erro.message : String(erro)}`);
      return { ...talhao, envioDeere: 'recusado' };
    }
  }

  /** O contorno como é salvo (sempre fechado) e a área dele. Recusa o que é pequeno demais para ser talhão. */
  private conferirContorno(desenhado: Poligono): { contorno: Poligono; areaHa: number } {
    const anel = desenhado.coordinates[0] ?? [];
    const primeiro = anel[0];
    const ultimo = anel[anel.length - 1];
    // O contorno é sempre salvo fechado: o último ponto repete o primeiro.
    const fechado = primeiro && ultimo && (primeiro[0] !== ultimo[0] || primeiro[1] !== ultimo[1]) ? [...anel, primeiro] : anel;
    const contorno = { type: 'Polygon' as const, coordinates: [fechado] };
    const areaHa = areaHaDoPoligono(contorno);
    if (areaHa < AREA_MINIMA_HA) {
      throw new BadRequestException({ codigo: 'TALHAO_MUITO_PEQUENO', mensagem: 'O contorno desenhado é pequeno demais para um talhão.' });
    }
    return { contorno, areaHa };
  }

  /** Dois talhões com o mesmo nome confundem a escala, o plano e a John Deere. `menosEste` = o próprio talhão, na edição. */
  private async conferirNome(orgId: string, nome: string, menosEste: string | null): Promise<void> {
    const existentes = await this.listar(orgId);
    if (existentes.some((t) => t.id !== menosEste && t.nome.toLowerCase() === nome.toLowerCase())) {
      throw new ConflictException({ codigo: 'TALHAO_NOME_REPETIDO', mensagem: `Já existe um talhão chamado "${nome}".` });
    }
  }

  /** Só o talhão desenhado no app muda pelo app. O que veio da John Deere ou de arquivo é mudado na origem. */
  private async doApp(orgId: string, id: string) {
    const gravado = await this.repositorio.buscar(orgId, id);
    if (gravado) return gravado;
    const externo = (await this.provedor.listarTalhoes(orgId).catch(() => [])).some((t) => t.id === id);
    if (externo) {
      throw new ConflictException({ codigo: 'TALHAO_DE_FORA', mensagem: 'Este talhão veio da John Deere ou de um arquivo importado. Ele é alterado lá, não pelo aplicativo.' });
    }
    throw new NotFoundException({ codigo: 'TALHAO_NAO_ENCONTRADO', mensagem: 'Talhão não encontrado.' });
  }

  /**
   * Muda nome, cultura ou contorno de um talhão desenhado no app (o id não muda: linhas, planos e escala continuam
   * apontando para ele). Com `enviarParaDeere`, o talhão como ficou vai para o Operations Center: se já tem cópia lá,
   * ela recebe o nome e o contorno novos; se não tem, é criada. A John Deere recusar NÃO desfaz a edição.
   */
  async editar(orgId: string, id: string, dados: z.output<typeof EditarTalhaoSchema>): Promise<Talhao> {
    const { talhao: atual, deereId } = await this.doApp(orgId, id);
    const novo: Talhao = { ...atual };
    if (dados.nome !== undefined && dados.nome.toLowerCase() !== atual.nome.toLowerCase()) await this.conferirNome(orgId, dados.nome, id);
    if (dados.nome !== undefined) novo.nome = dados.nome;
    if (dados.cultura !== undefined) novo.cultura = dados.cultura;
    if (dados.contorno) {
      const { contorno, areaHa } = this.conferirContorno(dados.contorno);
      novo.contorno = contorno;
      novo.areaHa = Math.round(areaHa * 10) / 10;
    }
    await this.repositorio.atualizar(orgId, novo);
    if (!dados.enviarParaDeere) return { ...novo, envioDeere: 'nao-pedido' };
    const anel = (novo.contorno.coordinates[0] ?? []) as [number, number][];
    try {
      if (deereId) {
        if (!this.provedor.atualizarTalhao) throw new Error('este servidor não está ligado à John Deere');
        await this.provedor.atualizarTalhao(orgId, deereId, { nome: novo.nome, contorno: anel });
      } else {
        if (!this.provedor.enviarTalhao) throw new Error('este servidor não está ligado à John Deere');
        await this.repositorio.ligarADeere(orgId, id, await this.provedor.enviarTalhao(orgId, { nome: novo.nome, contorno: anel }));
      }
      return { ...novo, naDeere: true, envioDeere: 'enviado' };
    } catch (erro) {
      this.log.warn(`talhão ${id} alterado, mas a John Deere não aceitou a mudança: ${erro instanceof Error ? erro.message : String(erro)}`);
      return { ...novo, envioDeere: 'recusado' };
    }
  }

  /**
   * Apaga um talhão desenhado no app, com as linhas AB dele. Planos e escalas antigos que o citam continuam
   * gravados e passam a mostrar o talhão como ausente. A cópia na John Deere só é mexida se `naDeere` for pedido, e
   * mesmo assim é ARQUIVADA, nunca apagada; o Talhio só arquiva talhão que ele mesmo criou lá.
   */
  async apagar(orgId: string, id: string, naDeere: boolean): Promise<TalhaoApagado> {
    const { deereId } = await this.doApp(orgId, id);
    await this.repositorio.apagar(orgId, id);
    if (!deereId) return { naDeere: 'nao-tinha' };
    if (!naDeere) return { naDeere: 'mantido' };
    try {
      if (!this.provedor.arquivarTalhao) throw new Error('este servidor não está ligado à John Deere');
      await this.provedor.arquivarTalhao(orgId, deereId);
      return { naDeere: 'arquivado' };
    } catch (erro) {
      this.log.warn(`talhão ${id} apagado, mas a cópia ${deereId} não foi arquivada na John Deere: ${erro instanceof Error ? erro.message : String(erro)}`);
      return { naDeere: 'recusado' };
    }
  }

  /**
   * Para onde mandar na John Deere o que é de um talhão (a linha AB): o id dele LÁ. Talhão desenhado no app sem cópia
   * na Deere devolve nulo (não há para onde mandar); talhão que veio da própria Deere usa o id que já tem.
   */
  async idNaDeere(orgId: string, talhaoId: string): Promise<string | null> {
    const copia = (await this.repositorio.naDeere(orgId)).get(talhaoId);
    if (copia) return copia;
    return (await this.repositorio.ids(orgId)).has(talhaoId) ? null : talhaoId;
  }
}
