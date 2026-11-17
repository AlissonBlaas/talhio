import { Test } from '@nestjs/testing';
import { FakeProvedor } from '@talhio/deere';
import { EditarTalhaoSchema, NovoTalhaoSchema } from '@talhio/shared';
import { BANCO } from '../banco/banco.module.js';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { LinhasRepository } from '../linhas/linhas.repository.js';
import { LinhasService } from '../linhas/linhas.service.js';
import { TalhoesRepository } from './talhoes.repository.js';
import { TalhoesService } from './talhoes.service.js';

const ORG = 'org-demo';
const G = 1 / 111_320;
const quadrado = (x: number) => ({ type: 'Polygon' as const, coordinates: [[[x, 0], [x + 200 * G, 0], [x + 200 * G, 200 * G], [x, 200 * G], [x, 0]] as [number, number][]] });

describe('talhão desenhado no app e a John Deere', () => {
  let talhoes: TalhoesService;
  let linhas: LinhasService;
  let provedor: FakeProvedor;
  const linhasEnviadas = () => [...(provedor as unknown as { linhasEnviadas: Map<string, { talhaoId: string | null }> }).linhasEnviadas.values()];

  beforeAll(async () => {
    provedor = new FakeProvedor();
    const modulo = await Test.createTestingModule({
      providers: [TalhoesService, TalhoesRepository, LinhasService, LinhasRepository, { provide: BANCO, useValue: await criarBancoDeTeste() }, { provide: PROVEDOR_MAQUINAS, useValue: provedor }],
    }).compile();
    talhoes = modulo.get(TalhoesService);
    linhas = modulo.get(LinhasService);
  });

  it('sem pedir, o talhão fica só no Talhio e a linha dele não é enviada', async () => {
    const talhao = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Só aqui', contorno: quadrado(10) }));
    expect(talhao.envioDeere).toBe('nao-pedido');
    expect(provedor.talhoesEnviados).toHaveLength(0);
    const linha = await linhas.criar(ORG, { nome: 'L1', talhaoId: talhao.id, a: { lat: 0, lng: 10 }, b: { lat: 100 * G, lng: 10 }, padraoDaFazenda: false });
    expect(linha.envio).toBe('so-no-talhio');
    expect(linhasEnviadas()).toHaveLength(0);
  });

  it('pedindo, o talhão é criado lá e a linha vai para o id dele NA John Deere', async () => {
    const talhao = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Vai para a Deere', contorno: quadrado(20), enviarParaDeere: true }));
    expect(talhao.envioDeere).toBe('enviado');
    expect(provedor.talhoesEnviados).toEqual([{ id: 'campo-1', nome: 'Vai para a Deere' }]);
    expect(await talhoes.idNaDeere(ORG, talhao.id)).toBe('campo-1');
    const linha = await linhas.criar(ORG, { nome: 'L2', talhaoId: talhao.id, a: { lat: 0, lng: 20 }, b: { lat: 100 * G, lng: 20 }, padraoDaFazenda: false });
    expect(linha.envio).toBe('enviada');
    expect(linhasEnviadas().map((l) => l.talhaoId)).toEqual(['campo-1']);
    // Na lista, o talhão aparece uma vez só, com o id do Talhio.
    expect((await talhoes.listar(ORG)).filter((t) => t.nome === 'Vai para a Deere').map((t) => t.id)).toEqual([talhao.id]);
  });

  it('se a John Deere recusa, o talhão continua salvo', async () => {
    provedor.enviarTalhao = async () => {
      throw new Error('403');
    };
    const talhao = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Recusado', contorno: quadrado(30), enviarParaDeere: true }));
    expect(talhao.envioDeere).toBe('recusado');
    expect((await talhoes.listar(ORG)).some((t) => t.id === talhao.id)).toBe(true);
    expect(await talhoes.idNaDeere(ORG, talhao.id)).toBeNull();
  });
});

