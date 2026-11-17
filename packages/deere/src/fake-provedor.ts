import { FAZENDA_DEMO, pixelParaLngLat } from './fazenda-demo';
import type { FazendaImportada } from './gen4';
import type { ProvedorMaquinas } from './provedor-maquinas';
import type {
  AtividadeDiariaExterna,
  AtividadeExterna,
  LinhaExterna,
  MaquinaExterna,
  MedicoesExternas,
  PlanoExterno,
  PosicaoExterna,
  ResumoFazendaExterno,
  TalhaoExterno,
} from './tipos';

/** Contorno a partir de pontos em pixels da imagem de satélite (fecha o anel). */
function contorno(pontos: [number, number][]): [number, number][] {
  const anel = pontos.map(([x, y]) => pixelParaLngLat(x, y));
  const primeiro = anel[0];
  return primeiro ? [...anel, primeiro] : anel;
}

/** Área em hectares de um polígono dado em pixels da imagem. */
function areaHa(pontos: [number, number][]): number {
  let soma = 0;
  for (let i = 0; i < pontos.length; i++) {
    const [x1, y1] = pontos[i]!;
    const [x2, y2] = pontos[(i + 1) % pontos.length]!;
    soma += x1 * y2 - x2 * y1;
  }
  return Math.round((Math.abs(soma) / 2) * FAZENDA_DEMO.mpp ** 2) / 10_000;
}

function talhao(id: string, nome: string, cultura: string, pontos: [number, number][]): TalhaoExterno {
  return { id, nome, cultura, areaHa: Math.round(areaHa(pontos)), contorno: contorno(pontos) };
}

// Talhões traçados sobre as divisões reais da imagem de satélite.
const TALHOES: TalhaoExterno[] = [
  talhao('t5', 'Talhão 5', 'Soja', [[605, 185], [832.5, 235], [665, 445], [545, 425]]),
  talhao('t6', 'Talhão 6', 'Soja', [[705, 452.5], [835, 345], [992.5, 377.5], [992.5, 560], [870, 540]]),
  talhao('t7', 'Talhão 7', 'Soja', [[585, 472.5], [865, 550], [760, 1005], [477.5, 940]]),
  talhao('t8', 'Talhão 8', 'Milho', [[875, 555], [1120, 620], [1010, 1077.5], [765, 1010]]),
];

type Estado = 'trabalha' | 'parada' | 'muda';
interface MaquinaFake extends MaquinaExterna {
  estado: Estado;
  /** Posição em pixels da imagem. */
  px: [number, number];
  velocidadeKmH: number;
  atividade: AtividadeExterna;
  medicoes: MedicoesExternas;
}

const MAQUINAS: MaquinaFake[] = [
  { id: 'm-8r410', nome: 'Trator 8R 410', categoria: 'tractor', implemento: 'Plantadeira DB60', telemetriaAtiva: true, modelo: '8R 410', numeroSerie: '1RW8410RJPD012345', ano: 2023, estado: 'trabalha', px: [670, 750], velocidadeKmH: 7.2, atividade: { horas: 5.2, areaHa: 38, operador: 'João' }, medicoes: { combustivelPct: 62, horimetro: 1840 } },
  { id: 'm-7r330', nome: 'Trator 7R 330', categoria: 'tractor', implemento: 'Plantadeira 1113', telemetriaAtiva: true, modelo: '7R 330', numeroSerie: '1RW7330RKND045871', ano: 2022, estado: 'muda', px: [600, 862.5], velocidadeKmH: 0, atividade: { horas: 6.08, areaHa: 41, operador: 'Pedro' }, medicoes: { combustivelPct: 48, horimetro: 2615 } },
  { id: 'm-8r370', nome: 'Trator 8R 370', categoria: 'tractor', implemento: 'Plantadeira DB60', telemetriaAtiva: true, modelo: '8R 370', numeroSerie: '1RW8370RLPD020933', ano: 2023, estado: 'trabalha', px: [737.5, 637.5], velocidadeKmH: 6.8, atividade: { horas: 5.8, areaHa: 44, operador: 'Marcos' }, medicoes: { combustivelPct: 71, horimetro: 1492 } },
  { id: 'm-m4040', nome: 'Pulverizador M4040', categoria: 'sprayer', implemento: 'Barra 36 m', telemetriaAtiva: true, modelo: 'M4040', numeroSerie: '1NW4040MHPF003218', ano: 2021, estado: 'trabalha', px: [687.5, 337.5], velocidadeKmH: 18, atividade: { horas: 4.5, areaHa: 210, operador: 'Carlos' }, medicoes: { combustivelPct: 35, horimetro: 3104 } },
  { id: 'm-6m195', nome: 'Trator 6M 195', categoria: 'tractor', implemento: 'Grade', telemetriaAtiva: true, modelo: '6M 195', numeroSerie: '1L06195MTNB118402', ano: 2020, estado: 'parada', px: [962.5, 287.5], velocidadeKmH: 0, atividade: { horas: 2.17, areaHa: 9, operador: 'Antônio' }, medicoes: { combustivelPct: 83, horimetro: 4276 } },
];

