import { writeFile } from 'node:fs/promises';
import { PlanosRepository } from '../planos/planos.repository.js';
import { LarguraImplementoRepository } from '../integracoes/deere/largura-implemento.repository.js';
import { Test } from '@nestjs/testing';
import { FakeProvedor } from '@talhio/deere';
import { BANCO } from '../banco/banco.module.js';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import { EscalaRepository } from '../escala/escala.repository.js';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { MaquinasService } from '../maquinas/maquinas.service.js';
import { TalhoesRepository } from '../talhoes/talhoes.repository.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';
import { gerarPdfDoRelatorio, nomeDoArquivoPdf } from './relatorio-pdf.js';
import { RelatoriosService } from './relatorios.service.js';

const AGORA = new Date('2026-11-10T15:00:00.000Z');

describe('PDF do relatório', () => {
  it('gera um PDF válido para o dia, a semana e o mês', async () => {
    const modulo = await Test.createTestingModule({
      providers: [RelatoriosService, PlanosRepository, MaquinasService, LarguraImplementoRepository, TalhoesService, TalhoesRepository, EscalaRepository, { provide: BANCO, useValue: await criarBancoDeTeste() }, { provide: PROVEDOR_MAQUINAS, useValue: new FakeProvedor(() => AGORA) }],
    }).compile();
    const service = modulo.get(RelatoriosService);
    for (const periodo of ['dia', 'semana', 'mes'] as const) {
      const relatorio = await service.montar('org-demo', periodo, undefined, AGORA);
      const pdf = await gerarPdfDoRelatorio(relatorio, AGORA);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(5_000);
      expect(nomeDoArquivoPdf(relatorio)).toMatch(/^relatorio-talhio-(dia|semana|mes)-\d{4}-\d{2}/);
      if (process.env.SALVAR_PDF) await writeFile(`${process.env.SALVAR_PDF}/${periodo}.pdf`, pdf);
    }
  });
});
