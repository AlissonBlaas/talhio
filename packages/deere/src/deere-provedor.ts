import { ClienteDeere, DeereErro } from './deere-cliente';
import { lerExportacao, resumoDoExport, type DiaDeMaquina } from './exportacao';
import { acharIdsDeMedicao, lerConsumoDiario, type ConsumoDoDia } from './medicoes';
import { lerAlertas, type AlertaDaMaquina } from './alertas';
import { lerAnaliseDaMaquina, type AnaliseDaMaquina } from './medicoes-analise';
import {
  areaDaMedicao,
  fatiaDoDia,
  inicioDoDia,
  linhaDe,
  medicaoEscolhida,
  operacaoDe,
  operadorDaOperacao,
  type LinhaDeere,
  type MedicaoDeOperacaoDeere,
  type OperacaoDeere,
  campoParaEnviar,
  contornoParaEnviar,
  linhaParaEnviar,
  limiteAtivo,
  maquinaDe,
  medicoesDe,
  posicaoDe,
  contornoDe,
  talhaoDe,
  velocidadeKmHDe,
  combustivelPctDe,
  type CampoDeere,
  type EquipamentoDeere,
  type EstadoDoAparelhoDeere,
  type HorasDoMotorDeere,
  type LimiteDeere,
  type PontoDeere,
} from './deere-mapeadores';
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
  ResultadoSincronizacao,
  ResumoFazendaExterno,
  TalhaoExterno,
  UsoDoDiaExterno,
} from './tipos';

/** O que o provedor precisa do banco para guardar o que lê dos exports. Quem implementa filtra tudo por orgId. */
export interface ArmazemAtividade {
  /** Versão (fim + modificação) com que cada operação foi lida pela última vez. */
  versoes(orgId: string): Promise<Map<string, string>>;
  guardar(orgId: string, operacaoId: string, versao: string, dias: DiaDeMaquina[]): Promise<void>;
  /** Totais guardados da máquina no dia, somando as operações; nulo se nada foi lido para aquele dia. */
  buscar(orgId: string, maquinaId: string, dia: string): Promise<DiaDeMaquina | null>;
}

/** Fechamento de um dia de uma máquina, calculado do caminho que ela fez (Breadcrumbs). */
export interface UsoDoDiaGuardado {
  trabalhandoH: number;
  ociosoH: number;
  transporteH: number;
  /** Hectares estimados pelo caminho, dentro e fora dos talhões. */
  areaHa: number;
  /** Quanto desses hectares foi fora de todos os talhões. */
  areaForaHa: number;
  /** Quantas paradas de 2 min ou mais. */
  paradas: number;
  porTalhao: { talhaoId: string | null; nome: string; andandoH: number; paradoH: number }[];
  /** Quantos pontos do caminho a Deere devolveu (0 = a máquina não trabalhou no dia). */
  pontos: number;
  /** Litros gastos no dia, pela queda do nível do tanque. Nulo sem leitura confiável ou sem a capacidade do tanque. */
  combustivelL: number | null;
}

/** Onde os fechamentos diários ficam guardados (o banco do Talhio). */
export interface ArmazemDeUso {
  buscar(orgId: string, maquinaId: string, dia: string): Promise<UsoDoDiaGuardado | null>;
  /** Dias já fechados da fazenda, como "maquinaId|AAAA-MM-DD". */
  fechados(orgId: string): Promise<Set<string>>;
  guardar(orgId: string, maquinaId: string, dia: string, uso: UsoDoDiaGuardado): Promise<void>;
  /** Apaga os fechamentos da fazenda, para serem refeitos (os talhões mudaram). */
  limpar?(orgId: string): Promise<void>;
}

/** Área e horas de uma máquina num dia, tiradas das operações de campo da John Deere. */
export interface AreaDoDia {
  maquinaId: string;
  /** AAAA-MM-DD, horário de Brasília. */
  dia: string;
  areaHa: number;
  horas: number;
}

/** Onde fica guardada a área por máquina e dia lida das operações de campo (meses passados inclusive). */
export interface ArmazemDeArea {
  buscar(orgId: string, maquinaId: string, dia: string): Promise<{ areaHa: number; horas: number } | null>;
}

/**
 * Leituras do combustível ACUMULADO de cada máquina (litros que o motor já gastou na vida, pela ISO 15143-3). É o
 * mesmo número do monitor. Guardando a última leitura de cada dia, os litros de um dia são a diferença entre a
 * última leitura dele e a última do dia anterior: conta exata, sem estimativa.
 */
export interface ArmazemDeCombustivel {
  guardar(orgId: string, dia: string, leituras: { serie: string; litros: number; horasMotor?: number | null; litrosEm?: Date | null; horasEm?: Date | null }[]): Promise<void>;
  /** Horas dos contadores (da Deere) das leituras do dia. Sem elas não dá para saber se litro e horas são do mesmo momento. */
  tempos?(orgId: string, serie: string, dia: string): Promise<TemposDaLeitura | null>;
  /** Última leitura do acumulado vista no dia, ou nulo se não houve. */
  buscar(orgId: string, serie: string, dia: string): Promise<number | null>;
  /** Primeira leitura do dia e a hora dela. Serve de base do dia quando não há a última leitura de ontem. */
  primeira?(orgId: string, serie: string, dia: string): Promise<{ litros: number; em: Date; horasMotor: number | null } | null>;
  /** Horas de motor acumuladas (ISO) da última leitura do dia: o L/h usa as horas da MESMA leitura do combustível. */
  buscarHoras?(orgId: string, serie: string, dia: string): Promise<number | null>;
  /** Consumo do dia importado do Operations Center (litros e horas de motor do mesmo dia), se houver. */
  importado?(orgId: string, maquinaId: string, dia: string): Promise<{ litros: number; horasMotor: number | null; horasOcioso?: number | null } | null>;
}

/** Uma leitura da frota (ISO 15143-3): combustível e horas de motor acumulados, lidos juntos. */
export interface LeituraDaFrota {
  litros: number;
  horasMotor: number | null;
  /** Hora em que a máquina reportou cada contador (atributo `datetime` da Deere). O combustível e as horas NÃO vêm do mesmo instante. */
  litrosEm: Date | null;
  horasEm: Date | null;
}

/** As horas em que foram lidos os contadores de um dia: da última leitura e da primeira. */
export interface TemposDaLeitura {
  litrosEm: Date | null;
  horasEm: Date | null;
  primeiraLitrosEm: Date | null;
  primeiraHorasEm: Date | null;
}

export interface DeereConfig {
  clientId: string;
  clientSecret: string;
  /** Sandbox ou produção. */
  baseUrl: string;
  /** Raiz da Equipment API (lista de máquinas), que não fica em /platform. */
  equipamentosUrl?: string;
  /** Devolve um access token válido para a organização (renovação fica no backend). */
  obterToken: (orgId: string) => Promise<string>;
  /** Id da organização no Operations Center escolhida pela fazenda (nosso orgId -> id da John Deere). */
  obterOrganizacao: (orgId: string) => Promise<string>;
  /** Todas as organizações em uso (a principal primeiro). Sem isso, só a principal. Máquinas e talhões são lidos de todas. */
  obterOrganizacoes?: (orgId: string) => Promise<string[]>;
  /** Onde o resultado dos exports fica guardado (o banco do Talhio). Sem isso, não há sincronização. */
  armazem?: ArmazemAtividade;
  /** Largura do implemento que o administrador informou para cada máquina, em metros (id da máquina -> largura). */
  obterLarguras?: (orgId: string) => Promise<Map<string, number>>;
  /** Fechamento diário pelo caminho (dias passados). Sem isso, só o dia de hoje tem trajeto. */
  diario?: ArmazemDeUso;
  /** Área por máquina e dia já lida das operações de campo e guardada no banco. É o que dá área a meses antigos. */
  areas?: ArmazemDeArea;
  /** Onde ficam as leituras do combustível acumulado do motor. Sem isto, o relatório só tem litros quando o export os traz. */
  combustivel?: ArmazemDeCombustivel;
  /**
   * Liga a ESTIMATIVA dos litros pela queda do nível do tanque quando o motor não informa. Desligada por padrão:
   * o sensor do tanque não bate com o monitor, e número de combustível que não é exato não entra no relatório.
   */
  combustivelPeloTanque?: boolean;
  /** Só para testes. */
  http?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  /** Raiz da API ISO 15143-3 (AEMP 2.0): combustível gasto e horas ociosas acumulados por máquina. */
  aempUrl?: string;
  /** Uma linha de log por chamada à John Deere (ver `ClienteDeereConfig.registrar`). */
  registrar?: (linha: string) => void;
}

const ROTULO = { plantio: 'Plantio', pulverizacao: 'Pulverização', adubacao: 'Adubação', colheita: 'Colheita' } as const;

/** Muda quando a operação muda (fim ou modificação): é o que decide reler o export. */
const versaoDe = (op: OperacaoDeere): string => `${op.endDate ?? ''}|${op.modifiedTime ?? ''}`;

/** Hoje (AAAA-MM-DD) no fuso da fazenda. */
export type PontoDoCaminho = { t: number; lng: number; lat: number; kmh: number; estado: string; /** Nível do tanque no ponto, de 0 a 100, quando a máquina informa. */ tanque?: number | null };

/** Estado que a Deere informa no ponto (`machineState.rawState`), como texto; "?" quando não vem. */
function estadoBrutoDe(p: PontoDeere): string {
  const e = (p as { machineState?: unknown }).machineState;
  if (e && typeof e === 'object') {
    const o = e as { rawState?: unknown; name?: unknown; state?: unknown };
    return String(o.rawState ?? o.name ?? o.state ?? '?');
  }
  return e === undefined || e === null ? '?' : String(e);
}

/**
 * Capacidade do tanque de combustível, em litros, por modelo (ficha técnica do fabricante). É o que transforma a
 * queda do nível (%) em litros. Modelo fora da lista não tem estimativa por esse caminho.
 */
const TANQUE_L: Record<string, number> = {
  '8270R': 680,
  '6150J': 300,
  // Colheitadeiras e motoniveladora da frota (paradas fora da colheita, mas já ficam prontas).
  S550: 757,
  S760: 950,
  '620G': 417,
};

export function capacidadeDoTanqueL(modelo: string | null | undefined): number | null {
  const chave = (modelo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return TANQUE_L[chave] ?? null;
}

/** Capacidade do tanque da máquina: pelo modelo e, se a Deere não informar o modelo, pelo começo do nome ("8270R - 23"). */
function tanqueDa(maquina: Pick<MaquinaExterna, 'modelo' | 'nome'> | undefined): number | null {
  if (!maquina) return null;
  return capacidadeDoTanqueL(maquina.modelo) ?? capacidadeDoTanqueL(maquina.nome.trim().split(/[\s-]+/)[0]);
}

/** Janela em que as leituras do nível viram uma só (a mediana): tira o balanço da boia. */
const JANELA_DO_NIVEL_MS = 5 * 60_000;
/** Subida do nível que só um abastecimento explica. Menos que isso é boia balançando ou trator inclinado. */
const SALTO_DE_ABASTECIMENTO_PCT = 10;
/** Nenhuma máquina da frota gasta isso por hora: acima, a leitura do tanque não é confiável e não vira número. */
const LITROS_POR_HORA_IMPOSSIVEL = 90;

const mediana = (valores: number[]): number => {
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio]! : (v[meio - 1]! + v[meio]!) / 2;
};

/**
 * Litros gastos, pela queda LÍQUIDA do nível do tanque ao longo do caminho. A boia balança o tempo todo com a máquina
 * no campo, então somar cada descida inventa consumo (o primeiro relatório real deu 85 e 129 L/h num 8270R que gasta
 * 24). Aqui: (1) as leituras viram a mediana de cada 5 min, alisada com as vizinhas; (2) o dia é cortado só onde o
 * nível sobe 10% ou mais (abastecimento); (3) cada trecho conta o nível do começo menos o do fim. Balanço para cima e
 * para baixo se anula. Nulo quando não dá para confiar: sem capacidade do tanque, sem leitura, nível parado em cheio
 * com a máquina andando (boia travada) ou resultado acima do que um motor consegue gastar.
 */
export function litrosPelaQuedaDoTanque(pontos: PontoDoCaminho[], capacidadeL: number | null): number | null {
  if (!capacidadeL) return null;
  let leituras = 0;
  let sempreCheio = true;
  let andandoMs = 0;
  let primeira = 0;
  let ultima = 0;
  const janelas = new Map<number, number[]>();
  for (let i = 0; i < pontos.length; i++) {
    const p = pontos[i]!;
    const proximo = pontos[i + 1];
    const passo = proximo ? proximo.t - p.t : 0;
    if (passo > 0 && passo <= 5 * 60_000 && p.kmh >= 0.5) andandoMs += passo;
    const nivel = p.tanque;
    if (nivel === null || nivel === undefined) continue;
    if (leituras === 0) primeira = p.t;
    ultima = p.t;
    leituras++;
    if (nivel < 99.5) sempreCheio = false;
    const janela = Math.floor(p.t / JANELA_DO_NIVEL_MS);
    const lista = janelas.get(janela);
    if (lista) lista.push(nivel);
    else janelas.set(janela, [nivel]);
  }
  if (leituras < 2) return null;
  if (sempreCheio && andandoMs >= CHEIO_SUSPEITO_MS) return null;

  const porJanela = [...janelas].sort((a, b) => a[0] - b[0]).map(([janela, niveis]) => ({ janela, nivel: mediana(niveis) }));
  // Com vizinhas dos dois lados (leituras seguidas), a janela fica com a mediana das três: uma janela torta sozinha
  // não conta. Leitura espaçada (sem vizinha colada) vale como veio.
  const niveis = porJanela.map((atual, i) => {
    const antes = porJanela[i - 1];
    const depois = porJanela[i + 1];
    return antes && depois && antes.janela === atual.janela - 1 && depois.janela === atual.janela + 1 ? mediana([antes.nivel, atual.nivel, depois.nivel]) : atual.nivel;
  });

  let quedaPct = 0;
  let inicio = niveis[0]!;
  let anterior = inicio;
  for (const nivel of niveis.slice(1)) {
    if (nivel >= anterior + SALTO_DE_ABASTECIMENTO_PCT) {
      // Abasteceu: fecha o trecho no nível de antes e recomeça do nível novo.
      quedaPct += Math.max(0, inicio - anterior);
      inicio = nivel;
    }
    anterior = nivel;
  }
  quedaPct += Math.max(0, inicio - anterior);

  const litros = (quedaPct / 100) * capacidadeL;
  // Entre a primeira e a última leitura do nível: se nem com a máquina ligada esse tempo todo o gasto caberia, é defeito.
  const horas = (ultima - primeira) / 3_600_000;
  if (horas > 0 && litros / horas > LITROS_POR_HORA_IMPOSSIVEL) return null;
  return Math.round(litros * 10) / 10;
}