describe('editar e apagar talhão desenhado no app', () => {
  let talhoes: TalhoesService;
  let linhas: LinhasService;
  let provedor: FakeProvedor;
  const editar = (id: string, dados: unknown) => talhoes.editar(ORG, id, EditarTalhaoSchema.parse(dados));

  beforeEach(async () => {
    provedor = new FakeProvedor();
    const modulo = await Test.createTestingModule({
      providers: [TalhoesService, TalhoesRepository, LinhasService, LinhasRepository, { provide: BANCO, useValue: await criarBancoDeTeste() }, { provide: PROVEDOR_MAQUINAS, useValue: provedor }],
    }).compile();
    talhoes = modulo.get(TalhoesService);
    linhas = modulo.get(LinhasService);
  });

  it('a lista marca o que é do app e o que tem cópia na John Deere', async () => {
    const so = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Só aqui', contorno: quadrado(10) }));
    const la = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Lá também', contorno: quadrado(20), enviarParaDeere: true }));
    const lista = await talhoes.listar(ORG);
    expect(lista.find((t) => t.id === so.id)).toMatchObject({ doApp: true, naDeere: false });
    expect(lista.find((t) => t.id === la.id)).toMatchObject({ doApp: true, naDeere: true });
    // Os que vêm do provedor não levam a marca: o app não oferece editar nem apagar.
    expect(lista.filter((t) => t.id !== so.id && t.id !== la.id).every((t) => t.doApp === undefined)).toBe(true);
  });

  it('editar muda nome e contorno, recalcula a área e mantém o id', async () => {
    const talhao = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Teste', contorno: quadrado(10) }));
    const maior = { type: 'Polygon' as const, coordinates: [[[10, 0], [10 + 400 * G, 0], [10 + 400 * G, 200 * G], [10, 200 * G]] as [number, number][]] };
    const editado = await editar(talhao.id, { nome: 'Baixada', contorno: maior });
    expect(editado).toMatchObject({ id: talhao.id, nome: 'Baixada', envioDeere: 'nao-pedido' });
    expect(editado.areaHa).toBeCloseTo(talhao.areaHa * 2, 0);
    // Salvo fechado, como na criação.
    expect(editado.contorno.coordinates[0]).toHaveLength(5);
    expect((await talhoes.listar(ORG)).find((t) => t.id === talhao.id)).toMatchObject({ nome: 'Baixada', areaHa: editado.areaHa });
    expect(provedor.talhoesEnviados).toHaveLength(0);
  });

  it('editar só o nome não mexe no contorno, e nome de outro talhão é recusado', async () => {
    const a = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'A', contorno: quadrado(10) }));
    await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'B', contorno: quadrado(20) }));
    await expect(editar(a.id, { nome: 'b' })).rejects.toMatchObject({ response: { codigo: 'TALHAO_NOME_REPETIDO' } });
    // O próprio nome (só mudando maiúsculas) passa.
    const mesmo = await editar(a.id, { nome: 'a' });
    expect(mesmo).toMatchObject({ nome: 'a', areaHa: a.areaHa, contorno: a.contorno });
  });

  it('contorno pequeno demais é recusado e o talhão fica como estava', async () => {
    const talhao = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Teste', contorno: quadrado(10) }));
    const minimo = { type: 'Polygon' as const, coordinates: [[[10, 0], [10 + 5 * G, 0], [10 + 5 * G, 5 * G], [10, 5 * G]] as [number, number][]] };
    await expect(editar(talhao.id, { contorno: minimo })).rejects.toMatchObject({ response: { codigo: 'TALHAO_MUITO_PEQUENO' } });
    expect((await talhoes.listar(ORG)).find((t) => t.id === talhao.id)?.areaHa).toBe(talhao.areaHa);
  });

  it('reenviar: talhão que já está na John Deere recebe o nome e o contorno novos, no mesmo id de lá', async () => {
    const talhao = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Teste', contorno: quadrado(10), enviarParaDeere: true }));
    const editado = await editar(talhao.id, { nome: 'Baixada', enviarParaDeere: true });
    expect(editado).toMatchObject({ envioDeere: 'enviado', naDeere: true });
    expect(provedor.talhoesAtualizados).toEqual([{ id: 'campo-1', nome: 'Baixada', cantos: 5 }]);
    expect(provedor.talhoesEnviados).toEqual([{ id: 'campo-1', nome: 'Baixada' }]);
    expect(await talhoes.idNaDeere(ORG, talhao.id)).toBe('campo-1');
  });

  it('reenviar: talhão que estava só no Talhio é criado na John Deere', async () => {
    const talhao = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Teste', contorno: quadrado(10) }));
    const editado = await editar(talhao.id, { enviarParaDeere: true });
    expect(editado.envioDeere).toBe('enviado');
    expect(provedor.talhoesEnviados).toEqual([{ id: 'campo-1', nome: 'Teste' }]);
    expect(provedor.talhoesAtualizados).toHaveLength(0);
    expect(await talhoes.idNaDeere(ORG, talhao.id)).toBe('campo-1');
  });

  it('a John Deere recusar a mudança não desfaz a edição', async () => {
    const talhao = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Teste', contorno: quadrado(10), enviarParaDeere: true }));
    provedor.atualizarTalhao = async () => {
      throw new Error('403');
    };
    const editado = await editar(talhao.id, { nome: 'Baixada', enviarParaDeere: true });
    expect(editado).toMatchObject({ nome: 'Baixada', envioDeere: 'recusado' });
    expect((await talhoes.listar(ORG)).find((t) => t.id === talhao.id)?.nome).toBe('Baixada');
  });

  it('apagar tira o talhão e as linhas dele; as de outro talhão ficam', async () => {
    const teste = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Teste', contorno: quadrado(10) }));
    const fica = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Fica', contorno: quadrado(20) }));
    await linhas.criar(ORG, { nome: 'Do teste', talhaoId: teste.id, a: { lat: 0, lng: 10 }, b: { lat: 100 * G, lng: 10 }, padraoDaFazenda: false });
    await linhas.criar(ORG, { nome: 'Do que fica', talhaoId: fica.id, a: { lat: 0, lng: 20 }, b: { lat: 100 * G, lng: 20 }, padraoDaFazenda: false });
    expect(await talhoes.apagar(ORG, teste.id, false)).toEqual({ naDeere: 'nao-tinha' });
    expect((await talhoes.listar(ORG)).map((t) => t.id)).not.toContain(teste.id);
    const nomes = (await linhas.listar(ORG)).map((l) => l.nome);
    expect(nomes).toContain('Do que fica');
    expect(nomes).not.toContain('Do teste');
    // Apagado: editar ou apagar de novo não acha.
    await expect(talhoes.apagar(ORG, teste.id, false)).rejects.toMatchObject({ response: { codigo: 'TALHAO_NAO_ENCONTRADO' } });
  });

  it('apagar só arquiva na John Deere quando pedido', async () => {
    const um = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Um', contorno: quadrado(10), enviarParaDeere: true }));
    const dois = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Dois', contorno: quadrado(20), enviarParaDeere: true }));
    expect(await talhoes.apagar(ORG, um.id, false)).toEqual({ naDeere: 'mantido' });
    expect(provedor.talhoesArquivados).toEqual([]);
    expect(await talhoes.apagar(ORG, dois.id, true)).toEqual({ naDeere: 'arquivado' });
    expect(provedor.talhoesArquivados).toEqual(['campo-2']);
  });

  it('a John Deere recusar o arquivamento não traz o talhão de volta', async () => {
    const talhao = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Um', contorno: quadrado(10), enviarParaDeere: true }));
    provedor.arquivarTalhao = async () => {
      throw new Error('403');
    };
    expect(await talhoes.apagar(ORG, talhao.id, true)).toEqual({ naDeere: 'recusado' });
    expect((await talhoes.listar(ORG)).map((t) => t.id)).not.toContain(talhao.id);
  });

  it('talhão que veio do provedor não é editado nem apagado pelo app', async () => {
    const [externo] = await provedor.listarTalhoes();
    await expect(editar(externo!.id, { nome: 'Outro' })).rejects.toMatchObject({ response: { codigo: 'TALHAO_DE_FORA' } });
    await expect(talhoes.apagar(ORG, externo!.id, true)).rejects.toMatchObject({ response: { codigo: 'TALHAO_DE_FORA' } });
    expect(provedor.talhoesArquivados).toEqual([]);
  });

  it('talhão de outra fazenda não é achado', async () => {
    const talhao = await talhoes.criar(ORG, NovoTalhaoSchema.parse({ nome: 'Teste', contorno: quadrado(10) }));
    await expect(talhoes.apagar('org-outra', talhao.id, false)).rejects.toMatchObject({ response: { codigo: expect.stringMatching(/TALHAO_/) } });
    expect((await talhoes.listar(ORG)).map((t) => t.id)).toContain(talhao.id);
  });
});
