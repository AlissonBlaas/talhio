import { areaHa, fechar } from './gen4';
import type { MaquinaExterna, MedicoesExternas, PosicaoExterna, TalhaoExterno } from './tipos';

/**
 * Tradução do que a John Deere devolve para os tipos do Talhio. Funções puras, sem rede.
 * A John Deere avisa que campos mudam sem aviso: aqui tudo é lido com cuidado e o que falta vira nulo.
 * As formas abaixo seguem a documentação e AINDA NÃO foram conferidas contra o sandbox
 * (ver docs/JOHN-DEERE-API.md).
 */

type Numero = number | string | null | undefined;
const num = (v: Numero): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

// --- Máquinas (Equipment) ---

export interface EquipamentoDeere {
  id?: string | number;
  /** Id da máquina nas APIs de localização, horas e operações. */
  principalId?: string | number;
  name?: string;
  isoName?: string;
  telematicsCapable?: boolean;
  type?: { name?: string } | string;
  equipmentType?: { name?: string } | string;
  model?: { name?: string } | string;
  serialNumber?: string;
  vin?: string;
  modelYear?: Numero;
}

const nomeDe = (v: { name?: string } | string | undefined): string | null => (typeof v === 'string' ? v : (v?.name ?? null));

export function categoriaDe(tipo: string | null): MaquinaExterna['categoria'] {
  const t = (tipo ?? '').toLowerCase();
  if (/sprayer|pulveriz|applicator/.test(t)) return 'sprayer';
  if (/combine|harvest|colheit/.test(t)) return 'combine';
  return 'tractor';
}

export function maquinaDe(e: EquipamentoDeere): MaquinaExterna {
  const modelo = nomeDe(e.model);
  const id = String(e.principalId ?? e.id);
  return {
    id,
    nome: e.isoName?.trim() || e.name?.trim() || modelo || `Máquina ${id}`,
    categoria: categoriaDe(nomeDe(e.type) ?? nomeDe(e.equipmentType)),
    // O implemento vem da operação em andamento (Field Operations), não do cadastro da máquina.
    implemento: null,
    // Passa a false quando a localização da máquina não responde (ver DeereProvedor.listarMaquinas).
    telemetriaAtiva: e.telematicsCapable ?? true,
    modelo,
    numeroSerie: e.serialNumber ?? e.vin ?? null,
    ano: num(e.modelYear),
  };
}

// --- Talhões (Fields + Boundaries) ---

export interface CampoDeere {
  id: string | number;
  /** Presente quando a lista é pedida com `embed=boundaries` (lista, ou objeto com `values`). */
  boundaries?: LimiteDeere[] | { values?: LimiteDeere[] };
  /** Presente quando a lista é pedida com `embed=activeBoundary`. */
  activeBoundary?: LimiteDeere;
  /** Endereços que a própria Deere indica para os dados do talhão (contornos, linhas...). */
  links?: { rel?: string; uri?: string }[];
  name?: string;
  archived?: boolean;
}

export interface LimiteDeere {
  links?: { rel?: string; uri?: string }[];
  active?: boolean;
  archived?: boolean;
  area?: { valueAsDouble?: Numero; value?: Numero; unit?: string };
  multipolygons?: { rings?: { type?: string; points?: { lat: Numero; lon: Numero }[] }[] }[];
}

const HA_POR_UNIDADE: Record<string, number> = { ha: 1, hectare: 1, hectares: 1, ac: 0.404686, acre: 0.404686, acres: 0.404686, m2: 0.0001, 'm²': 0.0001 };

/** Anel externo do maior polígono, em [lng, lat], fechado. Vazio se o limite não tem contorno. */
export function contornoDe(limite: LimiteDeere | undefined): [number, number][] {
  let melhor: [number, number][] = [];
  let maior = 0;
  for (const poligono of limite?.multipolygons ?? []) {
    const anel = (poligono.rings ?? []).find((r) => (r.type ?? 'exterior').toLowerCase() === 'exterior');
    const pontos = (anel?.points ?? []).flatMap((p) => {
      const lat = num(p.lat);
      const lng = num(p.lon);
      return lat !== null && lng !== null ? [[lng, lat] as [number, number]] : [];
    });
    if (pontos.length < 3) continue;
    const area = areaHa(pontos);
    if (area > maior) {
      maior = area;
      melhor = fechar(pontos);
    }
  }
  return melhor;
}

/** O limite ativo; na falta dele, o primeiro não arquivado. */
export function limiteAtivo(limites: LimiteDeere[]): LimiteDeere | undefined {
  return limites.find((l) => l.active && !l.archived) ?? limites.find((l) => !l.archived) ?? limites[0];
}

