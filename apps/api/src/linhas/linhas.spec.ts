import { Test } from '@nestjs/testing';
import { FakeProvedor } from '@talhio/deere';
import { direcaoGraus, distanciaM, gerarPassadas, linhaPelaDirecao, NovaLinhaSchema } from '@talhio/shared';
import { BANCO } from '../banco/banco.module.js';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { TalhoesRepository } from '../talhoes/talhoes.repository.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';
import { LinhasRepository } from './linhas.repository.js';
import { LinhasService } from './linhas.service.js';

const G = 1 / 111_320; // um metro em graus, no equador
const quadrado = (ladoM: number) => ({
  type: 'Polygon' as const,
  coordinates: [[[0, 0], [ladoM * G, 0], [ladoM * G, ladoM * G], [0, ladoM * G], [0, 0]] as [number, number][]],
});

describe('geometria da linha AB', () => {
  it('direção: norte-sul é 0, leste-oeste é 90, e o sentido não importa', () => {
    expect(direcaoGraus({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBe(0);
    expect(direcaoGraus({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBe(90);
    expect(direcaoGraus({ lat: 0, lng: 1 }, { lat: 0, lng: 0 })).toBe(90);
  });

  it('linha pela direção devolve a direção pedida e o comprimento pedido', () => {
    const { a, b } = linhaPelaDirecao({ lat: 0, lng: 0 }, 62, 400);
    expect(direcaoGraus(a, b)).toBeCloseTo(62, 0);
    expect(distanciaM(a, b)).toBeCloseTo(400, 0);
  });

  it('passadas: talhão de 120 m com implemento de 12 m, linha na borda, dá 10 passadas de 120 m', () => {
    const passadas = gerarPassadas(quadrado(120), { lat: 0, lng: 0 }, { lat: 60 * G, lng: 0 }, 12);
    expect(passadas).toHaveLength(10);
    for (const [inicio, fim] of passadas) expect(distanciaM(inicio, fim)).toBeCloseTo(120, 0);
  });

  it('passadas ficam dentro do talhão mesmo em diagonal', () => {
    const lado = 120 * G;
    const passadas = gerarPassadas(quadrado(120), { lat: 0, lng: 0 }, { lat: lado, lng: lado }, 12);
    expect(passadas.length).toBeGreaterThan(10);
    for (const trecho of passadas) {
      for (const p of trecho) {
        expect(p.lat).toBeGreaterThan(-1e-9);
        expect(p.lat).toBeLessThan(lado + 1e-9);
        expect(p.lng).toBeGreaterThan(-1e-9);
        expect(p.lng).toBeLessThan(lado + 1e-9);
      }
    }
  });
});

describe('LinhasService', () => {
  let service: LinhasService;
  let provedor: FakeProvedor;

  beforeEach(async () => {
    provedor = new FakeProvedor();
    const modulo = await Test.createTestingModule({
      providers: [LinhasService, LinhasRepository, TalhoesService, TalhoesRepository, { provide: BANCO, useValue: await criarBancoDeTeste('org') }, { provide: PROVEDOR_MAQUINAS, useValue: provedor }],
    }).compile();
    service = modulo.get(LinhasService);
  });

  it('lista as linhas padrão da fazenda', async () => {
    const linhas = await service.listar('org');
    expect(linhas.filter((l) => l.padraoDaFazenda).map((l) => l.nome)).toEqual(['Padrão da fazenda', 'Leste-oeste', 'Nível do terraço']);
  });

  it('cria, calcula a direção e envia ao provedor uma vez', async () => {
    const dados = NovaLinhaSchema.parse({ nome: 'T7 · Plantio', talhaoId: 't7', a: { lat: -31.8, lng: -52.3 }, b: { lat: -31.79, lng: -52.3 } });
    const linha = await service.criar('org', dados);
    expect(linha.direcaoGraus).toBe(0);
    expect(provedor.linhasEnviadas.size).toBe(1);
    expect((await service.listar('org')).some((l) => l.id === linha.id)).toBe(true);
  });

  it('recusa talhão inexistente e pontos colados', async () => {
    const base = { nome: 'X', a: { lat: 0, lng: 0 }, b: { lat: 0.001, lng: 0 } };
    await expect(service.criar('org', NovaLinhaSchema.parse({ ...base, talhaoId: 'nao-existe' }))).rejects.toMatchObject({
      response: { codigo: 'TALHAO_NAO_ENCONTRADO' },
    });
    await expect(service.criar('org', NovaLinhaSchema.parse({ ...base, talhaoId: 't7', b: { lat: 0.00001, lng: 0 } }))).rejects.toMatchObject({
      response: { codigo: 'LINHA_MUITO_CURTA' },
    });
  });
});
