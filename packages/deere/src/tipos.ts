/**
 * Tipos "externos": o formato que este pacote entrega ao backend.
 * A tradução para os tipos do contrato (@talhio/shared) é feita no backend,
 * em apps/api/src/integracoes/deere.
 */
export interface MaquinaExterna {
  id: string;
  nome: string;
  categoria: 'tractor' | 'sprayer' | 'combine';
  implemento: string | null;
  /** false quando a máquina não tem modem ou assinatura de telemetria. */
  telemetriaAtiva: boolean;
  modelo: string | null;
  numeroSerie: string | null;
  ano: number | null;
}

/** Últimas medições da máquina. No provedor real, vêm das medições do motor (Machine Measurements). */
export interface MedicoesExternas {
  /** Nível do tanque, de 0 a 100. */
  combustivelPct: number | null;
  /** Horas totais do motor. */
  horimetro: number | null;
  /** Tanque marcando cheio há muito tempo de trabalho: leitura não confiável. */
  combustivelSuspeito?: boolean;
}

/** Uso do dia pela máquina (horas por estado e litros gastos). */
export interface UsoDoDiaExterno {
  trabalhandoH: number;
  ociosoH: number;
  transporteH: number;
  combustivelL: number | null;
  /** Hectares cobertos hoje dentro de talhões com contorno, e fora de todos. */
  areaDentroHa: number;
  areaForaHa: number;
}

export interface PosicaoExterna {
  maquinaId: string;
  lat: number;
  lng: number;
  /** ISO 8601 */
  registradaEm: string;
  velocidadeKmH: number;
  motorLigado: boolean;
  /** Desde quando está parada (ISO 8601), se estiver. */
  paradaDesde: string | null;
}

export interface TalhaoExterno {
  id: string;
  nome: string;
  areaHa: number;
  cultura: string | null;
  /** Anel externo: [lng, lat][] */
  contorno: [number, number][];
}

export interface PlanoExterno {
  talhaoId: string;
  maquinaIds: string[];
  operacao: 'plantio' | 'pulverizacao' | 'adubacao' | 'colheita';
  cultura: string;
  variedade: string;
  sementesPorHa?: number;
}

/** O que a máquina fez hoje. No provedor real, vem das operações de campo e da escala. */
export interface AtividadeExterna {
  horas: number;
  areaHa: number;
  operador: string | null;
}

/** Totais de uma máquina num dia. No provedor real: operações de campo, horas de operação e trajeto. */
export interface AtividadeDiariaExterna {
  horas: number;
  areaHa: number;
  combustivelL: number;
  /** Verdadeiro quando os litros são ESTIMADOS pela queda do nível do tanque (não é o número do motor). */
  combustivelEstimado?: boolean;
  /** "HH:MM" (horário da fazenda) quando os litros do dia contam só a partir dessa leitura: o que veio antes ficou de fora. */
  combustivelDesde?: string;
  /** Litros que têm as horas de motor da MESMA leitura (ISO 15143-3), e essas horas: o L/h sai só desse par. */
  combustivelComHorasL?: number;
  horasMotorLeitura?: number;
  /** Minutos com o motor ligado e a máquina parada. */
  paradoMin: number;
  /** Da área do dia, quanto foi fora de todos os talhões (quando a área vem do caminho da máquina). */
  areaForaDosTalhoesHa?: number;
}

export interface ResumoFazendaExterno {
  nome: string;
  /** Operação em andamento por talhão. */
  operacoesPorTalhao: Record<string, PlanoExterno['operacao']>;
  /** Quanto da operação já foi feito em cada talhão, de 0 a 100. No provedor real, vem da área trabalhada das operações de campo. */
  percentualPorTalhao: Record<string, number>;
  operacaoAtual: { nome: string; percentual: number } | null;
}

/** Linha de guia (linha AB) como vem de fora. */
export interface LinhaExterna {
  id: string;
  nome: string;
  talhaoId: string | null;
  /** [lng, lat] */
  a: [number, number];
  b: [number, number];
  /** Linha padrão da fazenda, reaproveitável entre talhões. */
  padrao: boolean;
  /** Linha curva: cada passada já vem pronta, ponto a ponto ([lng, lat][]). Ausente na reta AB. */
  passadas?: [number, number][][];
}

export interface ResultadoSincronizacao {
  /** Operações lidas e guardadas agora. */
  lidas: number;
  /** Operações cujo export ainda não terminou (ficam para a próxima rodada). */
  esperando: number;
  /** Operações que falharam. */
  falhas: number;
}