export function talhaoDe(campo: CampoDeere, limite: LimiteDeere | undefined): TalhaoExterno | null {
  const contorno = contornoDe(limite);
  if (contorno.length < 4) return null;
  const valor = num(limite?.area?.valueAsDouble ?? limite?.area?.value);
  const fator = HA_POR_UNIDADE[(limite?.area?.unit ?? '').toLowerCase()];
  const areaInformada = valor !== null && fator !== undefined ? valor * fator : null;
  // A área informada pode vir zerada (talhão de teste): vale a calculada pelo contorno. Com 1 casa decimal um
  // talhão minúsculo viraria 0 ha, que o app recusa; abaixo de 0,05 ha não é talhão de verdade e fica de fora.
  const area = areaInformada && areaInformada > 0 ? areaInformada : areaHa(contorno);
  if (!(area >= 0.05)) return null;
  return {
    id: String(campo.id),
    nome: campo.name?.trim() || `Talhão ${campo.id}`,
    areaHa: Math.max(0.1, Math.round(area * 10) / 10),
    cultura: null,
    contorno,
  };
}

// --- Posição (Machine Locations + Device State Reports) ---

export interface PontoDeere {
  eventTimestamp?: string;
  gpsFixTimestamp?: string;
  point?: { lat?: Numero; lon?: Numero };
  lat?: Numero;
  lon?: Numero;
  speed?: Numero | { valueAsDouble?: Numero; unit?: string };
  createTimestamp?: string;
  fuelLevel?: { valueAsDouble?: Numero; unit?: string };
  engineState?: string | number;
}

/** Velocidade em km/h, a partir do número ou da medição com unidade da Deere. */
export function velocidadeKmHDe(v: PontoDeere['speed']): number | null {
  if (v && typeof v === 'object') {
    const n = num(v.valueAsDouble);
    if (n === null) return null;
    const u = (v.unit ?? '').toLowerCase();
    if (u.startsWith('mi')) return n * 1.609344;
    if (u.startsWith('m1s') || u === 'm/s') return n * 3.6;
    return n;
  }
  return num(v);
}

/** Nível do tanque (0 a 100) do último rastro, se a máquina informar. */
export function combustivelPctDe(p: PontoDeere | undefined): number | null {
  const n = num(p?.fuelLevel?.valueAsDouble);
  return n === null ? null : Math.max(0, Math.min(100, Math.round(n)));
}

/** Relatório do modem (Device State Report). Na resposta real a hora vem em `time` e a chave em `engineState` (0 ou 1). */
export interface EstadoDoAparelhoDeere {
  time?: string;
  eventTimestamp?: string;
  engineRunning?: boolean;
  engineState?: string | number;
  ignitionOn?: boolean;
}

const instanteDoEstado = (e: EstadoDoAparelhoDeere) => Date.parse(e.time ?? e.eventTimestamp ?? '') || 0;

const instante = (p: PontoDeere) => Date.parse(p.eventTimestamp ?? p.gpsFixTimestamp ?? p.createTimestamp ?? '') || 0;

export function motorLigadoDe(estado: EstadoDoAparelhoDeere | undefined): boolean {
  if (!estado) return false;
  if (typeof estado.engineRunning === 'boolean') return estado.engineRunning;
  if (typeof estado.ignitionOn === 'boolean') return estado.ignitionOn;
  // A documentação define 1 = chave ligada, 0 = desligada.
  return /^(1|on|running|started)$/i.test(String(estado.engineState ?? ''));
}

/** O ponto mais recente. Nulo se a máquina não tem nenhuma posição. */
export function posicaoDe(maquinaId: string, historico: PontoDeere[], estados: EstadoDoAparelhoDeere[]): PosicaoExterna | null {
  const ultimo = [...historico].sort((a, b) => instante(b) - instante(a))[0];
  const lat = num(ultimo?.point?.lat ?? ultimo?.lat);
  const lng = num(ultimo?.point?.lon ?? ultimo?.lon);
  if (!ultimo || lat === null || lng === null) return null;

  const estado = [...estados].sort((a, b) => instanteDoEstado(b) - instanteDoEstado(a))[0];
  // O próprio rastro também traz a chave (`engineState`); vale o que for mais recente entre ele e o relatório do modem.
  const doRastro = ultimo.engineState === undefined ? undefined : { engineState: ultimo.engineState };
  const maisNovo = estado && instanteDoEstado(estado) >= instante(ultimo) ? estado : (doRastro ?? estado);
  const motorLigado = motorLigadoDe(maisNovo) || (velocidadeKmHDe(ultimo.speed) ?? 0) >= 0.5;
  const velocidadeKmH = velocidadeKmHDe(ultimo.speed) ?? 0;
  const registradaEm = new Date(instante(ultimo)).toISOString();
  return {
    maquinaId,
    lat,
    lng,
    registradaEm,
    velocidadeKmH,
    motorLigado,
    // Parada = sem andar. Desde quando só dá para dizer com o trajeto; usamos o último ponto conhecido.
    paradaDesde: velocidadeKmH < 0.5 ? registradaEm : null,
  };
}

