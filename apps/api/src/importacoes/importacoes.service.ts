import { BadRequestException, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { lerArquivosGen4, lerKml, type FazendaImportada, type ProvedorMaquinas } from '@talhio/deere';
import type { Importacao, ResultadoImportacao } from '@talhio/shared';
import { strFromU8, unzipSync } from 'fflate';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { ImportacoesRepository } from './importacoes.repository.js';

const nomeBase = (caminho: string) => caminho.split(/[\\/]/).pop() ?? caminho;
const ehTexto = (nome: string) => /\.(xml|gjson|json|geojson|kml)$/i.test(nome);
const ehKml = (nome: string) => /\.kml$/i.test(nome);
/** Arquivos que só existem na exportação para o monitor GS3 2630 (formato binário). */
const ehGs3 = (nome: string) => /\.(fdshape|fddata|fds|spatialcatalog)$/i.test(nome);

/** Maior arquivo aceito dentro do zip, já descompactado. Os reais têm menos de 1 MB. */
const MAX_BYTES_POR_ARQUIVO = 20 * 1024 * 1024;

const invalido = (codigo: string, mensagem: string) => new BadRequestException({ codigo, mensagem });

@Injectable()
export class ImportacoesService implements OnModuleInit {
  constructor(
    @Inject(PROVEDOR_MAQUINAS) private readonly provedor: ProvedorMaquinas,
    @Inject(ImportacoesRepository) private readonly importadas: ImportacoesRepository,
  ) {}

  /** Ao subir, devolve ao provedor as fazendas importadas antes (elas ficam no banco). */
  async onModuleInit(): Promise<void> {
    for (const { orgId, dados } of await this.importadas.todas()) {
      await this.provedor.importarFazenda(orgId, dados, { aoSubir: true });
    }
  }

  /** Importa talhões e linhas da exportação para o monitor John Deere Geração 4. */
  async importarGen4(orgId: string, dados: Importacao): Promise<ResultadoImportacao> {
    const arquivos = this.abrir(dados);
    const nomes = [...arquivos.keys()];

    // KML/KMZ (Google Earth e outros programas de mapa): só talhões, somados ao que a fazenda já tem.
    if (!nomes.some((n) => n.toLowerCase() === 'masterdata.xml') && nomes.some(ehKml)) return this.importarKml(orgId, nomes.filter(ehKml).map((n) => arquivos.get(n)!));

    if (!nomes.some((n) => n.toLowerCase() === 'masterdata.xml')) {
      if (nomes.some(ehGs3) || dados.arquivos.some((a) => ehGs3(a.nome))) {
        throw invalido('FORMATO_GS3', 'Este arquivo é do monitor GS3 2630, que ainda não conseguimos ler. Envie a exportação feita para o monitor Geração 4.');
      }
      throw invalido('ARQUIVO_NAO_RECONHECIDO', 'Não reconheci o arquivo. Envie um .kml ou .kmz com os talhões, ou o .zip da pasta exportada para o monitor Geração 4.');
    }

    let fazenda: FazendaImportada;
    try {
      fazenda = lerArquivosGen4(arquivos);
    } catch {
      throw invalido('ARQUIVO_NAO_RECONHECIDO', 'Não consegui ler o MasterData.xml. Confira se o arquivo não está corrompido.');
    }
    if (fazenda.talhoes.length === 0) {
      throw invalido('SEM_TALHOES', 'O arquivo não tem nenhum talhão com contorno. Confira se os arquivos .gjson da pasta SpatialFiles foram enviados junto.');
    }

    await this.provedor.importarFazenda(orgId, fazenda);
    await this.importadas.salvar(orgId, fazenda);

    const passadasDo = (talhaoId: string) => fazenda.linhas.filter((l) => l.talhaoId === talhaoId).reduce((s, l) => s + (l.passadas?.length ?? 0), 0);
    return {
      fazendaNome: fazenda.cliente,
      talhoes: fazenda.talhoes.map((t) => ({ id: t.id, nome: t.nome, areaHa: t.areaHa, passadas: passadasDo(t.id) })),
      totalLinhas: fazenda.linhas.length,
      totalPassadas: fazenda.linhas.reduce((s, l) => s + (l.passadas?.length ?? 0), 0),
    };
  }

  /**
   * Talhões de um KML. Diferente da pasta do monitor, NÃO substitui o que já foi importado: entra junto. Talhão com o
   * mesmo nome de um já importado troca só o contorno e mantém o id, para as linhas e os planos dele continuarem valendo.
   */
  private async importarKml(orgId: string, textos: string[]): Promise<ResultadoImportacao> {
    let lida: FazendaImportada;
    try {
      lida = lerKml(textos);
    } catch {
      throw invalido('ARQUIVO_NAO_RECONHECIDO', 'Não consegui ler o KML. Confira se o arquivo não está corrompido.');
    }
    if (lida.talhoes.length === 0) {
      throw invalido('SEM_TALHOES', 'O KML não tem nenhum polígono. Os talhões precisam estar desenhados como polígono (área fechada), não como linha ou marcador.');
    }
    const atual = await this.importadas.buscar(orgId);
    const chave = (nome: string) => nome.trim().toLowerCase();
    const novos = new Map(lida.talhoes.map((t) => [chave(t.nome), t]));
    const jaExistiam = new Set<string>();
    const talhoes = (atual?.talhoes ?? []).map((t) => {
      const novo = novos.get(chave(t.nome));
      if (!novo) return t;
      jaExistiam.add(chave(t.nome));
      return { ...novo, id: t.id, cultura: t.cultura };
    });
    for (const [nome, t] of novos) if (!jaExistiam.has(nome)) talhoes.push(t);
    const fazenda: FazendaImportada = { cliente: atual?.cliente ?? lida.cliente, talhoes, linhas: atual?.linhas ?? [] };

    await this.provedor.importarFazenda(orgId, fazenda);
    await this.importadas.salvar(orgId, fazenda);

    const entraram = talhoes.filter((t) => novos.has(chave(t.nome)));
    return { fazendaNome: fazenda.cliente, talhoes: entraram.map((t) => ({ id: t.id, nome: t.nome, areaHa: t.areaHa, passadas: 0 })), totalLinhas: 0, totalPassadas: 0 };
  }

  /** Junta os arquivos enviados (abrindo os .zip) num mapa nome -> texto. Só o nome do arquivo conta. */
  private abrir(dados: Importacao): Map<string, string> {
    const arquivos = new Map<string, string>();
    for (const arquivo of dados.arquivos) {
      const bytes = new Uint8Array(Buffer.from(arquivo.conteudoBase64, 'base64'));
      // O .kmz é um zip com um .kml dentro.
      if (/\.(zip|kmz)$/i.test(arquivo.nome)) {
        let conteudo: Record<string, Uint8Array>;
        try {
          // Só abre o que interessa: evita gastar memória com arquivo que não vamos ler.
          // E nada gigante: um zip pequeno pode esconder um arquivo enorme ("bomba de zip").
          conteudo = unzipSync(bytes, { filter: (f) => (ehTexto(f.name) || ehGs3(f.name)) && f.originalSize <= MAX_BYTES_POR_ARQUIVO });
        } catch {
          throw invalido('ZIP_INVALIDO', `Não consegui abrir "${arquivo.nome}". Confira se é um arquivo .zip ou .kmz válido.`);
        }
        for (const [caminho, bytesDoArquivo] of Object.entries(conteudo)) {
          // Ignora os arquivos ocultos que o macOS põe dentro do zip.
          if (caminho.includes('__MACOSX') || nomeBase(caminho).startsWith('._')) continue;
          arquivos.set(nomeBase(caminho), ehTexto(caminho) ? strFromU8(bytesDoArquivo) : '');
        }
      } else if (ehTexto(arquivo.nome)) {
        arquivos.set(nomeBase(arquivo.nome), Buffer.from(bytes).toString('utf8'));
      }
    }
    return arquivos;
  }
}
