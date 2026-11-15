import { Controller, Get } from '@nestjs/common';
import { Publico } from '../auth/auth.decorators.js';

@Controller('saude')
export class SaudeController {
  /** Aberta, para monitoramento. Não revela nada sobre a configuração. */
  @Publico()
  @Get()
  verificar() {
    return { ok: true, hora: new Date().toISOString() };
  }
}