// --- Medições (Machine Engine Hours) ---

export interface HorasDoMotorDeere {
  reportTime?: string;
  reading?: { valueAsDouble?: Numero; value?: Numero };
  valueAsDouble?: Numero;
  value?: Numero;
}

export function medicoesDe(horas: HorasDoMotorDeere[], rastro?: PontoDeere): MedicoesExternas {
  // A leitura mais recente pela hora do relatório (`reportTime`); sem hora, a última da lista.
  const ultimo = horas.some((h) => h.reportTime) ? [...horas].sort((a, b) => (Date.parse(b.reportTime ?? '') || 0) - (Date.parse(a.reportTime ?? '') || 0))[0] : horas.at(-1);
  return { combustivelPct: combustivelPctDe(rastro), horimetro: num(ultimo?.reading?.valueAsDouble ?? ultimo?.reading?.value ?? ultimo?.valueAsDouble ?? ultimo?.value) };
}

// --- Escrita (formatos da documentação de Boundaries e Guidance Lines; ainda não conferidos no sandbox) ---

const ponto = ([lng, lat]: [number, number]) => ({ '@type': 'Point', lat, lon: lng });

/** Corpo do POST /organizations/{org}/fields. Cliente e fazenda são criados pelo nome se ainda não existirem. */
export function campoParaEnviar(nome: string, cliente: string, arquivado = false) {
  return { name: nome, archived: arquivado, farms: { farms: [{ name: cliente }] }, clients: { clients: [{ name: cliente }] } };
}

/** Corpo do POST .../fields/{id}/boundaries. O anel é fechado (primeiro ponto = último). `active` torna este o contorno do talhão. */
export function contornoParaEnviar(nome: string, anel: [number, number][]) {
  return {
    '@type': 'Boundary',
    name: nome,
    sourceType: 'External',
    multipolygons: [{ '@type': 'Polygon', rings: [{ '@type': 'Ring', points: fechar(anel).map(ponto), type: 'exterior', passable: true }] }],
    active: true,
    archived: false,
    irrigated: false,
  };
}

/** Corpo do POST .../fields/{id}/guidanceLines: linha AB com ponto A e ponto B, sem deslocamento. */
export function linhaParaEnviar(nome: string, a: [number, number], b: [number, number]) {
  const zero = (dominio: string) => ({ '@type': 'MeasurementAsDouble', valueAsDouble: 0, vrDomainId: dominio, unit: 'cm' });
  return {
    '@type': 'ABLine',
    name: nome,
    aPoint: ponto(a),
    bPoint: ponto(b),
    eastShift: zero('vrEastShiftComponent'),
    northShift: zero('vrNorthShiftComponent'),
    tramOffset: 0,
    tramSpacing: 1,
    archived: false,
  };
}

// --- Operações de campo (Field Operations) ---

export interface OperacaoDeere {
  id: string;
  fieldOperationType?: string;
  startDate?: string;
  endDate?: string;
  modifiedTime?: string;
  fieldOperationMachines?: { machineId?: Numero; vin?: string; operators?: { name?: string }[] }[];
}

export interface MedicaoDeOperacaoDeere {
  measurementName?: string;
  measurementCategory?: string;
  area?: { value?: Numero; unitId?: string };
}

export type TipoDeOperacao = 'plantio' | 'pulverizacao' | 'adubacao' | 'colheita';

/** Seeding -> plantio, application -> pulverização, harvest -> colheita. Preparo de solo e o resto não entram. */
export function operacaoDe(tipo: string | undefined): TipoDeOperacao | null {
  const t = (tipo ?? '').toLowerCase();
  if (t.includes('seed') || t.includes('plant')) return 'plantio';
  if (t.includes('harvest')) return 'colheita';
  if (t.includes('applic')) return 'pulverizacao';
  return null;
}