/** Trabalhando esse tempo todo com o tanque ainda cheio, a leitura não é de verdade (um trator gasta bem mais de 1% nesse tempo). */
const CHEIO_SUSPEITO_MS = 90 * 60_000;

/**
 * O tanque marcou cheio (99,5% ou mais) em todos os pontos mais recentes do caminho, somando pelo menos 1 h 30 de
 * máquina andando? Olha do fim para o começo e para no primeiro ponto com outra leitura (abasteceu depois disso).
 */
export function tanqueTravado(pontos: PontoDoCaminho[]): boolean {
  let andando = 0;
  for (let i = pontos.length - 1; i > 0; i--) {
    const p = pontos[i - 1]!;
    if (p.tanque === null || p.tanque === undefined || p.tanque < 99.5) return false;
    const ms = pontos[i]!.t - p.t;
    if (ms > 0 && ms <= 5 * 60_000 && p.kmh >= 0.5) andando += ms;
    if (andando >= CHEIO_SUSPEITO_MS) return true;
  }
  return false;
}

/** Acima disso a máquina está se deslocando, não trabalhando (nenhuma operação de campo roda tão rápido com implemento). */
const TRANSPORTE_KMH = 16;

/**
 * Horas em cada estado, pela velocidade de cada ponto do caminho: parado = ocioso, rápido = transporte, o resto =
 * trabalhando. O tempo de um ponto vai até o seguinte; buraco de sinal maior que 5 min não conta.
 */
export function horasPorEstado(pontos: PontoDoCaminho[]): { trabalhandoH: number; ociosoH: number; transporteH: number } {
  let trabalhando = 0;
  let ocioso = 0;
  let transporte = 0;
  for (let i = 0; i + 1 < pontos.length; i++) {
    const ms = pontos[i + 1]!.t - pontos[i]!.t;
    if (ms <= 0 || ms > 5 * 60_000) continue;
    const kmh = pontos[i]!.kmh;
    if (kmh < 0.5) ocioso += ms;
    else if (kmh >= TRANSPORTE_KMH) transporte += ms;
    else trabalhando += ms;
  }
  const h = (ms: number) => Math.round((ms / 3_600_000) * 10) / 10;
  return { trabalhandoH: h(trabalhando), ociosoH: h(ocioso), transporteH: h(transporte) };
}

