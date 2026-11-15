import { unzipSync } from 'fflate';

/**
 * Leitura do export ponto a ponto da John Deere (Operations Data Export, SHAPEFILE/Point/OneHertz).
 * O zip traz .shp/.shx/.dbf/.prj e um .json com as unidades e as máquinas. Só o .dbf interessa:
 * cada linha é um ponto com horário, distância, largura e, às vezes, combustível e velocidade.
 * Colunas conferidas com a documentação (nomes em maiúsculas, ISOTIME, MACHINE como índice do mapa `MachineUsage` do .json);
 * AINDA NÃO conferidas com um export real. A ordem e a presença das colunas não são garantidas pela Deere.
 */

export interface DiaDeMaquina {
  maquinaId: string;
  /** AAAA-MM-DD no fuso da fazenda. */
  dia: string;
  horas: number;
  /** Área bruta calculada ponto a ponto (distância x largura); o provedor ajusta ao total oficial da operação. */
  areaHa: number;
  combustivelL: number;
  paradoMin: number;
}

type Linha = Record<string, string>;

/** Lê um .dbf (dBase IV) inteiro em linhas de texto. */
export function lerDbf(bytes: Uint8Array): Linha[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const registros = v.getUint32(4, true);
  const inicio = v.getUint16(8, true);
  const tamanho = v.getUint16(10, true);
  const campos: { nome: string; tam: number }[] = [];
  for (let p = 32; p < inicio && bytes[p] !== 0x0d; p += 32) {
    const nome = new TextDecoder('latin1').decode(bytes.subarray(p, p + 11)).replace(/\0.*$/, '').trim().toUpperCase();
    campos.push({ nome, tam: bytes[p + 16]! });
  }
  const texto = new TextDecoder('latin1');
  const saida: Linha[] = [];
  for (let r = 0; r < registros; r++) {
    let p = inicio + r * tamanho;
    if (p + tamanho > bytes.length) break;
    if (bytes[p] === 0x2a) continue; // apagado
    p += 1;
    const linha: Linha = {};
    for (const c of campos) {
      linha[c.nome] = texto.decode(bytes.subarray(p, p + c.tam)).trim();
      p += c.tam;
    }
    saida.push(linha);
  }
  return saida;
}

const FUSO_MS = -3 * 3_600_000;
const diaDe = (ms: number) => new Date(ms + FUSO_MS).toISOString().slice(0, 10);

/**
 * Resumo de um export para o log, para conferir com um arquivo REAL o que cada coluna quer dizer (hoje as colunas só foram
 * conferidas com a documentação). Traz os nomes das colunas, as unidades citadas no .json e, para as colunas de combustível,
 * motor e carga, o mínimo, o máximo, a soma e se o valor só cresce (sinal de acumulado). Sem coordenadas nem ids.
 */