/** Nome da medição a consultar: a que mostra o que a máquina realmente fez ("Result"); senão a primeira. */
export function medicaoEscolhida(lista: unknown[]): string | null {
  const nomes = lista
    .map((m) => (typeof m === 'string' ? m : ((m as { measurementName?: string } | null)?.measurementName ?? null)))
    .filter((n): n is string => !!n);
  return nomes.find((n) => /result$/i.test(n)) ?? nomes[0] ?? null;
}

/** Hectares da medição (converte acres). Nulo se não vier. */
export function areaDaMedicao(m: MedicaoDeOperacaoDeere | null | undefined): number | null {
  const v = num(m?.area?.value);
  if (v === null) return null;
  return (m?.area?.unitId ?? 'ha').toLowerCase().startsWith('ac') ? v * 0.404686 : v;
}

const HORA = 3_600_000;
const DIA = 24 * HORA;
/** Início do dia (AAAA-MM-DD) na fazenda. O fuso do Brasil central (-03:00) é o padrão. */
export const inicioDoDia = (dia: string, fuso = '-03:00') => new Date(`${dia}T00:00:00${fuso}`).getTime();

/**
 * Parte de uma operação que cai num dia. A API só informa o total da operação, então, quando ela atravessa
 * vários dias, a área e as horas são repartidas pelo tempo (estimativa). Devolve fração 0..1 e horas.
 */
export function fatiaDoDia(op: Pick<OperacaoDeere, 'startDate' | 'endDate'>, dia: string, fuso?: string): { fracao: number; horas: number } {
  const ini = op.startDate ? Date.parse(op.startDate) : NaN;
  const fim = op.endDate ? Date.parse(op.endDate) : NaN;
  if (!Number.isFinite(ini) || !Number.isFinite(fim)) return { fracao: 0, horas: 0 };
  const d0 = inicioDoDia(dia, fuso);
  const dentro = Math.max(0, Math.min(fim, d0 + DIA) - Math.max(ini, d0));
  const total = fim - ini;
  if (total <= 0) return { fracao: ini >= d0 && ini < d0 + DIA ? 1 : 0, horas: 0 };
  return { fracao: dentro / total, horas: dentro / HORA };
}

export const operadorDaOperacao = (op: OperacaoDeere, maquinaId: string): string | null =>
  op.fieldOperationMachines?.find((m) => String(m.machineId) === maquinaId)?.operators?.find((o) => o.name)?.name ?? null;

// --- Linhas de guia ---

export interface LinhaDeere {
  '@type'?: string;
  id?: string;
  name?: string;
  archived?: boolean;
  aPoint?: { lat?: Numero; lon?: Numero };
  bPoint?: { lat?: Numero; lon?: Numero };
  /** Só vem com `embed=shapes`, nas curvas (ABCurve e AdaptiveCurve): cada item é um trecho contínuo da linha. */
  shapes?: { points?: { lat?: Numero; lon?: Numero }[] }[];
}

/**
 * Linha de guia do talhão. Reta (ABLine): pontos A e B. Curva (ABCurve e AdaptiveCurve): o traçado vem em `shapes`
 * e vira `passadas` (os trechos da linha de referência, não as passadas paralelas). Pivô (CircleTrack) e linha
 * arquivada ficam de fora.
 */
export function linhaDe(l: LinhaDeere, talhaoId: string): import('./tipos').LinhaExterna | null {
  if (l.archived || !l.id) return null;
  const ponto = (p?: { lat?: Numero; lon?: Numero }): [number, number] | null => {
    const [x, y] = [num(p?.lon), num(p?.lat)];
    return x === null || y === null ? null : [x, y];
  };
  if (l['@type'] === 'ABLine') {
    const [a, b] = [ponto(l.aPoint), ponto(l.bPoint)];
    return a && b ? { id: String(l.id), nome: l.name?.trim() || 'Linha AB', talhaoId, a, b, padrao: false } : null;
  }
  if (l['@type'] === 'ABCurve' || l['@type'] === 'AdaptiveCurve') {
    const passadas = (l.shapes ?? []).map((s) => (s.points ?? []).map(ponto).filter((p): p is [number, number] => p !== null)).filter((t) => t.length >= 2);
    const primeira = passadas[0];
    const ultima = passadas.at(-1);
    if (!primeira || !ultima) return null;
    return { id: String(l.id), nome: l.name?.trim() || 'Linha curva', talhaoId, a: ponto(l.aPoint) ?? primeira[0]!, b: ponto(l.bPoint) ?? ultima.at(-1)!, padrao: false, passadas };
  }
  return null;
}