/** Horas andando e parado dentro de cada talhão, e fora de todos (`talhaoId` nulo). Só o que somou 3 min ou mais. */
export function tempoNosTalhoes(pontos: PontoDoCaminho[], talhoes: TalhaoExterno[]): { talhaoId: string | null; nome: string; andandoH: number; paradoH: number }[] {
  const soma = new Map<string, { talhaoId: string | null; nome: string; andando: number; parado: number }>();
  const caixas = talhoes.map((t) => {
    const lngs = t.contorno.map((p) => p[0]);
    const lats = t.contorno.map((p) => p[1]);
    return { t, minLng: Math.min(...lngs), maxLng: Math.max(...lngs), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
  });
  let ultimo: (typeof caixas)[number] | undefined;
  for (let i = 0; i + 1 < pontos.length; i++) {
    const p = pontos[i]!;
    const ms = pontos[i + 1]!.t - p.t;
    if (ms <= 0 || ms > 5 * 60_000) continue;
    const dentro = (c: (typeof caixas)[number]) => p.lng >= c.minLng && p.lng <= c.maxLng && p.lat >= c.minLat && p.lat <= c.maxLat && dentroDoAnel(p.lng, p.lat, c.t.contorno);
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

/** Largura da passada quando o talhão não tem linhas de onde tirar. */
const LARGURA_PADRAO_M = 12;

const metrosEntre = (a: [number, number], b: [number, number]) => Math.hypot((b[1] - a[1]) * 111_320, (b[0] - a[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180));
const comprimentoM = (linha: [number, number][]) => linha.reduce((s, p, i) => (i === 0 ? 0 : s + metrosEntre(linha[i - 1]!, p)), 0);

/** O ponto [lng, lat] está dentro do anel? (regra par-ímpar) */
function dentroDoAnel(lng: number, lat: number, anel: [number, number][]): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i]!;
    const [xj, yj] = anel[j]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

export interface AreaDoCaminho {
  /** Tudo o que a máquina cobriu no período, dentro ou fora de talhão. */
  totalHa: number;
  /** A parte coberta dentro de algum talhão com contorno. */
  dentroHa: number;
  /** A parte coberta fora de todos os talhões. */
  foraHa: number;
}

/**
 * Hectares pelo caminho: metros andados em ritmo de serviço (0,5 a 16 km/h) vezes a largura da passada. A área conta
 * em QUALQUER lugar; o talhão serve só para dizer quanto foi dentro e quanto foi fora.
 *
 * Largura: a que o administrador informou para a máquina (`larguraDaMaquina`), se houver. Sem ela: dentro de um
 * talhão com linhas, a das linhas dele (`larguras`); nos outros casos, a média das larguras
 * conhecidas da fazenda (são os mesmos implementos) ou, sem nenhuma, a padrão. Dentro de um talhão a área não passa
 * da área dele (repassar no mesmo lugar não cria terra); fora não há teto.
 */
export function areasDoCaminho(pontos: PontoDoCaminho[], talhoes: TalhaoExterno[], larguras: Map<string, number> = new Map(), larguraDaMaquina?: number | null): AreaDoCaminho {
  const caixas = talhoes.map((t) => {
    const lngs = t.contorno.map((p) => p[0]);
    const lats = t.contorno.map((p) => p[1]);
    return { t, minLng: Math.min(...lngs), maxLng: Math.max(...lngs), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
  });
  const conhecidas = [...larguras.values()];
  // A largura informada para a máquina vale em todo lugar: é o implemento que ela está puxando de verdade.
  const larguraGeral = larguraDaMaquina && larguraDaMaquina > 0 ? larguraDaMaquina : conhecidas.length ? conhecidas.reduce((s, l) => s + l, 0) / conhecidas.length : LARGURA_PADRAO_M;
  const larguraNoTalhao = (id: string) => (larguraDaMaquina && larguraDaMaquina > 0 ? larguraDaMaquina : (larguras.get(id) ?? larguraGeral));
  const metros = new Map<string, number>();
  let metrosFora = 0;
  let ultimo: (typeof caixas)[number] | undefined;
  for (let i = 0; i + 1 < pontos.length; i++) {
    const p = pontos[i]!;
    const q = pontos[i + 1]!;
    if (q.t - p.t <= 0 || q.t - p.t > 5 * 60_000 || p.kmh < 0.5 || p.kmh >= TRANSPORTE_KMH) continue;
    const dentro = (c: (typeof caixas)[number]) => p.lng >= c.minLng && p.lng <= c.maxLng && p.lat >= c.minLat && p.lat <= c.maxLat && dentroDoAnel(p.lng, p.lat, c.t.contorno);
    const achado = ultimo && dentro(ultimo) ? ultimo : caixas.find(dentro);
    ultimo = achado;
    const andado = metrosEntre([p.lng, p.lat], [q.lng, q.lat]);
    if (achado) metros.set(achado.t.id, (metros.get(achado.t.id) ?? 0) + andado);
    else metrosFora += andado;
  }
  let dentroHa = 0;
  for (const { t } of caixas) {
    const andado = metros.get(t.id);
    if (andado) dentroHa += Math.min(t.areaHa, (andado * larguraNoTalhao(t.id)) / 10_000);
  }
  const foraHa = (metrosFora * larguraGeral) / 10_000;
  const um = (v: number) => Math.round(v * 10) / 10;
  return { totalHa: um(dentroHa + foraHa), dentroHa: um(dentroHa), foraHa: um(foraHa) };
}

/** Só o total (dentro + fora dos talhões). */
export function areaDoCaminho(pontos: PontoDoCaminho[], talhoes: TalhaoExterno[], larguras: Map<string, number> = new Map()): number {
  return areasDoCaminho(pontos, talhoes, larguras).totalHa;
}

/**
 * Paradas ao longo do caminho: trechos em que a máquina ficou sem andar (ou sem dar sinal, no mesmo lugar) por
 * 20 s ou mais (toda parada entra, como no mapa da John Deere; antes só as de 2 min). Cada uma com o lugar, a hora
 * em que começou e a duração em minutos (com uma casa: 0,5 = 30 s).
 */
export function paradasDe(pontos: PontoDoCaminho[]): { lng: number; lat: number; inicio: string; minutos: number }[] {
  const MINIMO_MS = 20_000;
  const metros = (a: PontoDoCaminho, b: PontoDoCaminho) => Math.hypot((b.lat - a.lat) * 111_320, (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180));
  const paradas: { lng: number; lat: number; inicio: string; minutos: number }[] = [];
  let inicio: PontoDoCaminho | null = null;
  const fechar = (fim: number) => {
    if (inicio && fim - inicio.t >= MINIMO_MS) paradas.push({ lng: inicio.lng, lat: inicio.lat, inicio: new Date(inicio.t).toISOString(), minutos: Math.round((fim - inicio.t) / 6_000) / 10 });
    inicio = null;
  };
  for (let i = 0; i < pontos.length; i++) {
    const p = pontos[i]!;
    const anterior = pontos[i - 1];
    // Buraco de sinal no mesmo lugar (motor desligado): conta como parada desde o último ponto.
    if (anterior && !inicio && p.t - anterior.t > 5 * 60_000 && metros(anterior, p) < 50) inicio = anterior;
    const parado = p.kmh < 0.5;
    if (parado && !inicio) inicio = p;
    else if (!parado && inicio) fechar(p.t);
    else if (inicio && metros(inicio, p) > 50) {
      // Saiu do lugar sem a velocidade acusar: a parada terminou no ponto anterior.
      fechar(anterior?.t ?? p.t);
      if (parado) inicio = p;
    }
  }
  // Ainda parada no último ponto conhecido.
  const ultimo = pontos.at(-1);
  if (inicio && ultimo) fechar(ultimo.t);
  return paradas;
}

/** Endereços de produção da API ISO 15143-3 a testar quando `DEERE_AEMP_URL` não está definido (não publicados pela Deere). */
const RAIZES_AEMP = ['https://partnerapi.deere.com/aemp', 'https://aemp.deere.com', 'https://partneraemp.deere.com'];

/** Uma página da frota: quantas máquinas vieram, litros acumulados, próxima página e o link de "liberar organização", se houver. */
export function lerFrota(xml: string): { equipamentos: number; litros: Map<string, number>; leituras: Map<string, LeituraDaFrota>; proxima: string | null; ligacaoPendente: string | null } {
  const limpo = semPrefixos(xml);
  return {
    equipamentos: (limpo.match(/<Equipment>/g) ?? []).length,
    litros: combustivelDaFrota(xml),
    leituras: leiturasDaFrota(xml),
    proxima: /<rel>\s*next\s*<\/rel>\s*<href>([^<]+)<\/href>/i.exec(limpo)?.[1]?.trim() ?? null,
    ligacaoPendente: /<rel>\s*connections\s*<\/rel>\s*<href>([^<]+)<\/href>/i.exec(limpo)?.[1]?.trim() ?? null,
  };
}

/** Tira prefixos de espaço de nomes (`<ns2:Equipment>` vira `<Equipment>`), que a resposta real pode trazer. */
function semPrefixos(xml: string): string {
  return xml.replace(/<(\/?)[A-Za-z][\w.-]*:/g, '<$1');
}

/** Lê o XML da frota (ISO 15143-3) e devolve litros acumulados por número de série. Só entra quem informa em litros. */
export function combustivelDaFrota(xmlBruto: string): Map<string, number> {
  return new Map([...leiturasDaFrota(xmlBruto)].map(([serie, l]) => [serie, l.litros]));
}

/** Como `combustivelDaFrota`, mas junto com as horas de motor acumuladas (`CumulativeOperatingHours`) da mesma leitura. */
export function leiturasDaFrota(xmlBruto: string): Map<string, LeituraDaFrota> {
  const xml = semPrefixos(xmlBruto);
  const saida = new Map<string, LeituraDaFrota>();
  for (const bloco of xml.match(/<Equipment>[\s\S]*?<\/Equipment>/g) ?? []) {
    // A Deere manda `<FuelUsed datetime="…">`: a tag leva atributo, então não dá para casar `<FuelUsed>` seco.
    const consumo = /<FuelUsed(?:\s[^>]*)?>[\s\S]*?<FuelConsumed(?:\s[^>]*)?>([^<]+)<\/FuelConsumed>[\s\S]*?<\/FuelUsed>/.exec(bloco)?.[1];
    const unidade = /<FuelUnits(?:\s[^>]*)?>([^<]+)<\/FuelUnits>/.exec(bloco)?.[1]?.trim().toLowerCase() ?? 'litre';
    const valor = Number(consumo);
    if (!Number.isFinite(valor) || !unidade.startsWith('lit')) continue;
    const horas = Number(/<CumulativeOperatingHours(?:\s[^>]*)?>\s*<Hour>([^<]+)<\/Hour>/.exec(bloco)?.[1]);
    const quando = (re: RegExp) => {
      const t = Date.parse(re.exec(bloco)?.[1] ?? '');
      return Number.isFinite(t) ? new Date(t) : null;
    };
    const leitura: LeituraDaFrota = {
      litros: valor,
      horasMotor: Number.isFinite(horas) ? horas : null,
      litrosEm: quando(/<FuelUsed[^>]*\sdatetime="([^"]+)"/),
      horasEm: quando(/<CumulativeOperatingHours[^>]*\sdatetime="([^"]+)"/),
    };
    for (const campo of ['SerialNumber', 'PIN', 'EquipmentID']) {
      const serie = new RegExp(`<${campo}>([^<]+)</${campo}>`).exec(bloco)?.[1]?.trim().toUpperCase();
      if (serie) saida.set(serie, leitura);
    }
  }
  return saida;
}

/**
 * Parte o caminho em trechos: um novo sempre que o sinal some por mais de 5 min ou a máquina "salta" mais de 500 m
 * (senão o mapa ligaria os dois pontos com uma reta que ela não percorreu). Descarta pontos a menos de 3 m do anterior.
 */
export function trechosDe(pontos: { t: number; lng: number; lat: number }[]): [number, number][][] {
  const metros = (a: { lng: number; lat: number }, b: { lng: number; lat: number }) => {
    const dLat = (b.lat - a.lat) * 111_320;
    const dLng = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
    return Math.hypot(dLat, dLng);
  };
  const trechos: [number, number][][] = [];
  let atual: [number, number][] = [];
  let anterior: { t: number; lng: number; lat: number } | null = null;
  for (const p of pontos) {
    if (anterior) {
      const d = metros(anterior, p);
      if (p.t - anterior.t > 5 * 60_000 || d > 500) {
        if (atual.length > 1) trechos.push(atual);
        atual = [];
      } else if (d < 3) continue;
    }
    atual.push([p.lng, p.lat]);
    anterior = p;
  }
  if (atual.length > 1) trechos.push(atual);
  return trechos;
}

/** O dia anterior a `dia` (AAAA-MM-DD). */
function diaAntes(dia: string): string {
  return new Date(Date.parse(`${dia}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** Litro e horas são do "mesmo momento" quando foram reportados com até 30 min de diferença (e as duas horas existem). */
const JANELA_CONTADORES_MS = 30 * 60_000;
function contadoresProximos(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return !!a && !!b && Math.abs(a.getTime() - b.getTime()) <= JANELA_CONTADORES_MS;
}

/** "HH:MM" no horário da fazenda. */
function horaNaFazenda(quando: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(quando);
}

function hojeNaFazenda(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/** Quantos limites/consultas por talhão ou máquina correm ao mesmo tempo (a Deere limita as chamadas). */
const SIMULTANEAS = 5;

/** Espera o resultado por `ms`; passado o prazo devolve `padrao` e deixa a conta terminar em segundo plano (os caches guardam o resultado). */
function ate<T>(promessa: Promise<T>, ms: number, padrao: T): Promise<T> {
  let relogio: NodeJS.Timeout;
  const prazo = new Promise<T>((ok) => {
    relogio = setTimeout(() => ok(padrao), ms);
    relogio.unref?.();
  });
  return Promise.race([promessa.catch(() => padrao), prazo]).finally(() => clearTimeout(relogio));
}

async function emLotes<T, R>(itens: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += SIMULTANEAS) saida.push(...(await Promise.all(itens.slice(i, i + SIMULTANEAS).map(fn))));
  return saida;
}

/**
 * Provedor real da John Deere (Operations Center).
 * Pronto: máquinas, posição e estado, talhões com contorno, horímetro, área/horas/operador/andamento por talhão
 * (Field Operations), linhas AB e escrita de talhões, contornos e linhas. Ainda `pendente`: combustível e tempo parado
 * (export ponto a ponto) e o plano (Work Plans).
 * As formas das respostas seguem a documentação e ainda não foram conferidas no sandbox.
 */
export class DeereProvedor implements ProvedorMaquinas {
  private readonly cliente: ClienteDeere;

  constructor(private readonly config: DeereConfig) {
    this.cliente = new ClienteDeere({ baseUrl: config.baseUrl, obterToken: config.obterToken, http: config.http, esperar: config.esperar, registrar: config.registrar });
  }

  /** Horímetro (Machine Engine Hours). O nível do tanque não vem dessa API. */
  async medicoes(orgId: string, maquinaId: string): Promise<MedicoesExternas> {
    const [horas, rastro] = await Promise.all([
      // O horímetro anda devagar: 5 min guardado. Só a última leitura (`lastKnown`) e só UMA página: sem isso a Deere
      // devolve o histórico inteiro, de 10 em 10, e são centenas de consultas por máquina.
      this.guardado(`horas/${orgId}/${maquinaId}`, 5 * 60_000, () => (this.semAcesso(orgId, maquinaId) ? Promise.resolve([]) : this.umaPagina<HorasDoMotorDeere>(orgId, `/machines/${encodeURIComponent(maquinaId)}/engineHours?lastKnown=true`))),
      this.ultimoRastro(orgId, maquinaId),
    ]);
    const medicoes = medicoesDe(horas, rastro);
    return { ...medicoes, combustivelSuspeito: medicoes.combustivelPct !== null && medicoes.combustivelPct >= 99.5 && tanqueTravado(this.caminhoDeHoje(orgId, maquinaId)) };
  }

  /** Uma página só de uma lista (sem seguir `nextPage`). Erro vira lista vazia. */
  private async umaPagina<T>(orgId: string, caminho: string): Promise<T[]> {
    try {
      const valores = (await this.cliente.obter<{ values?: T | T[] }>(orgId, caminho)).values;
      return valores === undefined ? [] : Array.isArray(valores) ? valores : [valores];
    } catch {
      return [];
    }
  }

  /** Máquinas em que a John Deere negou os dados (403): ficam 15 min sem novas consultas, para não gastar a fila à toa. */
  private readonly negadas = new Map<string, number>();
  private semAcesso(orgId: string, maquinaId: string): boolean {
    const ate = this.negadas.get(`${orgId}/${maquinaId}`);
    return ate !== undefined && ate > Date.now();
  }

  /** Fazenda importada de arquivo (pasta do monitor): fica só no Talhio e completa o que a John Deere não tem. */
  private readonly importadas = new Map<string, FazendaImportada>();
  /** Endereço da API ISO 15143-3 que já respondeu neste servidor (testado primeiro nas próximas leituras). */
  private aempQueRespondeu: string | null = null;

  /**
   * Guarda os talhões e as linhas do arquivo para o mapa, SEM gravar nada na John Deere. Muita fazenda tem os
   * talhões no Operations Center só com o nome; o contorno e as linhas (inclusive curvas) estão na pasta do monitor.
   * Cada importação substitui a anterior. Para gravar na Deere existe `enviarFazendaParaDeere`, que ninguém chama sozinho.
   */
  async importarFazenda(orgId: string, fazenda: FazendaImportada, opcoes: { aoSubir?: boolean } = {}): Promise<void> {
    this.importadas.set(orgId, fazenda);
    // Talhões novos mudam o "dentro ou fora" e os hectares dos dias já fechados: eles são refeitos na próxima busca.
    // Ao subir o servidor a fazenda só está sendo devolvida à memória, nada mudou.
    if (!opcoes.aoSubir) {
      await this.config.diario?.limpar?.(orgId).catch(() => undefined);
      this.guardados.delete(`larguras/${orgId}`);
      this.ultimos.delete(`larguras/${orgId}`);
    }
    this.guardados.delete(`talhoes/${orgId}`);
    this.ultimos.delete(`talhoes/${orgId}`);
  }

  private ehImportado(orgId: string, talhaoId: string): boolean {
    return this.importadas.get(orgId)?.talhoes.some((t) => t.id === talhaoId) ?? false;
  }

  /**
   * Cria no Operations Center os talhões (com cliente e fazenda), o contorno ativo e as linhas AB do arquivo.
   * Talhão que já existe pelo nome é reaproveitado e fica sem contorno novo. Linhas curvas não podem ser
   * enviadas (a API só aceita linha AB); ficam de fora. ESCREVE na conta da John Deere: só a pedido explícito.
   */
  async enviarFazendaParaDeere(orgId: string, fazenda: FazendaImportada): Promise<void> {
    const org = encodeURIComponent(await this.config.obterOrganizacao(orgId));
    const existentes = await this.cliente.listar<CampoDeere>(orgId, `/organizations/${org}/fields`);
    const idPorNome = new Map(existentes.filter((c) => !c.archived).map((c) => [(c.name ?? '').trim().toLowerCase(), String(c.id)]));
    const idNovo = new Map<string, string>();

    for (const talhao of fazenda.talhoes) {
      const chave = talhao.nome.trim().toLowerCase();
      let id = idPorNome.get(chave);
      if (!id) {
        id = (await this.cliente.criar(orgId, `/organizations/${org}/fields`, campoParaEnviar(talhao.nome, fazenda.cliente))) ?? undefined;
        if (!id) throw new Error(`A John Deere não devolveu o id do talhão ${talhao.nome}.`);
        await this.cliente.criar(orgId, `/organizations/${org}/fields/${encodeURIComponent(id)}/boundaries`, contornoParaEnviar(talhao.nome, talhao.contorno));
      }
      idNovo.set(talhao.id, id);
    }

    for (const linha of fazenda.linhas) {
      const campo = linha.talhaoId ? idNovo.get(linha.talhaoId) : undefined;
      if (!campo || linha.passadas) continue;
      await this.cliente.criar(orgId, `/organizations/${org}/fields/${encodeURIComponent(campo)}/guidanceLines`, linhaParaEnviar(linha.nome, linha.a, linha.b));
    }
    // Os talhões mudaram: a próxima leitura busca de novo na Deere em vez de devolver a lista guardada.
    this.guardados.delete(`talhoes/${orgId}`);
    this.ultimos.delete(`talhoes/${orgId}`);
  }

  /**
   * Cria UM talhão no Operations Center, com o contorno ativo, e devolve o id dele lá. Mesmo nome de um talhão que já
   * existe (não arquivado): reaproveita e não mexe no contorno. ESCREVE na conta da John Deere: só a pedido explícito.
   * O talhão vai para a organização principal da fazenda.
   */
  async enviarTalhao(orgId: string, talhao: { nome: string; contorno: [number, number][] }): Promise<string> {
    const org = encodeURIComponent(await this.config.obterOrganizacao(orgId));
    const existentes = await this.cliente.listar<CampoDeere>(orgId, `/organizations/${org}/fields`);
    const igual = existentes.find((c) => !c.archived && (c.name ?? '').trim().toLowerCase() === talhao.nome.trim().toLowerCase());
    if (igual) return String(igual.id);
    const cliente = await this.nomeDaFazenda(orgId).catch(() => 'Fazenda');
    const id = await this.cliente.criar(orgId, `/organizations/${org}/fields`, campoParaEnviar(talhao.nome, cliente));
    if (!id) throw new Error(`A John Deere não devolveu o id do talhão ${talhao.nome}.`);
    await this.cliente.criar(orgId, `/organizations/${org}/fields/${encodeURIComponent(id)}/boundaries`, contornoParaEnviar(talhao.nome, talhao.contorno));
    // Os talhões mudaram: a próxima leitura busca de novo na Deere em vez de devolver a lista guardada.
    this.guardados.delete(`talhoes/${orgId}`);
    this.ultimos.delete(`talhoes/${orgId}`);
    return id;
  }

  /**
   * Área e horas da máquina no dia, a partir das operações de campo. A API informa o total da operação, não o
   * de cada dia: operação que atravessa dias é repartida pelo tempo (estimativa). Combustível e tempo parado
   * dependem do export ponto a ponto e por enquanto vêm zerados.
   */
  async atividadeNoDia(orgId: string, maquinaId: string, dia: string): Promise<AtividadeDiariaExterna> {
    const guardado = await this.config.armazem?.buscar(orgId, maquinaId, dia);
    if (guardado) return { horas: guardado.horas, areaHa: guardado.areaHa, combustivelL: guardado.combustivelL, paradoMin: guardado.paradoMin };
    // Sem export lido: as horas de motor ligado vêm direto da máquina (Hours of Operation), para hoje e para dias
    // passados. A área vem da estimativa pelas operações de campo, quando a Deere tem alguma.
    // Nenhuma das duas faz a tela esperar muito: o que não chega a tempo fica pronto, em memória, para o próximo pedido.
    const [estimado, ligado] = await Promise.all([
      ate(this.estimarDia(orgId, maquinaId, dia), 400, { horas: 0, areaHa: 0, combustivelL: 0, paradoMin: 0 }),
      ate(this.horasLigadoNoDia(orgId, maquinaId, dia), 1500, 0),
    ]);
    const atividade: AtividadeDiariaExterna = { ...estimado, horas: Math.max(estimado.horas, ligado) };
    // Hoje: a leitura de horas da Deere chega atrasada (ou não chega a tempo). O caminho já lido, em memória, é o piso:
    // a máquina não pode ter ficado ligada menos tempo do que o que ela andou e ficou parada com sinal.
    if (dia === hojeNaFazenda()) {
      const visto = horasPorEstado(this.caminhos.get(`${orgId}/${maquinaId}`)?.pontos ?? []);
      atividade.horas = Math.max(atividade.horas, Math.round((visto.trabalhandoH + visto.ociosoH + visto.transporteH) * 10) / 10);
    }
    // A estimativa acima só espera 400 ms pela Deere. A área das operações de campo já lida e guardada no banco
    // (mês a mês, inclusive meses antigos) entra quando ela não chegou a tempo ou a memória ainda está vazia.
    if (atividade.areaHa === 0 && dia !== hojeNaFazenda()) {
      const guardada = await this.config.areas?.buscar(orgId, maquinaId, dia).catch(() => null);
      if (guardada && guardada.areaHa > 0) {
        atividade.areaHa = Math.round(guardada.areaHa * 10) / 10;
        atividade.horas = Math.max(atividade.horas, Math.round(guardada.horas * 10) / 10);
      }
    }
    // Dia passado: o fechamento guardado (lido do caminho daquele dia) completa o que a Deere não informa.
    let temFechamento = false;
    if (dia !== hojeNaFazenda()) {
      const fechado = await this.config.diario?.buscar(orgId, maquinaId, dia).catch(() => null);
      if (fechado) {
        temFechamento = true;
        if (atividade.areaHa === 0) {
          atividade.areaHa = fechado.areaHa;
          atividade.areaForaDosTalhoesHa = fechado.areaForaHa;
        }
        if (atividade.paradoMin === 0) atividade.paradoMin = Math.round(fechado.ociosoH * 60);
        // Litros do fechamento vêm da estimativa pelo tanque: só entram com ela ligada, e depois do número do motor (abaixo).
        atividade.horas = Math.max(atividade.horas, Math.round((fechado.trabalhandoH + fechado.ociosoH + fechado.transporteH) * 10) / 10);
      }
    }
    // Sem litros no export: os que o motor informa (ISO 15143-3), de hoje ou de dia passado. Sem eles, fica zero
    // ("sem leitura" no relatório): não se inventa número de combustível.
    if (atividade.combustivelL === 0) {
      const lido = await ate(this.litrosDoDia(orgId, maquinaId, dia), 300, null);
      atividade.combustivelL = lido?.litros ?? 0;
      // Dia antigo (mês passado, ano passado): a Deere só informa as horas de chave ligada dos últimos 62 dias e o
      // caminho só existe desde que o Talhio acompanha a fazenda. As horas de motor e o tempo ocioso do Analisador da
      // Máquina (a mesma leitura dos litros) completam o que faltar, para o relatório de outros meses não vir zerado.
      if (dia !== hojeNaFazenda() && lido && !lido.estimado && (lido.horasMotor ?? 0) > 0) {
        if (atividade.horas === 0) atividade.horas = Math.round((lido.horasMotor ?? 0) * 10) / 10;
        if (!temFechamento && atividade.paradoMin === 0 && (lido.ociosoH ?? 0) > 0) atividade.paradoMin = Math.round((lido.ociosoH ?? 0) * 60);
      }
      if (lido?.estimado && atividade.combustivelL > 0) atividade.combustivelEstimado = true;
      if (lido?.desde && atividade.combustivelL > 0) atividade.combustivelDesde = lido.desde;
      // O litro e as horas de motor saíram das mesmas duas leituras da ISO: o L/h só usa esse par.
      if (!lido?.estimado && lido?.horasMotor !== undefined && atividade.combustivelL > 0) {
        atividade.combustivelComHorasL = atividade.combustivelL;
        atividade.horasMotorLeitura = lido.horasMotor;
      }
    }
    // Hoje: garante que o caminho do dia está sendo lido (não espera; o próximo pedido já encontra os pontos).
    if (dia === hojeNaFazenda()) void this.rastroDeHoje(orgId, maquinaId).catch(() => undefined);
    // Hoje, sem área informada pela Deere: estima pelo caminho dentro dos talhões (distância x largura da passada).
    if (dia === hojeNaFazenda() && atividade.areaHa === 0) {
      const area = await ate(this.areaPeloCaminho(orgId, maquinaId), 300, { totalHa: 0, dentroHa: 0, foraHa: 0 });
      atividade.areaHa = area.totalHa;
      atividade.areaForaDosTalhoesHa = area.foraHa;
    }
    // Hoje: tempo parado com o motor ligado, pelo caminho do dia.
    if (dia === hojeNaFazenda() && atividade.paradoMin === 0) {
      const pontos = this.caminhos.get(`${orgId}/${maquinaId}`)?.pontos;
      if (pontos?.length) atividade.paradoMin = Math.round(horasPorEstado(pontos).ociosoH * 60);
    }
    return atividade;
  }

  /**
   * Horas com a chave ligada em cada dia dos últimos 62 dias (Hours of Operation: `engineState` 1), por máquina.
   * UMA leitura cobre o período todo: o relatório de qualquer dia, semana ou mês sai daqui sem pedir de novo.
   * Guardado 2 min; enquanto atualiza, entrega a leitura anterior.
   */
  private ligadoPorDia(orgId: string, maquinaId: string): Promise<Map<string, number>> {
    return this.guardado(`ligado/${orgId}/${maquinaId}`, 2 * 60_000, async () => {
      const porDia = new Map<string, number>();
      if (this.semAcesso(orgId, maquinaId)) return porDia;
      const agora = Date.now();
      const inicio = Date.parse(`${hojeNaFazenda()}T00:00:00-03:00`) - 62 * 86_400_000;
      const periodos = await this.cliente
        .listar<{ startDate?: string; endDate?: string; engineState?: number | string }>(
          orgId,
          `/machines/${encodeURIComponent(maquinaId)}/hoursOfOperation?startDate=${new Date(inicio).toISOString()}&endDate=${new Date(agora).toISOString()}&itemLimit=100`,
        )
        .catch(() => []);
      const ms = new Map<string, number>();
      for (const p of periodos) {
        if (Number(p.engineState) !== 1) continue;
        let de = Math.max(inicio, Date.parse(p.startDate ?? ''));
        const fim = Math.min(agora, Date.parse(p.endDate ?? '') || agora);
        // Um período que atravessa a meia-noite é repartido entre os dias (no fuso da fazenda).
        while (Number.isFinite(de) && de < fim) {
          const dia = new Date(de - 3 * 3_600_000).toISOString().slice(0, 10);
          const viradaDoDia = Date.parse(`${dia}T00:00:00-03:00`) + 86_400_000;
          const ate = Math.min(fim, viradaDoDia);
          ms.set(dia, (ms.get(dia) ?? 0) + (ate - de));
          de = ate;
        }
      }
      for (const [dia, total] of ms) porDia.set(dia, Math.round((total / 3_600_000) * 10) / 10);
      return porDia;
    });
  }

  /** Horas com a chave ligada no dia (0 se a máquina não ligou ou a Deere não informou). */
  private async horasLigadoNoDia(orgId: string, maquinaId: string, dia: string): Promise<number> {
    return (await this.ligadoPorDia(orgId, maquinaId)).get(dia) ?? 0;
  }

  private async estimarDia(orgId: string, maquinaId: string, dia: string): Promise<AtividadeDiariaExterna> {
    let horas = 0;
    let areaHa = 0;
    for (const { op } of await this.operacoesDaMaquina(orgId, maquinaId)) {
      const fatia = fatiaDoDia(op, dia);
      if (fatia.fracao <= 0) continue;
      horas += fatia.horas;
      areaHa += (await this.areaDaOperacao(orgId, op)) * fatia.fracao;
    }
    return { horas: Math.round(horas * 10) / 10, areaHa: Math.round(areaHa * 10) / 10, combustivelL: 0, paradoMin: 0 };
  }

  /** Máquinas da organização (Equipment API). O id da máquina é o `principalId`, usado em todas as outras consultas. */
  listarMaquinas(orgId: string): Promise<MaquinaExterna[]> {
    return this.guardado(`maquinas/${orgId}`, 5 * 60_000, () => this.buscarMaquinas(orgId));
  }

  private async buscarMaquinas(orgId: string): Promise<MaquinaExterna[]> {
    const raiz = (this.config.equipamentosUrl ?? 'https://equipmentapi.deere.com/isg').replace(/\/$/, '');
    const porOrganizacao = await Promise.all(
      (await this.organizacoes(orgId)).map((org) =>
        this.cliente.listar<EquipamentoDeere>(orgId, `${raiz}/equipment?organizationIds=${encodeURIComponent(org)}&categories=Machine&archived=false&itemLimit=100`, 'application/json'),
      ),
    );
    const vistas = new Map<string, MaquinaExterna>();
    for (const e of porOrganizacao.flat()) {
      const m = maquinaDe(e);
      if (!vistas.has(m.id)) vistas.set(m.id, m);
    }
    return [...vistas.values()];
  }

  private readonly cacheRastro = new Map<string, { ate: number; dado: Promise<PontoDeere | undefined> }>();

  /** Último rastro da máquina (posição, velocidade, nível do tanque). Guardado 30 s: posição e medições pedem o mesmo. */
  private ultimoRastro(orgId: string, maquinaId: string): Promise<PontoDeere | undefined> {
    const chave = `${orgId}/${maquinaId}`;
    const guardado = this.cacheRastro.get(chave);
    if (guardado && guardado.ate > Date.now()) return guardado.dado;
    if (this.semAcesso(orgId, maquinaId)) return Promise.resolve(undefined);
    const id = encodeURIComponent(maquinaId);
    const dado = this.cliente
      .listar<PontoDeere>(orgId, `/machines/${id}/breadcrumbs?lastKnown=true`)
      .then(async (lista) => {
        // O rastro (breadcrumb) só é gravado com a máquina trabalhando. Se ele não existe ou está velho, a posição
        // periódica do modem (locationHistory) pode ser mais nova: fica a mais recente das duas.
        const rastro = lista[0];
        const idade = rastro?.eventTimestamp ? Date.now() - Date.parse(rastro.eventTimestamp) : Infinity;
        if (rastro && idade < 5 * 60_000) return rastro;
        const periodica = (await this.cliente.listar<PontoDeere>(orgId, `/machines/${id}/locationHistory?lastKnown=true`).catch(() => [] as PontoDeere[]))[0];
        if (!rastro) return periodica;
        return periodica?.eventTimestamp && Date.parse(periodica.eventTimestamp) > Date.parse(rastro.eventTimestamp ?? '') ? periodica : rastro;
      })
      .catch((erro: unknown) => {
        if (erro instanceof DeereErro && erro.status === 403) this.negadas.set(chave, Date.now() + 15 * 60_000);
        return undefined;
      });
    // Máquina andando: confere a posição a cada 2 s, para o movimento aparecer rápido no mapa. Parada: a cada 12 s,
    // para não gastar o limite de consultas da John Deere com quem não saiu do lugar.
    const anteriorAndando = (velocidadeKmHDe(this.ultimosRastros.get(chave)?.speed) ?? 0) >= 0.5;
    const entrada = { ate: Date.now() + (anteriorAndando ? 2_000 : 12_000), dado };
    this.cacheRastro.set(chave, entrada);
    void dado.then((ponto) => {
      if (!ponto) return;
      this.ultimosRastros.set(chave, ponto);
      // Cada posição nova já entra no caminho do dia: a linha no mapa acompanha o trator sem esperar a próxima leitura do período.
      const caminho = this.caminhos.get(chave);
      const t = Date.parse(ponto.eventTimestamp ?? ponto.gpsFixTimestamp ?? ponto.createTimestamp ?? '');
      const lat = Number(ponto.point?.lat ?? ponto.lat);
      const lng = Number(ponto.point?.lon ?? ponto.lon);
      if (caminho && caminho.dia === hojeNaFazenda() && Number.isFinite(t) && Number.isFinite(lat) && Number.isFinite(lng) && t > (caminho.pontos.at(-1)?.t ?? 0)) {
        caminho.pontos.push({ t, lng, lat, kmh: velocidadeKmHDe(ponto.speed) ?? 0, estado: estadoBrutoDe(ponto), tanque: combustivelPctDe(ponto) });
      }
      // Começou a andar agora: a próxima leitura já vem no ritmo rápido.
      if (!anteriorAndando && (velocidadeKmHDe(ponto.speed) ?? 0) >= 0.5) entrada.ate = Math.min(entrada.ate, Date.now() + 2_000);
    });
    // Já há um rastro anterior: entrega esse na hora e o novo fica pronto para o próximo pedido (segundos depois).
    const anterior = this.ultimosRastros.get(chave);
    return anterior ? Promise.resolve(anterior) : dado;
  }

  private readonly ultimosRastros = new Map<string, PontoDeere>();

  /** Caminho do dia por máquina: pontos em ordem de hora. `ate` = até quando a John Deere já foi lida. */
  private readonly caminhos = new Map<string, { dia: string; pontos: PontoDoCaminho[]; lidoAte: number; conferidoEm: number; buscando: boolean }>();

  /**
   * Caminho que a máquina fez hoje (Breadcrumbs por período), como o rastro verde do Operations Center.
   * Nunca faz a tela esperar: devolve o que já está em memória e busca só o pedaço novo por trás (a cada 20 s).
   */
  async rastroDeHoje(orgId: string, maquinaId: string): Promise<[number, number][][]> {
    const dia = hojeNaFazenda();
    const chave = `${orgId}/${maquinaId}`;
    let c = this.caminhos.get(chave);
    if (!c || c.dia !== dia) {
      c = { dia, pontos: [], lidoAte: Date.parse(`${dia}T00:00:00-03:00`), conferidoEm: 0, buscando: false };
      this.caminhos.set(chave, c);
    }
    if (!c.buscando && Date.now() - c.conferidoEm > 20_000 && !this.semAcesso(orgId, maquinaId)) {
      const atual = c;
      atual.buscando = true;
      const agora = Date.now();
      void this.cliente
        .listar<PontoDeere>(orgId, `/machines/${encodeURIComponent(maquinaId)}/breadcrumbs?startDate=${new Date(atual.lidoAte).toISOString()}&endDate=${new Date(agora).toISOString()}&itemLimit=100`)
        .then((lista) => {
          for (const p of lista) {
            const t = Date.parse(p.eventTimestamp ?? p.gpsFixTimestamp ?? p.createTimestamp ?? '');
            const lat = Number(p.point?.lat ?? p.lat);
            const lng = Number(p.point?.lon ?? p.lon);
            if (Number.isFinite(t) && Number.isFinite(lat) && Number.isFinite(lng) && t > atual.lidoAte - 1) atual.pontos.push({ t, lng, lat, kmh: velocidadeKmHDe(p.speed) ?? 0, estado: estadoBrutoDe(p), tanque: combustivelPctDe(p) });
          }
          atual.pontos.sort((a, b) => a.t - b.t);
          // Sem repetir o mesmo instante (as buscas se sobrepõem em 1 ponto).
          atual.pontos = atual.pontos.filter((p, i, todos) => i === 0 || p.t !== todos[i - 1]!.t);
          atual.lidoAte = atual.pontos.at(-1)?.t ?? atual.lidoAte;
          // Para calibrar: quantos pontos em cada estado que a Deere informa e a velocidade média de cada um.
          const porEstado = new Map<string, { n: number; soma: number }>();
          for (const p of atual.pontos) {
            const e = porEstado.get(p.estado) ?? { n: 0, soma: 0 };
            e.n++;
            e.soma += p.kmh;
            porEstado.set(p.estado, e);
          }
          const estados = [...porEstado].map(([estado, e]) => `${estado}: ${e.n} pts, ${(e.soma / e.n).toFixed(1)} km/h`).join('; ');
          this.config.registrar?.(`rastro de hoje da máquina ${maquinaId}: ${lista.length} ponto(s) novos, ${atual.pontos.length} no total; estado da máquina -> ${estados || 'sem pontos'}`);
        })
        .catch((erro) => this.config.registrar?.(`rastro de hoje da máquina ${maquinaId}: FALHOU (${erro instanceof Error ? erro.message : 'erro'})`))
        .finally(() => {
          atual.buscando = false;
          atual.conferidoEm = Date.now();
        });
    }
    return trechosDe(c.pontos);
  }

  /**
   * Busca do passado: lê na John Deere o caminho de cada máquina em cada dia ainda não fechado (do mais recente
   * para o mais antigo, até `diasAtras`) e guarda o fechamento do dia: horas por estado, paradas, tempo por talhão
   * e hectares. Vai aos poucos: no máximo `limite` leituras por chamada, para não sobrecarregar a Deere nem o
   * servidor. Dia em que a máquina nem ligou é fechado zerado, sem consultar. Hoje nunca entra (ainda está aberto).
   */
  async recuperarPassado(orgId: string, limite = 8, diasAtras = 45): Promise<{ fechados: number; faltam: number }> {
    const diario = this.config.diario;
    if (!diario) return { fechados: 0, faltam: 0 };
    const [maquinas, jaFechados, talhoes, larguras] = await Promise.all([
      this.listarMaquinas(orgId),
      diario.fechados(orgId),
      this.listarTalhoes(orgId).catch(() => [] as TalhaoExterno[]),
      this.largurasDasPassadas(orgId),
    ]);
    const larguraPorMaquina = await this.largurasInformadas(orgId);
    const hoje = hojeNaFazenda();
    const inicioDeHoje = Date.parse(`${hoje}T00:00:00-03:00`);
    const dias = Array.from({ length: diasAtras }, (_, i) => new Date(inicioDeHoje - (i + 1) * 86_400_000 + 12 * 3_600_000 - 3 * 3_600_000).toISOString().slice(0, 10));
    let fechados = 0;
    let lidos = 0;
    let faltam = 0;
    for (const dia of dias) {
      for (const m of maquinas) {
        if (!m.telemetriaAtiva || jaFechados.has(`${m.id}|${dia}`) || this.semAcesso(orgId, m.id)) continue;
        if (lidos >= limite) {
          faltam++;
          continue;
        }
        const ligado = (await this.ligadoPorDia(orgId, m.id).catch(() => new Map<string, number>())).get(dia) ?? 0;
        let pontos: PontoDoCaminho[] = [];
        if (ligado > 0) {
          lidos++;
          try {
            pontos = await this.caminhoDoDia(orgId, m.id, dia);
          } catch (e) {
            if (e instanceof DeereErro && e.status === 403) this.negadas.set(`${orgId}/${m.id}`, Date.now() + 15 * 60_000);
            continue; // fica para a próxima rodada
          }
        }
        const horas = horasPorEstado(pontos);
        const areaDoDia = areasDoCaminho(pontos, talhoes, larguras, larguraPorMaquina.get(m.id));
        await diario.guardar(orgId, m.id, dia, {
          ...horas,
          combustivelL: this.config.combustivelPeloTanque ? litrosPelaQuedaDoTanque(pontos, tanqueDa(m)) : null,
          areaHa: areaDoDia.totalHa,
          areaForaHa: areaDoDia.foraHa,
          paradas: paradasDe(pontos).length,
          porTalhao: tempoNosTalhoes(pontos, talhoes),
          pontos: pontos.length,
        });
        fechados++;
      }
    }
    if (fechados || faltam) this.config.registrar?.(`busca do passado: ${fechados} dia(s) de máquina fechados agora (${lidos} lidos na Deere), faltam ${faltam}`);
    return { fechados, faltam };
  }

  /** Caminho de uma máquina num dia inteiro. Lido em 4 janelas de 6 h: um dia de trabalho passa de 5 mil pontos, o teto de uma leitura. */
  private async caminhoDoDia(orgId: string, maquinaId: string, dia: string): Promise<PontoDoCaminho[]> {
    const inicio = Date.parse(`${dia}T00:00:00-03:00`);
    const pontos: PontoDoCaminho[] = [];
    for (let janela = 0; janela < 4; janela++) {
      const de = new Date(inicio + janela * 6 * 3_600_000).toISOString();
      const ate = new Date(inicio + (janela + 1) * 6 * 3_600_000 - 1).toISOString();
      const lista = await this.cliente.listar<PontoDeere>(orgId, `/machines/${encodeURIComponent(maquinaId)}/breadcrumbs?startDate=${de}&endDate=${ate}&itemLimit=100`);
      for (const p of lista) {
        const t = Date.parse(p.eventTimestamp ?? p.gpsFixTimestamp ?? p.createTimestamp ?? '');
        const lat = Number(p.point?.lat ?? p.lat);
        const lng = Number(p.point?.lon ?? p.lon);
        if (Number.isFinite(t) && Number.isFinite(lat) && Number.isFinite(lng)) pontos.push({ t, lng, lat, kmh: velocidadeKmHDe(p.speed) ?? 0, estado: estadoBrutoDe(p), tanque: combustivelPctDe(p) });
      }
    }
    pontos.sort((a, b) => a.t - b.t);
    return pontos.filter((p, i) => i === 0 || p.t !== pontos[i - 1]!.t);
  }

  /**
   * Hectares trabalhados hoje, estimados pelo caminho (ver `areasDoCaminho`): total, e quanto foi dentro e fora dos
   * talhões. É uma estimativa; serve enquanto a Deere não informa a área da operação.
   */
  private async areaPeloCaminho(orgId: string, maquinaId: string): Promise<AreaDoCaminho> {
    const pontos = this.caminhoDeHoje(orgId, maquinaId);
    if (pontos.length < 2) return { totalHa: 0, dentroHa: 0, foraHa: 0 };
    const guardada = this.areasPeloCaminho.get(`${orgId}/${maquinaId}`);
    // O caminho cresce a cada 2 s: refazer a conta a cada 30 pontos novos basta.
    if (guardada && pontos.length >= guardada.pontos && pontos.length - guardada.pontos < 30) return guardada.area;
    const [talhoes, larguras, larguraPorMaquina] = await Promise.all([this.listarTalhoes(orgId).catch(() => [] as TalhaoExterno[]), this.largurasDasPassadas(orgId), this.largurasInformadas(orgId)]);
    const area = areasDoCaminho(pontos, talhoes, larguras, larguraPorMaquina.get(maquinaId));
    this.areasPeloCaminho.set(`${orgId}/${maquinaId}`, { pontos: pontos.length, area });
    return area;
  }
  private readonly areasPeloCaminho = new Map<string, { pontos: number; area: AreaDoCaminho }>();

  /**
   * Largura da passada em cada talhão, em metros, tirada das linhas que o talhão tem: área do talhão dividida pelo
   * comprimento somado das passadas. Talhão sem linhas não entra (vale a largura padrão).
   */
  private largurasDasPassadas(orgId: string): Promise<Map<string, number>> {
    return this.guardado(`larguras/${orgId}`, 10 * 60_000, async () => {
      const larguras = new Map<string, number>();
      const [talhoes, linhas] = await Promise.all([this.listarTalhoes(orgId).catch(() => [] as TalhaoExterno[]), this.listarLinhas(orgId).catch(() => [] as LinhaExterna[])]);
      for (const t of talhoes) {
        const metros = linhas.filter((l) => l.talhaoId === t.id).reduce((s, l) => s + (l.passadas ?? []).reduce((m, p) => m + comprimentoM(p), 0), 0);
        const largura = metros > 0 ? (t.areaHa * 10_000) / metros : 0;
        // Só vale largura plausível de implemento; fora disso as linhas não cobrem o talhão inteiro.
        if (largura >= 2 && largura <= 45) larguras.set(t.id, largura);
      }
      return larguras;
    });
  }

  /** Largura do implemento informada para cada máquina (vazio se ninguém informou). */
  private async largurasInformadas(orgId: string): Promise<Map<string, number>> {
    return (await this.config.obterLarguras?.(orgId).catch(() => new Map<string, number>())) ?? new Map<string, number>();
  }

  /**
   * A largura do implemento de alguma máquina mudou: os hectares de hoje são recalculados na próxima leitura e os
   * dias já fechados são refeitos pela busca do passado.
   */
  async larguraMudou(orgId: string): Promise<void> {
    for (const chave of [...this.areasPeloCaminho.keys()]) if (chave.startsWith(`${orgId}/`)) this.areasPeloCaminho.delete(chave);
    await this.config.diario?.limpar?.(orgId).catch(() => undefined);
  }

  /** Pontos do caminho de hoje já guardados (a mesma lista em memória: quem lê não deve alterar). */
  caminhoDeHoje(orgId: string, maquinaId: string): PontoDoCaminho[] {
    const c = this.caminhos.get(`${orgId}/${maquinaId}`);
    return c && c.dia === hojeNaFazenda() ? c.pontos : [];
  }

  /** Paradas de hoje (2 min ou mais), tiradas do caminho já guardado. */
  async paradasDeHoje(orgId: string, maquinaId: string): Promise<{ lng: number; lat: number; inicio: string; minutos: number }[]> {
    const c = this.caminhos.get(`${orgId}/${maquinaId}`);
    return c && c.dia === hojeNaFazenda() ? paradasDe(c.pontos) : [];
  }

  /**
   * Horas trabalhando, ocioso e em transporte hoje (pelo caminho do dia) e litros gastos hoje (ISO 15143-3).
   * Só máquina que deu sinal hoje tem o caminho lido; as outras devolvem nulo sem consultar a Deere.
   */
  async usoDeHoje(orgId: string, maquinaId: string): Promise<UsoDoDiaExterno | null> {
    const dia = hojeNaFazenda();
    const ultimo = this.ultimosRastros.get(`${orgId}/${maquinaId}`);
    const quando = Date.parse(ultimo?.eventTimestamp ?? ultimo?.gpsFixTimestamp ?? '');
    if (!Number.isFinite(quando) || quando < Date.parse(`${dia}T00:00:00-03:00`)) return null;
    await this.rastroDeHoje(orgId, maquinaId);
    const horas = horasPorEstado(this.caminhos.get(`${orgId}/${maquinaId}`)?.pontos ?? []);
    const lido = await ate(this.litrosDoDia(orgId, maquinaId, dia), 300, null);
    const combustivelL = lido?.litros ?? null;
    const area = await ate(this.areaPeloCaminho(orgId, maquinaId), 300, { totalHa: 0, dentroHa: 0, foraHa: 0 });
    return { ...horas, combustivelL, areaDentroHa: area.dentroHa, areaForaHa: area.foraHa };
  }

  /**
   * Litros que a máquina gastou no dia. Vem do MOTOR: combustível acumulado (ISO 15143-3, o número do monitor), última
   * leitura do dia menos a última do dia anterior. Sem as duas leituras, nulo (o relatório mostra "sem leitura").
   * A estimativa pela queda do tanque só entra se `combustivelPeloTanque` estiver ligado, e sai marcada como `estimado`
   * (o relatório avisa que aquele número não é o do motor).
   */
  private async litrosDoDia(orgId: string, maquinaId: string, dia: string): Promise<{ litros: number; estimado: boolean; desde?: string; horasMotor?: number; ociosoH?: number } | null> {
    const armazem = this.config.combustivel;
    // Consumo importado do Operations Center: é o número do monitor, com as horas do mesmo dia. Vem antes da ISO e antes
    // de qualquer chamada à John Deere: só precisa do banco, e o relatório só espera 300 ms por este número.
    const importado = await armazem?.importado?.(orgId, maquinaId, dia).catch(() => null);
    if (importado) {
      const ociosoH = importado.horasOcioso;
      return { litros: Math.round(importado.litros * 10) / 10, estimado: false, ...(importado.horasMotor !== null ? { horasMotor: Math.round(importado.horasMotor * 100) / 100 } : {}), ...(typeof ociosoH === 'number' ? { ociosoH } : {}) };
    }
    const maquina = (await this.listarMaquinas(orgId).catch(() => [] as MaquinaExterna[])).find((m) => m.id === maquinaId);
    const hoje = dia === hojeNaFazenda();
    const serie = maquina?.numeroSerie?.trim().toUpperCase();
    if (serie && armazem) {
      const [antes, guardada, horasAntes, horasGuardada, temposAntes, temposDia] = await Promise.all([
        armazem.buscar(orgId, serie, diaAntes(dia)).catch(() => null),
        armazem.buscar(orgId, serie, dia).catch(() => null),
        armazem.buscarHoras?.(orgId, serie, diaAntes(dia)).catch(() => null) ?? null,
        armazem.buscarHoras?.(orgId, serie, dia).catch(() => null) ?? null,
        armazem.tempos?.(orgId, serie, diaAntes(dia)).catch(() => null) ?? null,
        armazem.tempos?.(orgId, serie, dia).catch(() => null) ?? null,
      ]);
      // Hoje, a leitura mais nova pode estar só na memória (a frota é relida a cada 30 min).
      const agora = hoje ? (await this.frota(orgId)).get(serie) : undefined;
      const fim = agora?.litros ?? guardada;
      const horasFim = agora ? agora.horasMotor : horasGuardada;
      const fimPerto = agora ? contadoresProximos(agora.litrosEm, agora.horasEm) : contadoresProximos(temposDia?.litrosEm, temposDia?.horasEm);
      // As horas de motor do mesmo intervalo, só quando o litro e as horas das duas pontas foram lidos em horas próximas:
      // a Deere atualiza cada contador quando a máquina reporta, e eles não chegam juntos.
      const horasEntre = (inicio: number | null | undefined, inicioPerto: boolean) =>
        horasFim !== null && horasFim !== undefined && inicio !== null && inicio !== undefined && horasFim >= inicio && fimPerto && inicioPerto ? { horasMotor: Math.round((horasFim - inicio) * 100) / 100 } : {};
      if (antes !== null && fim !== null && fim >= antes) return { litros: Math.round((fim - antes) * 10) / 10, estimado: false, ...horasEntre(horasAntes, contadoresProximos(temposAntes?.litrosEm, temposAntes?.horasEm)) };
      // Sem a de ontem (a API ainda não guardava), hoje parte da primeira leitura do dia: o que a máquina gastou antes
      // dela fica de fora, e o relatório avisa "a partir das HH:MM" (a hora do contador, não a da nossa leitura).
      if (antes === null && hoje && fim !== null) {
        const primeira = await armazem.primeira?.(orgId, serie, dia).catch(() => null);
        if (primeira && fim >= primeira.litros) {
          const desde = horaNaFazenda(temposDia?.primeiraLitrosEm ?? primeira.em);
          return { litros: Math.round((fim - primeira.litros) * 10) / 10, estimado: false, desde, ...horasEntre(primeira.horasMotor, contadoresProximos(temposDia?.primeiraLitrosEm, temposDia?.primeiraHorasEm)) };
        }
      }
    }
    if (!this.config.combustivelPeloTanque) return null;
    const peloTanque = hoje
      ? litrosPelaQuedaDoTanque(this.caminhoDeHoje(orgId, maquinaId), tanqueDa(maquina))
      : ((await this.config.diario?.buscar(orgId, maquinaId, dia).catch(() => null))?.combustivelL ?? null);
    return peloTanque === null ? null : { litros: peloTanque, estimado: true };
  }

  /** Litros acumulados por número de série (ISO 15143-3 `/Fleet`). A Deere guarda essa resposta por 1 h: lemos a cada 30 min. */
  private frota(orgId: string): Promise<Map<string, LeituraDaFrota>> {
    return this.guardado(`frota/${orgId}`, 30 * 60_000, async () => {
      const litros = new Map<string, LeituraDaFrota>();
      // A documentação da Deere só publica o endereço do sandbox. Com `DEERE_AEMP_URL` usamos só ele; sem, testamos os
      // candidatos (o que já respondeu antes vai primeiro) e o log diz qual funcionou.
      const candidatos = this.config.aempUrl ? [this.config.aempUrl] : [...new Set([this.aempQueRespondeu, ...RAIZES_AEMP].filter((r): r is string => !!r))];
      const falhas: string[] = [];
      for (const raiz of candidatos) {
        try {
          let proxima: string | null = `${raiz.replace(/\/$/, '')}/Fleet/1`;
          let equipamentos = 0;
          let semOrganizacao: string | null = null;
          for (let i = 0; proxima && i < 10; i++) {
            const xml: string = await this.cliente.texto(orgId, proxima, 'application/xml');
            const lido = lerFrota(xml);
            equipamentos += lido.equipamentos;
            semOrganizacao ??= lido.ligacaoPendente;
            for (const [serie, leitura] of lido.leituras) litros.set(serie, leitura);
            proxima = lido.proxima && lido.proxima !== proxima ? lido.proxima : null;
          }
          this.aempQueRespondeu = raiz;
          const aviso = semOrganizacao ? ` | a Deere pede para liberar a organização para o aplicativo: ${semOrganizacao}` : '';
          this.config.registrar?.(`combustível acumulado (ISO 15143-3, ${raiz}): ${equipamentos} máquina(s) na frota, ${litros.size} com combustível acumulado${aviso}`);
          // Guarda a leitura do dia: é dela que saem os litros exatos de cada dia.
          if (litros.size > 0) await this.config.combustivel?.guardar(orgId, hojeNaFazenda(), [...litros].map(([serie, l]) => ({ serie, litros: l.litros, horasMotor: l.horasMotor, litrosEm: l.litrosEm, horasEm: l.horasEm }))).catch(() => undefined);
          return litros;
        } catch (e) {
          falhas.push(`${raiz} → ${e instanceof DeereErro ? `resposta ${e.status}${e.detalhe ? ` "${e.detalhe}"` : ''}` : 'sem resposta'}`);
        }
      }
      this.config.registrar?.(`combustível acumulado (ISO 15143-3): não veio (${falhas.join('; ')})`);
      return litros;
    });
  }

  /** Posição e velocidade (Breadcrumbs, com Location History de reserva) e se o motor está ligado. Nulo se a máquina nunca reportou. */
  async ultimaPosicao(orgId: string, maquinaId: string): Promise<PosicaoExterna | null> {
    const id = encodeURIComponent(maquinaId);
    const [rastro, estados] = await Promise.all([
      this.ultimoRastro(orgId, maquinaId),
      // Só os relatórios das últimas 6 h e só UMA página: sem data, a Deere devolve 2 meses, de 10 em 10.
      this.guardado(`estado/${orgId}/${maquinaId}`, 30_000, () =>
        this.semAcesso(orgId, maquinaId) ? Promise.resolve([]) : this.umaPagina<EstadoDoAparelhoDeere>(orgId, `/machines/${id}/deviceStateReports?startDate=${new Date(Math.floor(Date.now() / 60_000) * 60_000 - 6 * 3_600_000).toISOString()}&itemLimit=100`),
      ),
    ]);
    return posicaoDe(maquinaId, rastro ? [rastro] : [], estados);
  }

  /** Talhões não arquivados com o contorno ativo (Fields + Boundaries). Talhão sem contorno fica de fora. */
  listarTalhoes(orgId: string): Promise<TalhaoExterno[]> {
    return this.guardado(`talhoes/${orgId}`, 10 * 60_000, async () => {
      const todos: TalhaoExterno[] = [];
      const importados = this.importadas.get(orgId)?.talhoes ?? [];
      try {
        for (const orgDeere of await this.organizacoes(orgId)) {
          const org = encodeURIComponent(orgDeere);
          // Os contornos vêm junto da lista (`embed=boundaries`, como a documentação da Deere indica).
          const campos = (await this.cliente.listar<CampoDeere>(orgId, `/organizations/${org}/fields?embed=boundaries&itemLimit=100`)).filter((c) => !c.archived);
          // Reserva: todos os contornos da organização numa lista só, buscada no máximo uma vez e só se algum talhão precisar.
          let daOrganizacao: Promise<Map<string, LimiteDeere[]>> | null = null;
          const contornosDaOrganizacao = () => (daOrganizacao ??= this.contornosPorCampo(orgId, org));
          const talhoes = await emLotes(campos, async (campo) => talhaoDe(campo, limiteAtivo(await this.limitesDoCampo(orgId, org, campo, contornosDaOrganizacao))));
          for (const t of talhoes) {
            if (!t) continue;
            this.orgDoCampo.set(`${orgId}/${t.id}`, orgDeere);
            todos.push(t);
          }
        }
      } catch (e) {
        // A Deere falhou, mas há talhões do arquivo: o mapa abre com eles em vez de ficar vazio.
        if (importados.length === 0) throw e;
      }
      // Talhões do arquivo importado entram junto. Se a Deere já desenha um com o mesmo nome, vale o dela.
      const nomes = new Set(todos.map((t) => t.nome.trim().toLowerCase()));
      for (const t of importados) if (!nomes.has(t.nome.trim().toLowerCase())) todos.push(t);
      return todos;
    });
  }

  /**
   * Contornos de um talhão, tentando do mais barato ao mais caro até achar um com desenho:
   * 1. o que veio junto da lista de talhões; 2. a lista de contornos da organização (uma chamada para todos);
   * 3. os endereços que a própria Deere indica no talhão (links `activeBoundary` e `boundaries`: valem mesmo quando o talhão é de outra organização);
   * 4. o endereço montado, primeiro só os ativos e depois todos (`recordFilter=all`).
   * A resposta da Deere já traz os pontos (`multipolygons`); não existe `embed` para isso.
   */
  private async limitesDoCampo(orgId: string, org: string, campo: CampoDeere, daOrganizacao: () => Promise<Map<string, LimiteDeere[]>>): Promise<LimiteDeere[]> {
    const comDesenho = (l: LimiteDeere | undefined): l is LimiteDeere => contornoDe(l).length >= 4;
    const juntos = [campo.activeBoundary, ...(Array.isArray(campo.boundaries) ? campo.boundaries : (campo.boundaries?.values ?? []))].filter((l): l is LimiteDeere => !!l);
    if (juntos.some(comDesenho)) return juntos.filter(comDesenho);

    const id = String(campo.id);
    const link = (rel: string) => campo.links?.find((l) => l.rel === rel)?.uri?.replace(/\s+/g, '');
    const lista = link('boundaries');
    const ativo = link('activeBoundary');
    const montado = `/organizations/${org}/fields/${encodeURIComponent(id)}/boundaries`;
    const tentativas: (() => Promise<LimiteDeere[]>)[] = [
      async () => (await daOrganizacao()).get(id.toLowerCase()) ?? [],
      // O talhão diz qual é o contorno ativo dele (link `activeBoundary`): um pedido direto, sem lista.
      ...(ativo ? [async () => [await this.cliente.obter<LimiteDeere>(orgId, ativo)]] : []),
      ...(lista ? [() => this.cliente.listar<LimiteDeere>(orgId, lista)] : []),
      () => this.cliente.listar<LimiteDeere>(orgId, montado),
      () => this.cliente.listar<LimiteDeere>(orgId, `${montado}?recordFilter=all`),
      // Talhão sem contorno desenhado na Deere: ela gera um a partir da área trabalhada na operação mais recente.
      () => this.contornoPelaOperacao(orgId, org, id),
    ];
    for (const tentar of tentativas) {
      const limites = (await tentar().catch(() => [] as LimiteDeere[])).filter(comDesenho);
      if (limites.length > 0) return limites;
    }
    return [];
  }

  /**
   * Contorno gerado pela Deere em volta da área trabalhada (`GET /fieldOperations/{id}/boundary`), para talhão que
   * não tem contorno desenhado. Tenta as operações mais recentes primeiro. Só lê: nada é gravado na conta.
   * É aproximado: segue onde a máquina passou, não a divisa oficial do talhão.
   */
  private async contornoPelaOperacao(orgId: string, org: string, campoId: string): Promise<LimiteDeere[]> {
    const operacoes = await this.cliente.listar<OperacaoDeere>(orgId, `/organizations/${org}/fields/${encodeURIComponent(campoId)}/fieldOperations`).catch(() => [] as OperacaoDeere[]);
    const recentes = operacoes
      .filter((o) => o.id)
      .sort((a, b) => Date.parse(b.endDate ?? b.startDate ?? '') - Date.parse(a.endDate ?? a.startDate ?? ''))
      .slice(0, 3);
    for (const op of recentes) {
      const gerado = await this.cliente.obter<LimiteDeere>(orgId, `/fieldOperations/${encodeURIComponent(op.id)}/boundary`).catch(() => undefined);
      if (gerado && contornoDe(gerado).length >= 4) return [gerado];
    }
    return [];
  }

  /** Todos os contornos da organização, agrupados pelo talhão (o id sai do link `field` de cada contorno). */
  private async contornosPorCampo(orgId: string, org: string): Promise<Map<string, LimiteDeere[]>> {
    const porCampo = new Map<string, LimiteDeere[]>();
    const todos = await this.cliente.listar<LimiteDeere>(orgId, `/organizations/${org}/boundaries?itemLimit=100`).catch(() => [] as LimiteDeere[]);
    for (const limite of todos) {
      const campo = limite.links?.find((l) => l.rel === 'field')?.uri?.trim().split('/').pop()?.split('?')[0]?.toLowerCase();
      if (!campo) continue;
      porCampo.set(campo, [...(porCampo.get(campo) ?? []), limite]);
    }
    return porCampo;
  }

  /** Em qual organização da Deere cada talhão está (preenchido por `listarTalhoes`). */
  private readonly orgDoCampo = new Map<string, string>();

  /** Todas as organizações em uso; a principal vem primeiro. */
  private organizacoes(orgId: string): Promise<string[]> {
    return this.config.obterOrganizacoes ? this.config.obterOrganizacoes(orgId) : this.config.obterOrganizacao(orgId).then((o) => [o]);
  }

  /** Organização do talhão; na falta dele, a principal. */
  /**
   * Todos os talhões da John Deere (não arquivados), COM ou SEM contorno. As operações de campo são lidas por esta
   * lista: um talhão sem desenho não aparece no mapa, mas o trabalho feito nele conta no relatório.
   */
  private camposDaDeere(orgId: string): Promise<{ id: string }[]> {
    return this.guardado(`campos/${orgId}`, 10 * 60_000, async () => {
      const todos: { id: string }[] = [];
      for (const orgDeere of await this.organizacoes(orgId)) {
        const campos = await this.cliente.listar<CampoDeere>(orgId, `/organizations/${encodeURIComponent(orgDeere)}/fields?embed=boundaries&itemLimit=100`);
        for (const c of campos) {
          if (c.archived || c.id === undefined || c.id === null) continue;
          const id = String(c.id);
          if (!this.orgDoCampo.has(`${orgId}/${id}`)) this.orgDoCampo.set(`${orgId}/${id}`, orgDeere);
          todos.push({ id });
        }
      }
      return todos;
    });
  }

  private async organizacaoDoTalhao(orgId: string, talhaoId: string): Promise<string> {
    await this.listarTalhoes(orgId).catch(() => undefined);
    return this.orgDoCampo.get(`${orgId}/${talhaoId}`) ?? (await this.config.obterOrganizacao(orgId));
  }

  private readonly guardados = new Map<string, { ate: number; dado: Promise<unknown> }>();

  /** Guarda o resultado por um tempo e junta pedidos simultâneos: várias telas abertas juntas fazem uma consulta só. */
  private guardado<T>(chave: string, ttlMs: number, buscar: () => Promise<T>): Promise<T> {
    const g = this.guardados.get(chave);
    if (g && g.ate > Date.now()) return g.dado as Promise<T>;
    const dado = buscar()
      .then((valor) => {
        this.ultimos.set(chave, valor);
        return valor;
      })
      .catch((e) => {
        this.guardados.delete(chave);
        throw e;
      });
    this.guardados.set(chave, { ate: Date.now() + ttlMs, dado });
    // Venceu, mas já houve uma resposta boa: entrega a anterior na hora e atualiza por trás. Só a primeira
    // consulta de todas espera a John Deere; daí em diante ninguém fica olhando para a tela carregando.
    if (this.ultimos.has(chave)) {
      dado.catch(() => undefined);
      return Promise.resolve(this.ultimos.get(chave) as T);
    }
    return dado;
  }

  /** Última resposta boa de cada consulta guardada (ver `guardado`). */
  private readonly ultimos = new Map<string, unknown>();

  /** Trocou de organização: nada do que estava guardado da fazenda vale mais. */
  esquecer(orgId: string): void {
    const dela = (chave: string) => chave.split('/').includes(orgId);
    for (const mapa of [this.guardados, this.ultimos, this.cacheRastro, this.ultimosRastros, this.caminhos, this.areasPeloCaminho, this.cacheOperacoes, this.ultimasOperacoes, this.orgDoCampo, this.apelidosDeMaquina]) {
      for (const chave of [...mapa.keys()]) if (dela(chave)) mapa.delete(chave);
    }
  }

  /**
   * Deixa pronto o que as telas pedem ao abrir (talhões, máquinas, posição, medições e andamento), para o
   * primeiro acesso não esperar a John Deere. Chamado ao subir o servidor e a cada rodada de sincronização.
   */
  /**
   * Consumo de combustível e horas de motor por dia (Machine Measurements, o mesmo número do Operations Center), de
   * `desde` a `ate` (AAAA-MM-DD, horário de Brasília). Sem `startDate` em hora local a Deere desloca a janela, então
   * as datas vão sem fuso e com `utcOffSet=-03`: os baldes diários caem nos dias de Brasília.
   * A Deere só devolve baldes diários para períodos de mais de 1 dia e menos de 31: o pedido é ajustado.
   */
  async consumoDiario(orgId: string, maquinaId: string, desde: string, ate: string): Promise<ConsumoDoDia[]> {
    const id = encodeURIComponent(maquinaId);
    const dias = Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000) + 1;
    if (!Number.isFinite(dias) || dias < 1 || dias > 30) throw new Error('consumoDiario: o período precisa ter de 1 a 30 dias');
    // Um dia só devolve baldes de hora: começa um dia antes e descarta.
    const inicio = dias < 2 ? diaAntes(desde) : desde;
    let ids = this.idsMedicao.get(maquinaId);
    if (!ids) {
      // Os ids das medições mudam por modelo: descobre uma vez por máquina (balde agregado, resposta pequena).
      const lista = await this.cliente.obterCompleto<unknown>(orgId, `/machines/${id}/machineMeasurements?embed=measurementDefinition&startDate=${diaAntes(ate)}T00:00:00.000&endDate=${ate}T23:59:59.999&utcOffSet=-03&interval=aggregated`);
      const achados = acharIdsDeMedicao(lista);
      if (!achados.combustivel || !achados.utilizacao) return [];
      ids = { combustivel: achados.combustivel, utilizacao: achados.utilizacao };
      this.idsMedicao.set(maquinaId, ids);
    }
    const resposta = await this.cliente.obterCompleto<unknown>(
      orgId,
      `/machines/${id}/machineMeasurements?embed=measurementDefinition&measurementDefinitionId=${ids.combustivel},${ids.utilizacao}&startDate=${inicio}T00:00:00.000&endDate=${ate}T23:59:59.999&utcOffSet=-03`,
    );
    return lerConsumoDiario(resposta, -3).filter((c) => c.dia >= desde && c.dia <= ate);
  }

  /**
   * "Todos os dados" da máquina no período (de a ate, AAAA-MM-DD, horário de Brasília, até 30 dias): todas as medições
   * que o Analisador da Máquina mostra, agregadas no período inteiro (`interval=aggregated`, que bate com os totais
   * do Operations Center). Fica 1 min em memória (hoje) ou 1 h (dia passado): a resposta tem uns 250 KB.
   */
  analiseDaMaquina(orgId: string, maquinaId: string, de: string, ate: string): Promise<AnaliseDaMaquina> {
    const dias = Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000) + 1;
    if (!Number.isFinite(dias) || dias < 1 || dias > 30) return Promise.reject(new Error('analiseDaMaquina: o período precisa ter de 1 a 30 dias'));
    const passado = ate < hojeNaFazenda();
    return this.guardado(`analise/${orgId}/${maquinaId}/${de}/${ate}`, passado ? 3_600_000 : 60_000, async () => {
      const id = encodeURIComponent(maquinaId);
      const resposta = await this.cliente.obterCompleto<unknown>(
        orgId,
        `/machines/${id}/machineMeasurements?embed=measurementDefinition&startDate=${de}T00:00:00.000&endDate=${ate}T23:59:59.999&utcOffSet=-03&interval=aggregated`,
      );
      return lerAnaliseDaMaquina(maquinaId, de, ate, resposta);
    });
  }

  /**
   * Alertas que a máquina registrou entre `desde` e `ate` (a Deere aceita até 7 dias por consulta): falhas de
   * diagnóstico (DTC), cerca eletrônica e manutenção. Do mais antigo para o mais novo.
   */
  async alertasDaMaquina(orgId: string, maquinaId: string, desde: Date, ate: Date = new Date()): Promise<AlertaDaMaquina[]> {
    const id = encodeURIComponent(maquinaId);
    const limite = ate.getTime() - 7 * 86_400_000;
    const inicio = new Date(Math.max(desde.getTime(), limite));
    const brutos = await this.cliente.listar<unknown>(orgId, `/machines/${id}/alerts?startDate=${inicio.toISOString()}&endDate=${ate.toISOString()}&itemLimit=100`);
    return lerAlertas(brutos);
  }

  /** Ids das medições de combustível e utilização, por máquina (descobertos na primeira consulta). */
  private readonly idsMedicao = new Map<string, { combustivel: string; utilizacao: string }>();

  async aquecer(orgId: string): Promise<void> {
    const [maquinas] = await Promise.all([this.listarMaquinas(orgId), this.listarTalhoes(orgId).catch(() => [])]);
    await emLotes(maquinas, (m) => Promise.all([this.ultimaPosicao(orgId, m.id), this.medicoes(orgId, m.id)]).catch(() => undefined));
    // Horas de motor ligado dos últimos 2 meses: o relatório abre com os números prontos, sem esperar a Deere.
    await emLotes(maquinas, (m) => this.ligadoPorDia(orgId, m.id).catch(() => undefined));
    // Caminho de hoje de cada máquina: dele saem a área e o tempo parado do relatório. Sem isto, depois de reiniciar o
    // servidor esses números ficavam em zero até alguém abrir o mapa.
    await emLotes(maquinas, (m) => this.rastroDeHoje(orgId, m.id).catch(() => undefined));
    await this.guardado(`resumo/${orgId}`, 2 * 60_000, () => this.calcularResumo(orgId)).catch(() => undefined);
    // Combustível acumulado do motor: relido a cada 30 min mesmo sem ninguém no app, para o dia fechar com a leitura certa.
    if (this.config.combustivel) await this.frota(orgId).catch(() => undefined);
  }
  async atividadeDoDia(orgId: string, maquinaId: string): Promise<AtividadeExterna> {
    const dia = hojeNaFazenda();
    const { horas, areaHa } = await this.atividadeNoDia(orgId, maquinaId, dia);
    const doDia = (await ate(this.operacoesDaMaquina(orgId, maquinaId), 400, [])).filter(({ op }) => fatiaDoDia(op, dia).fracao > 0);
    const ultima = doDia.sort((a, b) => Date.parse(b.op.endDate ?? '') - Date.parse(a.op.endDate ?? ''))[0];
    return { horas, areaHa, operador: ultima ? operadorDaOperacao(ultima.op, maquinaId) : null };
  }

  /** Só o nome da fazenda: barato e guardado por 30 min (o relatório não precisa do andamento por talhão). */
  nomeDaFazenda(orgId: string): Promise<string> {
    return this.guardado(`nome/${orgId}`, 30 * 60_000, async () => {
      const org = await this.config.obterOrganizacao(orgId);
      const dados = await this.cliente.obter<{ name?: string }>(orgId, `/organizations/${encodeURIComponent(org)}`).catch(() => ({}) as { name?: string });
      return dados.name ?? 'Fazenda';
    });
  }

  /** Nome da organização e, por talhão, a operação mais recente (últimos 3 dias) com o quanto da área já foi feito. */
  resumoDaFazenda(orgId: string): Promise<ResumoFazendaExterno> {
    const completo = this.guardado(`resumo/${orgId}`, 2 * 60_000, () => this.calcularResumo(orgId));
    // O andamento por talhão é lento na primeira vez (muitas consultas). A tela não espera: devolve vazio e,
    // quando o cálculo termina, a próxima abertura já vem pronta do cache.
    const vazio = new Promise<ResumoFazendaExterno>((ok) => setTimeout(() => ok({ nome: '', operacoesPorTalhao: {}, percentualPorTalhao: {}, operacaoAtual: null }), 500).unref?.());
    return Promise.race([completo, vazio]);
  }

  private async calcularResumo(orgId: string): Promise<ResumoFazendaExterno> {
    const org = await this.config.obterOrganizacao(orgId);
    const dados = await this.cliente.obter<{ name?: string }>(orgId, `/organizations/${encodeURIComponent(org)}`).catch(() => ({}) as { name?: string });
    const talhoes = await this.listarTalhoes(orgId);
    const corte = Date.now() - 3 * 86_400_000;
    const operacoesPorTalhao: ResumoFazendaExterno['operacoesPorTalhao'] = {};
    const percentualPorTalhao: ResumoFazendaExterno['percentualPorTalhao'] = {};
    let atual: { nome: string; percentual: number; quando: number } | null = null;
    for (const talhao of talhoes) {
      const recente = (await this.operacoesDoTalhao(orgId, talhao.id))
        .map((op) => ({ op, tipo: operacaoDe(op.fieldOperationType), fim: Date.parse(op.endDate ?? '') }))
        .filter((o) => o.tipo && o.fim >= corte)
        .sort((a, b) => b.fim - a.fim)[0];
      if (!recente?.tipo) continue;
      const pct = talhao.areaHa > 0 ? Math.min(100, Math.round(((await this.areaDaOperacao(orgId, recente.op)) / talhao.areaHa) * 100)) : 0;
      operacoesPorTalhao[talhao.id] = recente.tipo;
      percentualPorTalhao[talhao.id] = pct;
      if (!atual || recente.fim > atual.quando) atual = { nome: `${ROTULO[recente.tipo]} · ${talhao.nome}`, percentual: pct, quando: recente.fim };
    }
    return { nome: dados.name ?? 'Fazenda', operacoesPorTalhao, percentualPorTalhao, operacaoAtual: atual ? { nome: atual.nome, percentual: atual.percentual } : null };
  }

  /** Linhas de guia de todos os talhões: retas (AB) e curvas (com o traçado, `embed=shapes`). Pivô não é lido. */
  async listarLinhas(orgId: string): Promise<LinhaExterna[]> {
    // Só os talhões que existem na Deere são consultados lá; os do arquivo já trazem as linhas deles.
    const talhoes = (await this.listarTalhoes(orgId)).filter((t) => !this.ehImportado(orgId, t.id));
    const doArquivo = this.importadas.get(orgId)?.linhas ?? [];
    const porTalhao = await emLotes(talhoes, async (t) => {
      const org = encodeURIComponent(await this.organizacaoDoTalhao(orgId, t.id));
      const linhas = await this.cliente.listar<LinhaDeere>(orgId, `/organizations/${org}/fields/${encodeURIComponent(t.id)}/guidanceLines?embed=shapes`).catch(() => []);
      return linhas.map((l) => linhaDe(l, t.id)).filter((l): l is LinhaExterna => l !== null);
    });
    return [...porTalhao.flat(), ...doArquivo];
  }
  /** Envia uma linha AB para o talhão (o id do talhão do Talhio é o id do campo na Deere). A API não aceita linhas curvas nem linhas sem talhão. */
  async enviarLinha(orgId: string, linha: LinhaExterna, _chave: string): Promise<void> {
    if (!linha.talhaoId) throw new Error('A John Deere só recebe linha dentro de um talhão. Escolha o talhão da linha.');
    if (linha.passadas) throw new Error('A John Deere só recebe linha reta (AB). Linha curva não pode ser enviada.');
    const org = encodeURIComponent(await this.organizacaoDoTalhao(orgId, linha.talhaoId));
    await this.cliente.criar(orgId, `/organizations/${org}/fields/${encodeURIComponent(linha.talhaoId)}/guidanceLines`, linhaParaEnviar(linha.nome, linha.a, linha.b));
  }
  enviarPlano(_orgId: string, _plano: PlanoExterno, _chave: string): Promise<void> {
    return this.pendente('Work Plans API');
  }

  // --- Sincronização: export ponto a ponto das operações recentes ---

  /** Raiz do export: a mesma da API, trocando /platform por /isg. */
  private get baseExport(): string {
    return this.config.baseUrl.replace(/\/platform\/?$/, '/isg');
  }

  private readonly pedidosEmAberto = new Map<string, string>();

  /**
   * Pede (ou confere) o export de cada operação dos últimos `diasAtras` dias que ainda não foi lida ou mudou,
   * lê o shapefile e guarda os totais por máquina e dia. Roda em segundo plano; o app só lê o que está guardado.
   * O export é assíncrono: o que não terminar fica para a próxima rodada.
   */
  async sincronizar(orgId: string, diasAtras = 14): Promise<ResultadoSincronizacao> {
    const armazem = this.config.armazem;
    const r: ResultadoSincronizacao = { lidas: 0, esperando: 0, falhas: 0 };
    if (!armazem) return r;
    const lidas = await armazem.versoes(orgId);
    const corte = Date.now() - diasAtras * 86_400_000;
    // Todos os talhões da Deere, inclusive os sem contorno: o trabalho feito neles também conta.
    const talhoes = await this.camposDaDeere(orgId);
    // Sempre releia a lista: operação em andamento muda a cada rodada.
    this.cacheOperacoes.clear();
    const todas = (await emLotes(talhoes, (t) => this.operacoesDoTalhao(orgId, t.id))).flat();
    const recentes = todas.filter((op) => Date.parse(op.endDate ?? op.startDate ?? '') >= corte);
    const pendentes = recentes.filter((op) => lidas.get(op.id) !== versaoDe(op));
    const maisNova = todas.map((op) => Date.parse(op.endDate ?? op.startDate ?? '')).filter(Number.isFinite).sort((a, b) => b - a)[0];
    this.config.registrar?.(
      `operações de campo: ${talhoes.length} talhão(ões) consultados, ${todas.length} operação(ões) no total, ${recentes.length} nos últimos ${diasAtras} dias, ${pendentes.length} para ler; a mais recente é de ${maisNova ? new Date(maisNova).toISOString() : 'nenhuma'}`,
    );
    for (const op of pendentes) {
      try {
        const dias = await this.exportar(orgId, op);
        if (!dias) {
          r.esperando++;
          continue;
        }
        await armazem.guardar(orgId, op.id, versaoDe(op), dias);
        r.lidas++;
      } catch {
        r.falhas++;
      }
    }
    return r;
  }

  /** Um passo do export da operação: pede, confere e, se pronto, baixa e lê. Nulo = ainda não terminou. */
  private async exportar(orgId: string, op: OperacaoDeere): Promise<DiaDeMaquina[] | null> {
    const base = `${this.baseExport}/operations/${encodeURIComponent(op.id)}/operationsExportRequests`;
    const chave = `${orgId}/${op.id}/${versaoDe(op)}`;
    let pedido = this.pedidosEmAberto.get(chave);
    if (!pedido) {
      const novo = await this.cliente.criar(
        orgId,
        `/operations/${encodeURIComponent(op.id)}/operationsExportRequests`,
        { exportSettings: { format: 'SHAPEFILE', shapeType: 'Point', resolution: 'OneHertz' } },
        { base: this.baseExport, cabecalhos: { 'Content-Type': 'application/json', 'Accept-UOM-System': 'METRIC' } },
      );
      if (!novo) throw new Error('A John Deere não devolveu o id do pedido de export.');
      pedido = novo;
      this.pedidosEmAberto.set(chave, pedido);
    }
    const estado = await this.cliente.obter<{ requestStatus?: string; files?: { presignedUri?: string }[] }>(orgId, `${base}/${encodeURIComponent(pedido)}`);
    const situacao = (estado.requestStatus ?? '').toUpperCase();
    if (situacao === 'FAILURE' || situacao === 'FAILED') {
      this.pedidosEmAberto.delete(chave);
      throw new Error('O export da John Deere falhou.');
    }
    if (situacao !== 'SUCCESSFUL') return null;
    this.pedidosEmAberto.delete(chave);

    const unica = op.fieldOperationMachines?.length === 1 ? String(op.fieldOperationMachines[0]!.machineId) : null;
    const somados = new Map<string, DiaDeMaquina>();
    for (const arquivo of estado.files ?? []) {
      if (!arquivo.presignedUri) continue;
      const zip = await this.cliente.baixar(arquivo.presignedUri);
      // Até conferirmos as colunas com um export real: o log traz o que cada uma contém (combustível incluído).
      this.config.registrar?.(`export da operação ${op.id}: ${resumoDoExport(zip)}`);
      for (const d of lerExportacao(zip, unica)) {
        // O arquivo pode trazer o id que a operação usa; fica o id da nossa lista de máquinas.
        d.maquinaId = this.apelidosDeMaquina.get(`${orgId}/${d.maquinaId}`) ?? d.maquinaId;
        const k = `${d.maquinaId}|${d.dia}`;
        const a = somados.get(k);
        if (!a) somados.set(k, { ...d });
        else {
          a.horas += d.horas;
          a.areaHa += d.areaHa;
          a.combustivelL += d.combustivelL;
          a.paradoMin += d.paradoMin;
        }
      }
    }
    // A área ponto a ponto soma sobreposição: ajusta ao total oficial da operação, mantendo a divisão entre dias.
    const oficial = await this.areaDaOperacao(orgId, op);
    const bruta = [...somados.values()].reduce((t, d) => t + d.areaHa, 0);
    for (const d of somados.values()) {
      if (oficial > 0 && bruta > 0) d.areaHa = (d.areaHa / bruta) * oficial;
      d.areaHa = Math.round(d.areaHa * 100) / 100;
    }
    return [...somados.values()];
  }

  // --- Operações de campo, com cache curto para não estourar o limite de chamadas da Deere ---

  private readonly cacheOperacoes = new Map<string, { ate: number; dados: Promise<OperacaoDeere[]> }>();
  private readonly cacheAreas = new Map<string, Promise<number>>();

  /** Última lista boa de cada talhão: enquanto a nova é buscada (a cada 60 s), quem pede recebe esta, sem esperar a Deere. */
  private readonly ultimasOperacoes = new Map<string, OperacaoDeere[]>();

  private operacoesDoTalhao(orgId: string, talhaoId: string): Promise<OperacaoDeere[]> {
    if (this.ehImportado(orgId, talhaoId)) return Promise.resolve([]); // talhão do arquivo: a Deere não o conhece
    const chave = `${orgId}/${talhaoId}`;
    const guardado = this.cacheOperacoes.get(chave);
    if (guardado && guardado.ate > Date.now()) return guardado.dados;
    const dados = this.organizacaoDoTalhao(orgId, talhaoId)
      .then((org) => this.cliente.listar<OperacaoDeere>(orgId, `/organizations/${encodeURIComponent(org)}/fields/${encodeURIComponent(talhaoId)}/fieldOperations`))
      .catch((e) => {
        if (e instanceof DeereErro && e.status === 404) return [] as OperacaoDeere[]; // talhão sem operações
        this.cacheOperacoes.delete(chave);
        throw e;
      })
      .then((lista) => this.comMaquinasConhecidas(orgId, lista))
      .then((lista) => {
        this.ultimasOperacoes.set(chave, lista);
        return lista;
      });
    this.cacheOperacoes.set(chave, { ate: Date.now() + 60_000, dados });
    const antiga = this.ultimasOperacoes.get(chave);
    if (antiga) {
      dados.catch(() => undefined); // a atualização falhar não derruba quem recebeu a lista antiga
      return Promise.resolve(antiga);
    }
    return dados;
  }

  /** Id que a operação usa para a máquina -> id da máquina na nossa lista, quando os dois diferem (casados pelo chassi). */
  private readonly apelidosDeMaquina = new Map<string, string>();

  /**
   * A operação identifica a máquina por `machineId` e pelo chassi (`vin`). Se o `machineId` não é de nenhuma máquina
   * da nossa lista mas o chassi é, troca pelo id da lista: assim área, horas e operador caem na máquina certa.
   */
  private async comMaquinasConhecidas(orgId: string, operacoes: OperacaoDeere[]): Promise<OperacaoDeere[]> {
    const maquinas = await this.listarMaquinas(orgId).catch(() => [] as MaquinaExterna[]);
    const ids = new Set(maquinas.map((m) => m.id));
    const porChassi = new Map(maquinas.flatMap((m) => (m.numeroSerie ? [[m.numeroSerie.trim().toUpperCase(), m.id] as const] : [])));
    for (const op of operacoes) {
      for (const m of op.fieldOperationMachines ?? []) {
        const original = String(m.machineId);
        if (ids.has(original)) continue;
        const conhecida = m.vin ? porChassi.get(m.vin.trim().toUpperCase()) : undefined;
        if (!conhecida) continue;
        this.apelidosDeMaquina.set(`${orgId}/${original}`, conhecida);
        m.machineId = conhecida;
      }
    }
    return operacoes;
  }

  /** Operações em que a máquina trabalhou (em todos os talhões). */
  private async operacoesDaMaquina(orgId: string, maquinaId: string): Promise<{ op: OperacaoDeere; talhaoId: string }[]> {
    const talhoes = await this.camposDaDeere(orgId);
    const listas = await emLotes(talhoes, async (t) => (await this.operacoesDoTalhao(orgId, t.id)).map((op) => ({ op, talhaoId: t.id })));
    return listas.flat().filter(({ op }) => op.fieldOperationMachines?.some((m) => String(m.machineId) === maquinaId));
  }

  /**
   * Área e horas de cada máquina em cada dia de `de` a `ate` (AAAA-MM-DD, horário de Brasília), pelas operações de
   * campo de todos os talhões. A mesma conta de `estimarDia` (a área da operação repartida pelos dias em que ela
   * correu), mas ESPERA a John Deere: é para o serviço que grava o mês inteiro no banco, não para a tela.
   */
  async areaDasOperacoes(orgId: string, de: string, ate: string): Promise<AreaDoDia[]> {
    const talhoes = await this.camposDaDeere(orgId);
    const operacoes = (await emLotes(talhoes, (t) => this.operacoesDoTalhao(orgId, t.id).catch(() => [] as OperacaoDeere[]))).flat();
    const inicio = inicioDoDia(de);
    const fim = inicioDoDia(ate) + 86_400_000;
    const diaDe = (ms: number) => new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10);
    const noPeriodo = operacoes.filter((op) => {
      const ini = Date.parse(op.startDate ?? '');
      const termino = Date.parse(op.endDate ?? op.startDate ?? '');
      return Number.isFinite(ini) && Number.isFinite(termino) && termino >= inicio && ini < fim && (op.fieldOperationMachines?.length ?? 0) > 0;
    });
    const areas = await emLotes(noPeriodo, (op) => this.areaDaOperacao(orgId, op).catch(() => 0));
    const soma = new Map<string, AreaDoDia>();
    noPeriodo.forEach((op, i) => {
      const area = areas[i] ?? 0;
      const maquinas = [...new Set((op.fieldOperationMachines ?? []).map((m) => (m.machineId === undefined || m.machineId === null ? '' : String(m.machineId))).filter((id) => id))];
      const ini = Math.max(inicio, Date.parse(op.startDate ?? ''));
      const termino = Math.min(fim - 1, Date.parse(op.endDate ?? op.startDate ?? ''));
      for (let dia = diaDe(ini); dia <= diaDe(termino); dia = diaDe(inicioDoDia(dia) + 86_400_000 + 3_600_000)) {
        const fatia = fatiaDoDia(op, dia);
        if (fatia.fracao <= 0) continue;
        for (const maquinaId of maquinas) {
          const chave = `${maquinaId}|${dia}`;
          const atual = soma.get(chave) ?? { maquinaId, dia, areaHa: 0, horas: 0 };
          atual.areaHa += area * fatia.fracao;
          atual.horas += fatia.horas;
          soma.set(chave, atual);
        }
      }
    });
    return [...soma.values()]
      .map((a) => ({ ...a, areaHa: Math.round(a.areaHa * 100) / 100, horas: Math.round(a.horas * 100) / 100 }))
      .filter((a) => a.areaHa > 0 || a.horas > 0)
      .sort((a, b) => a.dia.localeCompare(b.dia) || a.maquinaId.localeCompare(b.maquinaId));
  }

  /** Hectares trabalhados na operação (medição "Result"); 0 se a Deere não informar. Fica guardado: operação encerrada não muda. */
  private areaDaOperacao(orgId: string, op: OperacaoDeere): Promise<number> {
    const guardado = this.cacheAreas.get(op.id);
    if (guardado) return guardado;
    const id = encodeURIComponent(op.id);
    const area = this.cliente
      .listar<unknown>(orgId, `/fieldOperations/${id}/measurementTypes`)
      .then(async (lista) => {
        const nome = medicaoEscolhida(lista);
        if (!nome) return 0;
        return areaDaMedicao(await this.cliente.obter<MedicaoDeOperacaoDeere>(orgId, `/fieldOperations/${id}/measurementTypes/${encodeURIComponent(nome)}`)) ?? 0;
      })
      .catch(() => {
        this.cacheAreas.delete(op.id);
        return 0;
      });
    this.cacheAreas.set(op.id, area);
    return area;
  }

  private pendente(api: string): Promise<never> {
    return Promise.reject(
      new Error(`DeereProvedor: ${api} ainda não implementada (${this.config.baseUrl}). Use DEERE_PROVEDOR=fake.`),
    );
  }
}
