import { Test } from '@nestjs/testing';
import { FakeProvedor } from '@talhio/deere';
import { BANCO } from '../banco/banco.module.js';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import { EscalaRepository } from '../escala/escala.repository.js';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { LarguraImplementoRepository } from '../integracoes/deere/largura-implemento.repository.js';
import { MaquinasService } from '../maquinas/maquinas.service.js';
import { PlanosRepository } from '../planos/planos.repository.js';
import { TalhoesRepository } from '../talhoes/talhoes.repository.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';
import { FakeWhatsapp, GRUPOS_DE_EXEMPLO } from '../whatsapp/fake-whatsapp.js';
import { WhatsappRepository } from '../whatsapp/whatsapp.repository.js';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { PROVEDOR_WHATSAPP } from '../whatsapp/whatsapp.tokens.js';
import { RelatoriosEnvioService } from './relatorios-envio.service.js';
import { RelatoriosService } from './relatorios.service.js';
import { textoDoRelatorioParaWhatsapp } from './texto-whatsapp.js';

const AGORA = new Date('2026-11-10T15:00:00.000Z');

async function montar() {
  const fake = new FakeWhatsapp();
  const modulo = await Test.createTestingModule({
    providers: [RelatoriosService, RelatoriosEnvioService, PlanosRepository, MaquinasService, LarguraImplementoRepository, TalhoesService, TalhoesRepository, EscalaRepository, WhatsappService, WhatsappRepository, { provide: BANCO, useValue: await criarBancoDeTeste() }, { provide: PROVEDOR_MAQUINAS, useValue: new FakeProvedor(() => AGORA) }, { provide: PROVEDOR_WHATSAPP, useValue: fake }],
  }).compile();
  return { fake, envio: modulo.get(RelatoriosEnvioService), relatorios: modulo.get(RelatoriosService), whatsapp: modulo.get(WhatsappService) };
}

describe('envio do relatório ao grupo do WhatsApp', () => {
  it('sem WhatsApp conectado ou sem grupo, diz o que falta e não manda nada', async () => {
    const { fake, envio, whatsapp } = await montar();
    await expect(envio.enviarAoGrupo('org-demo', 'dia')).rejects.toMatchObject({ response: { codigo: 'WHATSAPP_NAO_CONECTADO' } });
    await whatsapp.pedirCodigo('org-demo', '5547999990000');
    fake.confirmar('org-demo');
    await expect(envio.enviarAoGrupo('org-demo', 'dia')).rejects.toMatchObject({ response: { codigo: 'WHATSAPP_SEM_GRUPO' } });
    expect(fake.enviadasNoGrupo).toEqual([]);
  });

  it('manda o PDF com o resumo como legenda para o grupo escolhido', async () => {
    const { fake, envio, whatsapp } = await montar();
    await whatsapp.pedirCodigo('org-demo', '5547999990000');
    fake.confirmar('org-demo');
    const grupo = GRUPOS_DE_EXEMPLO[0]!;
    await whatsapp.escolherGrupo('org-demo', grupo.id);
    expect(await envio.enviarAoGrupo('org-demo', 'semana')).toEqual({ grupoNome: grupo.nome });
    expect(fake.enviadasNoGrupo).toHaveLength(1);
    const [enviada] = fake.enviadasNoGrupo;
    expect(enviada).toMatchObject({ orgId: 'org-demo', grupoId: grupo.id });
    expect(enviada?.anexo).toMatch(/^relatorio-talhio-semana-.*\.pdf$/);
    expect(enviada?.texto).toContain('📋 *Relatório da semana · ');
    expect(enviada?.texto).toContain('Área trabalhada: ');
  });

  it('o texto só traz combustível quando há leitura (nunca zero inventado)', async () => {
    const { relatorios } = await montar();
    const r = await relatorios.montar('org-demo', 'dia', undefined, AGORA);
    const sem = textoDoRelatorioParaWhatsapp({ ...r, indicadores: { ...r.indicadores, litros: { valor: null, anterior: null } } });
    expect(sem).not.toContain('Combustível');
    const com = textoDoRelatorioParaWhatsapp({ ...r, indicadores: { ...r.indicadores, litros: { valor: 1234, anterior: null }, consumoLPorHa: { valor: 9.5, anterior: null } } });
    expect(com).toContain('⛽ Combustível: 1.234 L (9,5 L/ha)');
    expect(com.split('\n')[0]).toBe(`📋 *Relatório do dia · ${r.fazendaNome}*`);
  });
});