/** Linha padrão a partir de dois pontos em pixels da imagem. */
function linhaPadrao(id: string, nome: string, de: [number, number], ate: [number, number]): LinhaExterna {
  return { id, nome, talhaoId: null, a: pixelParaLngLat(...de), b: pixelParaLngLat(...ate), padrao: true };
}

// Linhas padrão da fazenda de demonstração. A primeira acompanha as linhas de plantio da imagem.
const LINHAS: LinhaExterna[] = [
  linhaPadrao('l-padrao', 'Padrão da fazenda', [600, 900], [650, 700]),
  linhaPadrao('l-leste-oeste', 'Leste-oeste', [600, 700], [800, 750]),
  linhaPadrao('l-terraco', 'Nível do terraço', [600, 800], [770, 710]),
];

const MIN = 60 * 1000;

/** Consumo (L/ha) e minutos parado hoje de cada máquina falsa, para o relatório. */
const RELATORIO: Record<string, { litrosPorHa: number; paradoMin: number }> = {
  'm-8r410': { litrosPorHa: 7.4, paradoMin: 14 },
  'm-7r330': { litrosPorHa: 6.9, paradoMin: 6 },
  'm-8r370': { litrosPorHa: 7.0, paradoMin: 9 },
  'm-m4040': { litrosPorHa: 0.9, paradoMin: 4 },
  'm-6m195': { litrosPorHa: 9.6, paradoMin: 80 },
};

