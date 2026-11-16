import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { MaquinaExterna, PosicaoExterna, ProvedorMaquinas } from '@talhio/deere';
import { turnoDaHora, type AnaliseDaMaquina, type Maquina, type StatusMaquina, type Talhao, type RastroDaMaquina } from '@talhio/shared';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { paraTipoMaquina } from '../integracoes/deere/mapeadores.js';
import { EscalaRepository } from '../escala/escala.repository.js';
import { diaLocal, FUSO } from '../shared/dia.js';
import { pontoNoPoligono } from '../shared/geo.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';
import { LarguraImplementoRepository } from '../integracoes/deere/largura-implemento.repository.js';

type PontoDoDia = { t: number; lng: number; lat: number; kmh: number };
type TempoNoTalhao = { talhaoId: string | null; nome: string; andandoH: number; paradoH: number };

/**
 * Reparte o dia da máquina pelos talhões: para cada ponto do caminho, vê em qual talhão ele cai (ou fora de todos)
 * e soma o tempo até o ponto seguinte, separando andando de parado. Buraco de sinal maior que 5 min não conta.
 */
export function tempoPorTalhao(pontos: PontoDoDia[], talhoes: Pick<Talhao, 'id' | 'nome' | 'contorno'>[]): TempoNoTalhao[] {
  const soma = new Map<string, { talhaoId: string | null; nome: string; andando: number; parado: number }>();
  // Retângulo em volta de cada talhão: descarta de cara o ponto que está longe, sem testar o contorno inteiro.
  const caixas = talhoes.map((t) => {
    const anel = t.contorno.coordinates[0] ?? [];
    const lngs = anel.map((p) => p[0]!);
    const lats = anel.map((p) => p[1]!);
    return { t, minLng: Math.min(...lngs), maxLng: Math.max(...lngs), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
  });
  let ultimo: (typeof caixas)[number] | undefined;
  for (let i = 0; i + 1 < pontos.length; i++) {
    const p = pontos[i]!;
    const ms = pontos[i + 1]!.t - p.t;
    if (ms <= 0 || ms > 5 * 60_000) continue;
    const dentro = (c: (typeof caixas)[number]) => p.lng >= c.minLng && p.lng <= c.maxLng && p.lat >= c.minLat && p.lat <= c.maxLat && pontoNoPoligono({ lat: p.lat, lng: p.lng }, c.t.contorno);
    // O ponto quase sempre está no mesmo talhão do anterior: testa esse primeiro.
    const achado = ultimo && dentro(ultimo) ? ultimo : caixas.find(dentro);
    ultimo = achado;
    const chave = achado?.t.id ?? '';
    const item = soma.get(chave) ?? { talhaoId: achado?.t.id ?? null, nome: achado?.t.nome ?? 'Fora dos talhões', andando: 0, parado: 0 };
    if (p.kmh < 0.5) item.parado += ms;
    else item.andando += ms;
    soma.set(chave, item);
  }
  const h = (ms: number) => Math.round((ms / 3_600_000) * 10) / 10;
  return [...soma.values()]
    .filter((x) => x.andando + x.parado >= 3 * 60_000)
    .sort((a, b) => b.andando + b.parado - (a.andando + a.parado))
    .map((x) => ({ talhaoId: x.talhaoId, nome: x.nome, andandoH: h(x.andando), paradoH: h(x.parado) }));
}

/** Sem dado novo há mais que isso, a máquina é considerada sem sinal. */
export const LIMITE_SEM_SINAL_MS = 15 * 60 * 1000;

export function calcularStatus(
  maquina: Pick<MaquinaExterna, 'telemetriaAtiva'>,
  posicao: PosicaoExterna | null,
  agora: Date,
): StatusMaquina {
  if (!maquina.telemetriaAtiva || !posicao) return 'sem-sinal';
  const idade = agora.getTime() - new Date(posicao.registradaEm).getTime();
  if (idade > LIMITE_SEM_SINAL_MS) return 'sem-sinal';
  return posicao.motorLigado && posicao.velocidadeKmH > 0.5 ? 'trabalhando' : 'parada';
}

@Injectable()
export class MaquinasService {
  constructor(
    @Inject(PROVEDOR_MAQUINAS) private readonly provedor: ProvedorMaquinas,
    @Inject(TalhoesService) private readonly talhoes: TalhoesService,
    @Inject(EscalaRepository) private readonly escalas: EscalaRepository,
    @Inject(LarguraImplementoRepository) private readonly larguras: LarguraImplementoRepository,
  ) {}

  async listar(orgId: string, agora: Date = new Date()): Promise<Maquina[]> {
    const [externas, talhoes, escala, larguras] = await Promise.all([
      this.provedor.listarMaquinas(orgId),
      this.talhoes.listar(orgId),
      this.escalas.doDia(orgId, diaLocal(agora)),
      this.larguras.todas(orgId).catch(() => new Map<string, number>()),
    ]);
    // Quem foi escalado no app vale mais que o operador que a máquina informa.
    // Com a escala por turno, vale quem está no turno de AGORA (ou no dia todo); fora de qualquer turno escalado, o primeiro do dia.
    const turnoAgora = turnoDaHora(Number(new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', hourCycle: 'h23' }).format(agora)));
    const escalado = new Map<string, string>();
    for (const e of escala) if (!escalado.has(e.maquinaId)) escalado.set(e.maquinaId, e.operador);
    for (const e of escala) if (e.turno === 'dia-todo' || e.turno === turnoAgora) escalado.set(e.maquinaId, e.operador);
    return Promise.all(externas.map((externa) => this.montar(orgId, externa, talhoes, agora, escalado.get(externa.id) ?? null, larguras.get(externa.id) ?? null)));
  }

  /** Caminho de hoje das máquinas que deram sinal hoje (as paradas há dias ficam de fora: não há o que desenhar). */
  async rastros(orgId: string, agora: Date = new Date()): Promise<RastroDaMaquina[]> {
    const ler = this.provedor.rastroDeHoje?.bind(this.provedor);
    if (!ler) return [];
    const ativas = (await this.listar(orgId, agora)).filter((m) => agora.getTime() - Date.parse(m.ultimoSinal) < 24 * 3_600_000);
    const lista = await Promise.all(
      ativas.map(async (m) => {
        const trechos = await ler(orgId, m.id).catch(() => []);
        const paradas = (await this.provedor.paradasDeHoje?.(orgId, m.id).catch(() => [])) ?? [];
        return { maquinaId: m.id, trechos, paradas };
      }),
    );
    return lista.filter((r) => r.trechos.length > 0);
  }

  /** Grava a largura do implemento da máquina (nula apaga) e manda refazer os hectares calculados com a largura antiga. */
  async definirLargura(orgId: string, id: string, larguraM: number | null): Promise<Maquina> {
    await this.buscar(orgId, id); // 404 se a máquina não é desta fazenda
    await this.larguras.definir(orgId, id, larguraM);
    await this.provedor.larguraMudou?.(orgId);
    return this.buscar(orgId, id);
  }

  /** Conta por talhão já feita, por máquina: só refaz quando o caminho ganhou pontos ou a lista de talhões mudou. */
  private readonly contasPorTalhao = new Map<string, { pontos: number; talhoes: Talhao[]; resultado: TempoNoTalhao[] }>();

  private porTalhao(orgId: string, maquinaId: string, talhoes: Talhao[]): TempoNoTalhao[] {
    const pontos = this.provedor.caminhoDeHoje?.(orgId, maquinaId) ?? [];
    const chave = `${orgId}/${maquinaId}`;
    const feita = this.contasPorTalhao.get(chave);
    // A lista de pontos cresce a cada 2 s com o trator andando; refazer a conta a cada 30 pontos novos é o bastante.
    if (feita && feita.talhoes === talhoes && pontos.length >= feita.pontos && pontos.length - feita.pontos < 30) return feita.resultado;
    const resultado = tempoPorTalhao(pontos, talhoes);
    this.contasPorTalhao.set(chave, { pontos: pontos.length, talhoes, resultado });
    return resultado;
  }

  /**
   * "Todos os dados" da máquina: as medições do Analisador da Máquina da Deere no período (de a ate; sem datas, hoje).
   * Só de máquina da própria fazenda. Provedor sem essa leitura (demonstração) devolve a lista vazia.
   */
  async analise(orgId: string, id: string, de?: string, ate?: string, agora: Date = new Date()): Promise<AnaliseDaMaquina> {
    // Só de máquina da própria fazenda (a lista do provedor já é a da organização).
    if (!(await this.provedor.listarMaquinas(orgId)).some((m) => m.id === id)) throw new NotFoundException({ codigo: 'MAQUINA_NAO_ENCONTRADA', mensagem: 'Máquina não encontrada' });
    const hoje = diaLocal(agora);
    const fim = ate ?? hoje;
    const inicio = de ?? fim;
    if (inicio > fim) throw new BadRequestException({ codigo: 'PERIODO_INVALIDO', mensagem: 'A data inicial é depois da final.' });
    if (fim > hoje) throw new BadRequestException({ codigo: 'PERIODO_INVALIDO', mensagem: 'Não há dados de dias que ainda não aconteceram.' });
    const dias = Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86_400_000) + 1;
    if (dias > 30) throw new BadRequestException({ codigo: 'PERIODO_LONGO', mensagem: 'Escolha um período de até 30 dias.' });
    if (!this.provedor.analiseDaMaquina) return { maquinaId: id, de: inicio, ate: fim, grupos: [] };
    return this.provedor.analiseDaMaquina(orgId, id, inicio, fim);
  }

  async buscar(orgId: string, id: string): Promise<Maquina> {
    const maquina = (await this.listar(orgId)).find((m) => m.id === id);
    if (!maquina) throw new NotFoundException({ codigo: 'MAQUINA_NAO_ENCONTRADA', mensagem: 'Máquina não encontrada' });
    return maquina;
  }

  private async montar(orgId: string, externa: MaquinaExterna, talhoes: Talhao[], agora: Date, escalado: string | null, larguraImplementoM: number | null): Promise<Maquina> {
    const [posicao, atividade, medicoes] = await Promise.all([
      this.provedor.ultimaPosicao(orgId, externa.id),
      this.provedor.atividadeDoDia(orgId, externa.id),
      this.provedor.medicoes(orgId, externa.id),
    ]);
    // Depois da posição: o uso do dia só é lido para quem deu sinal hoje.
    const uso = (await this.provedor.usoDeHoje?.(orgId, externa.id).catch(() => null)) ?? null;
    // As horas por estado (pelo caminho) e as horas de motor ligado vêm de leituras diferentes. Aqui a conta fecha:
    // o total nunca é menor que a soma dos estados, e o que sobra do total aparece como "sem posição".
    const vistoH = uso ? Math.round((uso.trabalhandoH + uso.ociosoH + uso.transporteH) * 10) / 10 : 0;
    const horasHoje = Math.max(atividade.horas, vistoH);
    const usoHoje = uso ? { ...uso, semPosicaoH: Math.round((horasHoje - vistoH) * 10) / 10, porTalhao: this.porTalhao(orgId, externa.id, talhoes) } : null;
    const status = calcularStatus(externa, posicao, agora);
    const ponto = posicao ? { lat: posicao.lat, lng: posicao.lng } : null;
    const talhao = ponto ? talhoes.find((t) => pontoNoPoligono(ponto, t.contorno)) : undefined;
    return {
      id: externa.id,
      nome: externa.nome,
      tipo: paraTipoMaquina(externa.categoria),
      implemento: externa.implemento,
      operador: escalado ?? atividade.operador,
      status,
      talhaoId: talhao?.id ?? null,
      talhaoNome: talhao?.nome ?? null,
      ultimoSinal: posicao?.registradaEm ?? new Date(0).toISOString(),
      paradaDesde: status === 'parada' ? (posicao?.paradaDesde ?? null) : null,
      posicao: ponto,
      horasHoje,
      areaHojeHa: atividade.areaHa,
      velocidadeKmH: posicao ? posicao.velocidadeKmH : null,
      motorLigado: status !== 'sem-sinal' && (posicao?.motorLigado ?? false),
      combustivelPct: medicoes.combustivelPct,
      combustivelSuspeito: medicoes.combustivelSuspeito ?? false,
      horimetro: medicoes.horimetro,
      modelo: externa.modelo,
      numeroSerie: externa.numeroSerie,
      ano: externa.ano,
      telemetriaAtiva: externa.telemetriaAtiva,
      larguraImplementoM,
      usoHoje,
    };
  }
}
