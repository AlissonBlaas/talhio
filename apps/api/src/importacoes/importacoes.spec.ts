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

  describe('KML', () => {
    const KML = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Soja 26/27</name>
      <Placemark><name>SOJA FUTURA 1</name><Polygon><outerBoundaryIs><LinearRing><coordinates>
        -52.10,-33.10,0 -52.09,-33.10,0 -52.09,-33.09,0 -52.10,-33.09,0 -52.10,-33.10,0
      </coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
      <Placemark><name><![CDATA[Sede]]></name><Point><coordinates>-52.1,-33.1,0</coordinates></Point></Placemark>
    </Document></kml>`;

    it('soma os talhões do KML aos já importados, sem apagar talhões nem linhas', async () => {
      await subir();
      await service.importarGen4('org-demo', { arquivos: [{ nome: 'gen4.zip', conteudoBase64: zip({ 'MasterData.xml': XML, 'SpatialFiles/limite.gjson': LIMITE, 'SpatialFiles/curva.gjson': CURVA }) }] });
      const r = await service.importarGen4('org-demo', { arquivos: [{ nome: 'soja.kml', conteudoBase64: b64(strToU8(KML)) }] });
      expect(ResultadoImportacaoSchema.parse(r).talhoes.map((t) => t.nome)).toEqual(['SOJA FUTURA 1']);
      expect(r.talhoes[0]!.areaHa).toBeGreaterThan(90);
      const guardada = await new ImportacoesRepository(banco).buscar('org-demo');
      expect(guardada?.talhoes.map((t) => t.nome)).toEqual(['TALHAO UM', 'SOJA FUTURA 1']);
      expect(guardada?.linhas).toHaveLength(1);
      expect(guardada?.cliente).toBe('FAZENDA TESTE');
    });

    it('KMZ, e talhão de mesmo nome troca o contorno mantendo o id', async () => {
      await subir();
      await service.importarGen4('org-demo', { arquivos: [{ nome: 'gen4.zip', conteudoBase64: zip({ 'MasterData.xml': XML, 'limite.gjson': LIMITE, 'curva.gjson': CURVA }) }] });
      const antes = await service.importarGen4('org-demo', { arquivos: [{ nome: 'a.kmz', conteudoBase64: zip({ 'doc.kml': KML }) }] });
      const depois = await service.importarGen4('org-demo', { arquivos: [{ nome: 'b.kml', conteudoBase64: b64(strToU8(KML.replace('-52.09,-33.09,0', '-52.08,-33.08,0'))) }] });
      expect(depois.talhoes).toHaveLength(1);
      expect(depois.talhoes[0]!.id).toBe(antes.talhoes[0]!.id);
      expect(depois.talhoes[0]!.areaHa).not.toBe(antes.talhoes[0]!.areaHa);
      expect((await new ImportacoesRepository(banco).buscar('org-demo'))?.talhoes).toHaveLength(2);
    });

    it('KML só com ponto ou linha diz que faltam polígonos', async () => {
      await subir();
      await expect(service.importarGen4('org-demo', { arquivos: [{ nome: 'p.kml', conteudoBase64: b64(strToU8('<kml><Placemark><name>A</name><Point><coordinates>-52,-33</coordinates></Point></Placemark></kml>')) }] })).rejects.toMatchObject({ response: { codigo: 'SEM_TALHOES' } });
    });
  });
});
