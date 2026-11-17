import { Module } from '@nestjs/common';
import { AoVivoModule } from './ao-vivo/ao-vivo.module.js';
import { AssistenteModule } from './assistente/assistente.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BancoModule } from './banco/banco.module.js';
import { CoreModule } from './core/core.module.js';
import { DemonstracaoModule } from './demonstracao/demonstracao.module.js';
import { DeereModule } from './integracoes/deere/deere.module.js';
import { EscalaModule } from './escala/escala.module.js';
import { ImportacoesModule } from './importacoes/importacoes.module.js';
import { LinhasModule } from './linhas/linhas.module.js';
import { MaquinasModule } from './maquinas/maquinas.module.js';
import { NotificacoesModule } from './notificacoes/notificacoes.module.js';
import { PainelModule } from './painel/painel.module.js';
import { PlanosModule } from './planos/planos.module.js';
import { RelatoriosModule } from './relatorios/relatorios.module.js';
import { SaudeModule } from './saude/saude.module.js';
import { TalhoesModule } from './talhoes/talhoes.module.js';
import { WhatsappModule } from './whatsapp/whatsapp.module.js';

// O AppModule só importa módulos: nenhum controller ou provider é declarado aqui.
@Module({
  imports: [CoreModule, BancoModule, DemonstracaoModule, AuthModule, DeereModule, SaudeModule, MaquinasModule, TalhoesModule, LinhasModule, ImportacoesModule, PainelModule, RelatoriosModule, EscalaModule, PlanosModule, AssistenteModule, AoVivoModule, WhatsappModule, NotificacoesModule],
})
export class AppModule {}