/** Número estável entre 0 e 1 a partir de um texto: o mesmo dia dá sempre o mesmo resultado. */
function sorteio(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

/**
 * Onde cada máquina falsa fica quando a fazenda é real (importada de arquivo): em qual talhão
 * (índice) e em que altura das linhas. `null` = parada fora dos talhões.
 */
const LUGAR_NA_FAZENDA_REAL: Record<string, { talhao: number; ponto: number; atras?: number } | null> = {
  'm-8r410': { talhao: 0, ponto: 0.4 },
  'm-7r330': { talhao: 0, ponto: 0.7, atras: 12 },
  'm-8r370': { talhao: 1, ponto: 0.55 },
  'm-m4040': null,
  'm-6m195': null,
};
/** Andamento simulado do plantio em cada talhão real, por índice. */
const PERCENTUAL_REAL = [68, 35];


/**
 * Provedor de dados falsos, no mesmo formato do provedor real.
 * As posições são fixas e batem com a imagem de satélite de demonstração.
 */
export class FakeProvedor implements ProvedorMaquinas {
  readonly planosEnviados = new Map<string, PlanoExterno>();
  readonly linhasEnviadas = new Map<string, LinhaExterna>();

  /**
   * @param fazenda Talhões e linhas reais lidos de arquivo (ver `lerPastaGen4`). Quando presente,
   * substituem a fazenda de demonstração; máquinas e andamento continuam simulados.
   */
  constructor(
    private readonly agora: () => Date = () => new Date(),
    private fazenda: FazendaImportada | null = null,
  ) {}

  /** [lng, lat] da máquina: sobre as linhas do talhão real, ou no pixel da imagem de demonstração. */
  private posicaoDe(maquina: MaquinaFake): [number, number] {
    if (!this.fazenda) return pixelParaLngLat(...maquina.px);
    const lugar = LUGAR_NA_FAZENDA_REAL[maquina.id];
    const talhao = lugar ? this.fazenda.talhoes[lugar.talhao] : undefined;
    const passadas = talhao ? (this.fazenda.linhas.find((l) => l.talhaoId === talhao.id)?.passadas ?? []) : [];
    if (lugar && passadas.length > 0) {
      // Na frente de trabalho: a primeira passada ainda não feita (ou algumas atrás dela).
      const frente = Math.round((passadas.length * (PERCENTUAL_REAL[lugar.talhao] ?? 0)) / 100) - (lugar.atras ?? 0);
      const passada = passadas[Math.min(passadas.length - 1, Math.max(0, frente))]!;
      return passada[Math.min(passada.length - 1, Math.floor(passada.length * lugar.ponto))]!;
    }
    // Fora dos talhões: no canto do primeiro contorno, afastada um pouco para fora.
    const anel = this.fazenda.talhoes[0]?.contorno ?? [];
    const oeste = Math.min(...anel.map((p) => p[0]));
    const sul = Math.min(...anel.map((p) => p[1]));
    const deslocamento = maquina.id === 'm-m4040' ? 0.0004 : 0.0009;
    return [oeste - deslocamento, sul - 0.0003];
  }

  async listarMaquinas(): Promise<MaquinaExterna[]> {
    return MAQUINAS.map(({ id, nome, categoria, implemento, telemetriaAtiva, modelo, numeroSerie, ano }) => ({ id, nome, categoria, implemento, telemetriaAtiva, modelo, numeroSerie, ano }));
  }

  async listarTalhoes(): Promise<TalhaoExterno[]> {
    return this.fazenda?.talhoes ?? TALHOES;
  }

  async ultimaPosicao(_orgId: string, maquinaId: string): Promise<PosicaoExterna | null> {
    const maquina = MAQUINAS.find((m) => m.id === maquinaId);
    if (!maquina) return null;
    const agora = this.agora().getTime();
    const [lng, lat] = this.posicaoDe(maquina);
    const base = { maquinaId, lat, lng, velocidadeKmH: maquina.velocidadeKmH };

    if (maquina.estado === 'muda') {
      // Sem sinal: o último dado chegou há 3 horas.
      return { ...base, registradaEm: new Date(agora - 180 * MIN).toISOString(), motorLigado: false, paradaDesde: null };
    }
    if (maquina.estado === 'parada') {
      // Parada no carreador há 1h20, com o motor desligado.
      return { ...base, registradaEm: new Date(agora).toISOString(), motorLigado: false, paradaDesde: new Date(agora - 80 * MIN).toISOString() };
    }
    return { ...base, registradaEm: new Date(agora).toISOString(), motorLigado: true, paradaDesde: null };
  }

  async medicoes(_orgId: string, maquinaId: string): Promise<MedicoesExternas> {
    return MAQUINAS.find((m) => m.id === maquinaId)?.medicoes ?? { combustivelPct: null, horimetro: null };
  }

  async atividadeDoDia(_orgId: string, maquinaId: string): Promise<AtividadeExterna> {
    return MAQUINAS.find((m) => m.id === maquinaId)?.atividade ?? { horas: 0, areaHa: 0, operador: null };
  }

  async atividadeNoDia(_orgId: string, maquinaId: string, dia: string): Promise<AtividadeDiariaExterna> {
    const maquina = MAQUINAS.find((m) => m.id === maquinaId);
    const extra = RELATORIO[maquinaId];
    if (!maquina || !extra) return { horas: 0, areaHa: 0, combustivelL: 0, paradoMin: 0 };
    const hoje = this.agora().toISOString().slice(0, 10);
    if (dia > hoje) return { horas: 0, areaHa: 0, combustivelL: 0, paradoMin: 0 };
    // Hoje bate com o que as outras telas mostram; os dias anteriores variam em torno disso.
    const fator = dia === hoje ? 1 : 0.8 + sorteio(`${maquinaId}|${dia}`) * 0.35;
    const areaHa = Math.round(maquina.atividade.areaHa * fator * 10) / 10;
    return {
      horas: Math.round(maquina.atividade.horas * fator * 100) / 100,
      areaHa,
      combustivelL: Math.round(areaHa * extra.litrosPorHa * (dia === hoje ? 1 : 0.95 + sorteio(`${dia}|${maquinaId}`) * 0.12)),
      paradoMin: dia === hoje ? extra.paradoMin : Math.round(5 + sorteio(`p|${maquinaId}|${dia}`) * 40),
    };
  }

  async resumoDaFazenda(): Promise<ResumoFazendaExterno> {
    if (this.fazenda) {
      const ids = this.fazenda.talhoes.map((t) => t.id).slice(0, PERCENTUAL_REAL.length);
      return {
        nome: this.fazenda.cliente,
        operacoesPorTalhao: Object.fromEntries(ids.map((id) => [id, 'plantio' as const])),
        percentualPorTalhao: Object.fromEntries(ids.map((id, i) => [id, PERCENTUAL_REAL[i]!])),
        operacaoAtual: { nome: 'Plantio', percentual: Math.round(PERCENTUAL_REAL.slice(0, ids.length).reduce((s, p) => s + p, 0) / Math.max(1, ids.length)) },
      };
    }
    return {
      nome: FAZENDA_DEMO.nome,
      operacoesPorTalhao: { t5: 'pulverizacao', t7: 'plantio' },
      percentualPorTalhao: { t5: 42, t7: 68 },
      operacaoAtual: { nome: 'Plantio da soja', percentual: 68 },
    };
  }

  async listarLinhas(): Promise<LinhaExterna[]> {
    return this.fazenda?.linhas ?? LINHAS;
  }

  async enviarLinha(_orgId: string, linha: LinhaExterna, chaveIdempotencia: string): Promise<void> {
    if (!this.linhasEnviadas.has(chaveIdempotencia)) {
      this.linhasEnviadas.set(chaveIdempotencia, linha);
    }
  }

  /** Talhões "criados na conta": só guarda, para os testes conferirem. */
  readonly talhoesEnviados: { id: string; nome: string }[] = [];

  async enviarTalhao(_orgId: string, talhao: { nome: string; contorno: [number, number][] }): Promise<string> {
    const ja = this.talhoesEnviados.find((t) => t.nome.toLowerCase() === talhao.nome.toLowerCase());
    if (ja) return ja.id;
    const id = `campo-${this.talhoesEnviados.length + 1}`;
    this.talhoesEnviados.push({ id, nome: talhao.nome });
    return id;
  }

  /** O que foi mandado de novo para um talhão já criado na conta, para os testes conferirem. */
  readonly talhoesAtualizados: { id: string; nome: string; cantos: number }[] = [];

  async atualizarTalhao(_orgId: string, deereId: string, talhao: { nome: string; contorno: [number, number][] }): Promise<void> {
    const ja = this.talhoesEnviados.find((t) => t.id === deereId);
    if (!ja) throw new Error(`talhão ${deereId} não existe na conta`);
    ja.nome = talhao.nome;
    this.talhoesAtualizados.push({ id: deereId, nome: talhao.nome, cantos: talhao.contorno.length });
  }

  /** Talhões arquivados na conta. */
  readonly talhoesArquivados: string[] = [];

  async arquivarTalhao(_orgId: string, deereId: string): Promise<void> {
    const i = this.talhoesEnviados.findIndex((t) => t.id === deereId);
    if (i < 0) throw new Error(`talhão ${deereId} não existe na conta`);
    this.talhoesEnviados.splice(i, 1);
    this.talhoesArquivados.push(deereId);
  }

  async importarFazenda(_orgId: string, fazenda: FazendaImportada): Promise<void> {
    // Substitui a fazenda atual (a de demonstração ou a importada antes).
    this.fazenda = fazenda;
  }

  async enviarPlano(_orgId: string, plano: PlanoExterno, chaveIdempotencia: string): Promise<void> {
    // Idempotente: repetir a mesma chave não cria um segundo plano.
    if (!this.planosEnviados.has(chaveIdempotencia)) {
      this.planosEnviados.set(chaveIdempotencia, plano);
    }
  }
}