export function resumoDoExport(zip: Uint8Array): string {
  try {
    const arquivos = unzipSync(zip);
    const nome = (fim: string) => Object.keys(arquivos).find((n) => n.toLowerCase().endsWith(fim));
    const dbf = nome('.dbf');
    if (!dbf) return 'export sem .dbf';
    const linhas = lerDbf(arquivos[dbf]!);
    const colunas = Object.keys(linhas[0] ?? {});
    const jsonNome = nome('.json');
    const unidades = jsonNome ? [...new Set(new TextDecoder().decode(arquivos[jsonNome]).match(/"[^"]*"\s*:\s*"[^"]*(?:gal|lit|feet|foot|ft|meter|metre|hour|kph|mph|km)[^"]*"/gi) ?? [])].slice(0, 12) : [];
    const estatisticas = colunas
      .filter((c) => /FUEL|ENG|RPM|LOAD|SPEED|DISTANCE|SWATH/i.test(c))
      .map((c) => {
        const v = linhas.map((l) => numero(l[c])).filter((n): n is number => n !== null);
        if (v.length === 0) return `${c}: sem valores`;
        const sobe = v.every((n, i) => i === 0 || n >= v[i - 1]!);
        return `${c}: ${v.length} valores, min ${Math.min(...v)}, max ${Math.max(...v)}, soma ${Math.round(v.reduce((a, b) => a + b, 0) * 100) / 100}, só cresce: ${sobe ? 'sim' : 'não'}, primeiros ${v.slice(0, 4).join('/')}`;
      });
    return `${linhas.length} pontos | colunas: ${colunas.join(',')} | unidades no json: ${unidades.join(' ; ') || 'nenhuma citada'} | ${estatisticas.join(' | ')}`;
  } catch (e) {
    return `não consegui ler o export (${e instanceof Error ? e.message : 'erro'})`;
  }
}

/** Intervalo máximo entre dois pontos para contar como trabalho contínuo. */
const LACUNA_S = 60;
/** Abaixo disso o equipamento está parado (km/h). */
const PARADO_KMH = 0.5;

const numero = (t: string | undefined): number | null => {
  if (t === undefined || t === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Índice da coluna MACHINE -> id da máquina, lido do .json do export (formato tolerante). */
export function maquinasDoMeta(meta: unknown): Map<string, string> {
  const mapa = new Map<string, string>();
  const visitar = (no: unknown): void => {
    if (Array.isArray(no)) return no.forEach(visitar);
    if (!no || typeof no !== 'object') return;
    const o = no as Record<string, unknown>;
    const indice = o.index ?? o.machineIndex ?? o.machineIdx;
    const id = o.machineId ?? o.machineID ?? o.erid ?? o.id;
    if ((typeof indice === 'number' || typeof indice === 'string') && (typeof id === 'string' || typeof id === 'number')) mapa.set(String(indice), String(id));
    for (const [chave, valor] of Object.entries(o)) {
      // Formato atual: `MachineUsage` é um mapa cuja chave é o índice ("1", "2"...) e o valor traz o id da máquina.
      if (/machine/i.test(chave) && valor && typeof valor === 'object' && !Array.isArray(valor)) {
        for (const [i, uso] of Object.entries(valor as Record<string, unknown>)) {
          if (!/^\d+$/.test(i) || !uso || typeof uso !== 'object') continue;
          const campos = Object.entries(uso as Record<string, unknown>);
          const achado = ['machineid', 'principalid', 'id', 'erid'].map((n) => campos.find(([k]) => k.toLowerCase() === n)?.[1]).find((v) => typeof v === 'string' || typeof v === 'number');
          if (achado !== undefined) mapa.set(i, String(achado));
        }
      }
      visitar(valor);
    }
  };
  visitar(meta);
  return mapa;
}

/**
 * Totais por máquina e dia. `maquinaPadrao` vale quando o .json não diz de qual máquina é cada índice
 * (operação de uma máquina só).
 */
export function lerExportacao(zip: Uint8Array, maquinaPadrao: string | null): DiaDeMaquina[] {
  const arquivos = unzipSync(zip);
  const nome = (fim: string) => Object.keys(arquivos).find((n) => n.toLowerCase().endsWith(fim));
  const dbf = nome('.dbf');
  if (!dbf) return [];
  const jsonNome = nome('.json');
  let meta: unknown = null;
  let metaTexto = '';
  if (jsonNome) {
    metaTexto = new TextDecoder().decode(arquivos[jsonNome]);
    try {
      meta = JSON.parse(metaTexto);
    } catch {
      meta = null;
    }
  }
  const maquinas = maquinasDoMeta(meta);
  // Unidades americanas: o .json cita pés/galões. Convertemos para metros e litros.
  const pes = /\b(feet|foot|ft)\b/i.test(metaTexto);
  const galoes = /\b(gallon|gallons|gal)\b/i.test(metaTexto);

  const pontos = lerDbf(arquivos[dbf]!)
    .map((l) => ({ t: Date.parse(l.ISOTIME ?? ''), l }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);

  const saida = new Map<string, DiaDeMaquina>();
  const anterior = new Map<string, number>();
  for (const { t, l } of pontos) {
    // A coluna MACHINE pode não existir (operação sem dado de máquina) e 0 quer dizer "sem informação neste ponto".
    const indice = l.MACHINE === undefined || l.MACHINE === '0' ? '' : l.MACHINE;
    const maquinaId = maquinas.get(indice) ?? maquinaPadrao ?? (indice !== '' ? `indice-${indice}` : null);
    if (!maquinaId) continue;
    const dia = diaDe(t);
    const chave = `${maquinaId}|${dia}`;
    const d = saida.get(chave) ?? { maquinaId, dia, horas: 0, areaHa: 0, combustivelL: 0, paradoMin: 0 };
    saida.set(chave, d);

    const dist = (numero(l.DISTANCE) ?? 0) * (pes ? 0.3048 : 1);
    const largura = (numero(l.SWATHWIDTH) ?? 0) * (pes ? 0.3048 : 1);
    d.areaHa += (dist * largura) / 10_000;
    d.combustivelL += (numero(l.FUEL) ?? 0) * (galoes ? 3.78541 : 1);

    const antes = anterior.get(maquinaId);
    anterior.set(maquinaId, t);
    if (antes === undefined) continue;
    const s = (t - antes) / 1000;
    if (s <= 0 || s > LACUNA_S) continue;
    d.horas += s / 3600;
    const velocidade = numero(l.VEHICLSPEED);
    const parado = velocidade !== null ? velocidade < PARADO_KMH : dist === 0;
    if (parado) d.paradoMin += s / 60;
  }
  return [...saida.values()].map((d) => ({
    ...d,
    horas: Math.round(d.horas * 10_000) / 10_000,
    areaHa: Math.round(d.areaHa * 10_000) / 10_000,
    combustivelL: Math.round(d.combustivelL * 10) / 10,
    paradoMin: Math.round(d.paradoMin * 10) / 10,
  }));
}
