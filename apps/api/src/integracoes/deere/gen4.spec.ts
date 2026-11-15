import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FakeProvedor, lerPastaGen4 } from '@talhio/deere';

/** Pasta Gen4 mínima, com dados inventados no mesmo formato do monitor. */
function pastaDeTeste(): string {
  const pasta = mkdtempSync(join(tmpdir(), 'gen4-'));
  mkdirSync(join(pasta, 'SpatialFiles'));
  writeFileSync(
    join(pasta, 'MasterData.xml'),
    `<?xml version="1.0"?><SetupFile><Setup><Client StringGuid="c1" Name="FAZENDA TESTE &amp; CIA" />
      <Field StringGuid="f1" Name="TALHAO UM"><Farm>x</Farm></Field>
      <Guidance><Tracks><AdaptiveCurve StringGuid="g1" Name="CURVA" TaggedEntity="f1"><Geometry><FilenameWithExtension>curva.gjson</FilenameWithExtension><Path>./SpatialFiles/</Path></Geometry></AdaptiveCurve></Tracks></Guidance>
      <OperationalBoundary StringGuid="b1" TaggedEntity="f1" Name="LIMITE"><Geometry><FilenameWithExtension>limite.gjson</FilenameWithExtension><Path>./SpatialFiles/</Path></Geometry></OperationalBoundary>
    </Setup></SetupFile>`,
  );
  // Quadrado de ~1 km de lado, com o anel aberto (como o monitor exporta).
  const anel = [[-52, -33], [-51.9893, -33], [-51.9893, -32.991], [-52, -32.991]];
  writeFileSync(join(pasta, 'SpatialFiles', 'limite.gjson'), JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [anel] } }] }));
  const passadas = [0, 1, 2, 3].map((i) => [[-51.999 + i * 0.002, -32.999, 0, 1], [-51.999 + i * 0.002, -32.995, 0, 1], [-51.999 + i * 0.002, -32.992, 0, 1]]);
  writeFileSync(join(pasta, 'SpatialFiles', 'curva.gjson'), JSON.stringify({ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: passadas } }));
  return pasta;
}

describe('lerPastaGen4', () => {
  const fazenda = lerPastaGen4(pastaDeTeste());

  it('lê cliente, talhão com contorno fechado e área', () => {
    expect(fazenda.cliente).toBe('FAZENDA TESTE & CIA');
    expect(fazenda.talhoes).toHaveLength(1);
    const talhao = fazenda.talhoes[0]!;
    expect(talhao).toMatchObject({ id: 'f1', nome: 'TALHAO UM' });
    expect(talhao.contorno[0]).toEqual(talhao.contorno.at(-1));
    expect(talhao.areaHa).toBeGreaterThan(95);
    expect(talhao.areaHa).toBeLessThan(105);
  });

  it('lê a linha curva ligada ao talhão, só com longitude e latitude', () => {
    expect(fazenda.linhas).toHaveLength(1);
    const linha = fazenda.linhas[0]!;
    expect(linha).toMatchObject({ id: 'g1', talhaoId: 'f1', padrao: false });
    expect(linha.passadas).toHaveLength(4);
    expect(linha.passadas?.[0]?.[0]).toEqual([-51.999, -32.999]);
  });

  it('pasta sem MasterData.xml dá erro claro', () => {
    expect(() => lerPastaGen4(tmpdir() + '/nao-existe')).toThrow(/Pasta Gen4 inválida/);
  });

  it('o provedor falso passa a usar a fazenda importada e põe as máquinas nas linhas', async () => {
    const provedor = new FakeProvedor(undefined, fazenda);
    expect(await provedor.listarTalhoes()).toEqual(fazenda.talhoes);
    expect((await provedor.resumoDaFazenda()).nome).toBe('FAZENDA TESTE & CIA');
    const posicao = await provedor.ultimaPosicao('org', 'm-8r410');
    expect(fazenda.linhas[0]!.passadas!.flat()).toContainEqual([posicao!.lng, posicao!.lat]);
  });
});
