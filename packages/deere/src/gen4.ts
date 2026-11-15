import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LinhaExterna, TalhaoExterno } from './tipos';

/**
 * Leitor da pasta de configuração do monitor John Deere Geração 4 (a mesma que vai no pen drive):
 * `MasterData.xml` com clientes, fazendas, talhões e a lista de arquivos, e `SpatialFiles/*.gjson`
 * com os contornos e as linhas de guia.
 */
export interface FazendaImportada {
  /** Nome do cliente no arquivo (a fazenda como um todo). */
  cliente: string;
  talhoes: TalhaoExterno[];
  linhas: LinhaExterna[];
}

type Atributos = Record<string, string>;

/** Atributos de uma tag de abertura: `Name="X" StringGuid="Y"`. */
function atributos(tag: string): Atributos {
  const saida: Atributos = {};
  for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) saida[m[1]!] = decodificar(m[2]!);
  return saida;
}

function decodificar(texto: string): string {
  return texto.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

/** Elementos `<Nome ...>...</Nome>` (ou `<Nome ... />`) com atributos e conteúdo. */
function elementos(xml: string, nome: string): { attrs: Atributos; corpo: string }[] {
  const saida: { attrs: Atributos; corpo: string }[] = [];
  const re = new RegExp(`<${nome}(\\s[^>]*?)?(/>|>([\\s\\S]*?)</${nome}>)`, 'g');
  for (const m of xml.matchAll(re)) saida.push({ attrs: atributos(m[1] ?? ''), corpo: m[3] ?? '' });
  return saida;
}

const texto = (xml: string, nome: string) => elementos(xml, nome)[0]?.corpo.trim() ?? null;

/** Área em hectares de um anel [lng, lat][], num plano local (bom para a escala de um talhão). */
export function areaHa(anel: [number, number][]): number {
  const origem = anel[0];
  if (!origem) return 0;
  const mLat = 111_320;
  const mLng = mLat * Math.cos((origem[1] * Math.PI) / 180);
  let soma = 0;
  for (let i = 0; i < anel.length; i++) {
    const [x1, y1] = anel[i]!;
    const [x2, y2] = anel[(i + 1) % anel.length]!;
    soma += (x1 - origem[0]) * mLng * ((y2 - origem[1]) * mLat) - (x2 - origem[0]) * mLng * ((y1 - origem[1]) * mLat);
  }
  return Math.abs(soma) / 2 / 10_000;
}

export function fechar(anel: [number, number][]): [number, number][] {
  const a = anel[0];
  const z = anel[anel.length - 1];
  return a && z && (a[0] !== z[0] || a[1] !== z[1]) ? [...anel, a] : anel;
}

const par = (p: number[]): [number, number] => [p[0]!, p[1]!];

const base = (caminho: string) => caminho.split(/[\\/]/).pop()!.toLowerCase();

/** Lê a pasta do disco (MasterData.xml + SpatialFiles). */
export function lerPastaGen4(pasta: string): FazendaImportada {
  const caminhoXml = join(pasta, 'MasterData.xml');
  if (!existsSync(caminhoXml)) throw new Error(`Pasta Gen4 inválida: não achei ${caminhoXml}`);
  const arquivos = new Map<string, string>([['MasterData.xml', readFileSync(caminhoXml, 'utf8')]]);
  const espaciais = join(pasta, 'SpatialFiles');
  if (existsSync(espaciais)) for (const nome of readdirSync(espaciais)) arquivos.set(nome, readFileSync(join(espaciais, nome), 'utf8'));
  return lerArquivosGen4(arquivos);
}

/**
 * Lê os arquivos já em memória (nome -> conteúdo em texto). Só o nome do arquivo importa, não a
 * pasta: serve para um zip enviado pelo app, venha ele com ou sem a pasta de fora.
 */
export function lerArquivosGen4(arquivos: Map<string, string>): FazendaImportada {
  const porNome = new Map([...arquivos].map(([nome, conteudo]) => [base(nome), conteudo]));
  const xml = porNome.get('masterdata.xml');
  if (!xml) throw new Error('Pasta Gen4 inválida: falta o MasterData.xml');
  const geo = (elemento: string) => {
    const arquivo = texto(elemento, 'FilenameWithExtension');
    const conteudo = arquivo ? porNome.get(base(arquivo)) : undefined;
    if (!conteudo) return null;
    try {
      return JSON.parse(conteudo) as Record<string, any>;
    } catch {
      return null;
    }
  };

  const campos = elementos(xml, 'Field').map((f) => ({ id: f.attrs.StringGuid ?? '', nome: f.attrs.Name ?? 'Talhão' }));

  const talhoes: TalhaoExterno[] = [];
  for (const limite of elementos(xml, 'OperationalBoundary')) {
    const campo = campos.find((c) => c.id === limite.attrs.TaggedEntity);
    const anel = geo(limite.corpo)?.features?.[0]?.geometry?.coordinates?.[0] as number[][] | undefined;
    if (!campo || !anel || anel.length < 3) continue;
    const contorno = fechar(anel.map(par));
    talhoes.push({ id: campo.id, nome: campo.nome, cultura: null, areaHa: Math.round(areaHa(contorno) * 10) / 10, contorno });
  }

  const linhas: LinhaExterna[] = [];
  for (const curva of elementos(xml, 'AdaptiveCurve')) {
    const passadas = ((geo(curva.corpo)?.geometry?.coordinates ?? []) as number[][][]).map((linha) => linha.map(par)).filter((linha) => linha.length >= 2);
    const primeira = passadas[0];
    if (!curva.attrs.StringGuid || !primeira) continue;
    linhas.push({
      id: curva.attrs.StringGuid,
      nome: curva.attrs.Name ?? 'Curva',
      talhaoId: curva.attrs.TaggedEntity ?? null,
      a: primeira[0]!,
      b: primeira[primeira.length - 1]!,
      padrao: false,
      passadas,
    });
  }

  return { cliente: elementos(xml, 'Client')[0]?.attrs.Name ?? 'Fazenda', talhoes, linhas };
}
