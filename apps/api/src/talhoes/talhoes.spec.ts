import { Test } from '@nestjs/testing';
import { FakeProvedor } from '@talhio/deere';
import { NovoTalhaoSchema } from '@talhio/shared';
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
