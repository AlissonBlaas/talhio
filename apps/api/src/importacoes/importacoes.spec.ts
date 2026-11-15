import { Test } from '@nestjs/testing';
import { FakeProvedor } from '@talhio/deere';
import { ResultadoImportacaoSchema } from '@talhio/shared';
import { strToU8, zipSync } from 'fflate';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { BANCO } from '../banco/banco.module.js';
import type { Banco } from '../banco/banco.js';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import { ImportacoesRepository } from './importacoes.repository.js';
import { ImportacoesService } from './importacoes.service.js';

const XML = `<?xml version="1.0"?><SetupFile><Setup><Client StringGuid="c1" Name="FAZENDA TESTE" />
  <Field StringGuid="f1" Name="TALHAO UM"><Farm>x</Farm></Field>
  <Guidance><Tracks><AdaptiveCurve StringGuid="g1" Name="CURVA" TaggedEntity="f1"><Geometry><FilenameWithExtension>curva.gjson</FilenameWithExtension><Path>./SpatialFiles/</Path></Geometry></AdaptiveCurve></Tracks></Guidance>
  <OperationalBoundary StringGuid="b1" TaggedEntity="f1" Name="LIMITE"><Geometry><FilenameWithExtension>limite.gjson</FilenameWithExtension><Path>./SpatialFiles/</Path></Geometry></OperationalBoundary>
</Setup></SetupFile>`;
const LIMITE = JSON.stringify({ features: [{ geometry: { type: 'Polygon', coordinates: [[[-52, -33], [-51.9893, -33], [-51.9893, -32.991], [-52, -32.991]]] } }] });
const CURVA = JSON.stringify({ geometry: { type: 'MultiLineString', coordinates: [0, 1, 2].map((i) => [[-51.999 + i * 0.002, -32.999, 0, 1], [-51.999 + i * 0.002, -32.992, 0, 1]]) } });

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
const zip = (arquivos: Record<string, string>) => b64(zipSync(Object.fromEntries(Object.entries(arquivos).map(([nome, texto]) => [nome, strToU8(texto)]))));

describe('ImportacoesService', () => {
  let service: ImportacoesService;
  let provedor: FakeProvedor;

  let banco: Banco;

  /** Uma "subida" da API: provedor novo, mesmo banco. */
  const subir = async () => {
    provedor = new FakeProvedor();
    const modulo = await Test.createTestingModule({
      providers: [ImportacoesService, ImportacoesRepository, { provide: PROVEDOR_MAQUINAS, useValue: provedor }, { provide: BANCO, useValue: banco }],
    }).compile();
    await modulo.init();
    service = modulo.get(ImportacoesService);
  };

  beforeAll(async () => {
    banco = await criarBancoDeTeste();
  });
  beforeEach(subir);

  it('a fazenda importada fica no banco e volta sozinha quando a API sobe de novo', async () => {
    const conteudo = zip({ 'MasterData.xml': XML, 'limite.gjson': LIMITE, 'curva.gjson': CURVA });
    await service.importarGen4('org-demo', { arquivos: [{ nome: 'Gen4.zip', conteudoBase64: conteudo }] });
    await subir();
    expect((await provedor.listarTalhoes()).map((t) => t.id)).toEqual(['f1']);
    expect(await provedor.listarLinhas()).toHaveLength(1);
    expect((await provedor.resumoDaFazenda()).nome).toBe('FAZENDA TESTE');
  });

  it('importa um zip com a pasta de fora e passa a servir os talhões e linhas dele', async () => {
    const conteudo = zip({ 'Gen4/MasterData.xml': XML, 'Gen4/SpatialFiles/limite.gjson': LIMITE, 'Gen4/SpatialFiles/curva.gjson': CURVA, '__MACOSX/Gen4/._MasterData.xml': 'lixo' });
    const resultado = await service.importarGen4('org-demo', { arquivos: [{ nome: 'Gen4.zip', conteudoBase64: conteudo }] });

    expect(() => ResultadoImportacaoSchema.parse(resultado)).not.toThrow();
    expect(resultado).toMatchObject({ fazendaNome: 'FAZENDA TESTE', totalLinhas: 1, totalPassadas: 3 });
    expect(resultado.talhoes).toEqual([expect.objectContaining({ id: 'f1', nome: 'TALHAO UM', passadas: 3 })]);
    expect((await provedor.listarTalhoes()).map((t) => t.id)).toEqual(['f1']);
    expect(await provedor.listarLinhas()).toHaveLength(1);
  });

  it('aceita os arquivos soltos, sem zip', async () => {
    const solto = (nome: string, texto: string) => ({ nome, conteudoBase64: Buffer.from(texto).toString('base64') });
    const resultado = await service.importarGen4('org-demo', { arquivos: [solto('MasterData.xml', XML), solto('limite.gjson', LIMITE), solto('curva.gjson', CURVA)] });
    expect(resultado.talhoes).toHaveLength(1);
  });

  it('explica quando o arquivo é do GS3', async () => {
    const conteudo = zip({ 'GS3_2630/AgroCAD/RCD/EIC/setup.fds': 'x', 'GS3_2630/AgroCAD/RCD/EIC/Fields/a/Boundary.fdShape': 'x' });
    await expect(service.importarGen4('org-demo', { arquivos: [{ nome: 'GS3.zip', conteudoBase64: conteudo }] })).rejects.toMatchObject({ response: { codigo: 'FORMATO_GS3' } });
  });

  it('recusa zip sem MasterData, zip quebrado e talhão sem contorno, sem mexer na fazenda atual', async () => {
    const antes = await provedor.listarTalhoes();
    const tentar = (nome: string, conteudoBase64: string) => service.importarGen4('org-demo', { arquivos: [{ nome, conteudoBase64 }] });
    await expect(tentar('outro.zip', zip({ 'leia-me.json': '{}' }))).rejects.toMatchObject({ response: { codigo: 'ARQUIVO_NAO_RECONHECIDO' } });
    await expect(tentar('quebrado.zip', Buffer.from('isto não é zip').toString('base64'))).rejects.toMatchObject({ response: { codigo: 'ZIP_INVALIDO' } });
    await expect(tentar('so-xml.zip', zip({ 'MasterData.xml': XML }))).rejects.toMatchObject({ response: { codigo: 'SEM_TALHOES' } });
    expect(await provedor.listarTalhoes()).toEqual(antes);
  });
});
