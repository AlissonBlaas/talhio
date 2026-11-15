import { Redis } from 'ioredis';

export const ARMAZEM_WHATSAPP = Symbol('ARMAZEM_WHATSAPP');

/**
 * Onde ficam as credenciais e as chaves de sessão do WhatsApp (já cifradas por quem chama). Mudam o tempo todo e
 * crescem com o uso, por isso ficam no Redis e não no Postgres.
 */
export interface ArmazemWhatsapp {
  lerCredenciais(orgId: string): Promise<string | null>;
  gravarCredenciais(orgId: string, valor: string): Promise<void>;
  lerChaves(orgId: string, tipo: string, ids: string[]): Promise<Map<string, string>>;
  /** `null` apaga a chave. Tudo numa ida só ao Redis por tipo. */
  gravarChaves(orgId: string, tipo: string, valores: Map<string, string | null>): Promise<void>;
  /** Credenciais e todas as chaves da fazenda. */
  apagarTudo(orgId: string): Promise<void>;
  fechar(): Promise<void>;
}

const credenciais = (orgId: string) => `wa:creds:${orgId}`;
const chaves = (orgId: string, tipo: string) => `wa:keys:${orgId}:${tipo}`;

export class ArmazemRedis implements ArmazemWhatsapp {
  constructor(private readonly redis: Redis) {}

  static daUrl(url: string): ArmazemRedis {
    return new ArmazemRedis(new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false }));
  }

  lerCredenciais(orgId: string): Promise<string | null> {
    return this.redis.get(credenciais(orgId));
  }

  async gravarCredenciais(orgId: string, valor: string): Promise<void> {
    await this.redis.set(credenciais(orgId), valor);
  }

  async lerChaves(orgId: string, tipo: string, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    // HMGET: um comando para o lote inteiro (Upstash e afins cobram por comando).
    const valores = await this.redis.hmget(chaves(orgId, tipo), ...ids);
    const saida = new Map<string, string>();
    ids.forEach((id, i) => {
      const v = valores[i];
      if (v) saida.set(id, v);
    });
    return saida;
  }

  async gravarChaves(orgId: string, tipo: string, valores: Map<string, string | null>): Promise<void> {
    const apagar = [...valores].filter(([, v]) => v === null).map(([id]) => id);
    const gravar = [...valores].filter((par): par is [string, string] => par[1] !== null).flat();
    const chave = chaves(orgId, tipo);
    await Promise.all([apagar.length ? this.redis.hdel(chave, ...apagar) : null, gravar.length ? this.redis.hset(chave, ...gravar) : null]);
  }

  async apagarTudo(orgId: string): Promise<void> {
    const apagar = [credenciais(orgId)];
    // SCAN (nunca KEYS): não trava o Redis compartilhado com outras fazendas.
    for await (const lote of this.redis.scanStream({ match: `wa:keys:${orgId}:*`, count: 200 })) apagar.push(...(lote as string[]));
    await this.redis.del(...apagar);
  }

  async fechar(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}

/** Sem Redis (desenvolvimento e testes): guarda na memória e perde tudo ao reiniciar. */
export class ArmazemMemoria implements ArmazemWhatsapp {
  private readonly creds = new Map<string, string>();
  private readonly chaves = new Map<string, Map<string, string>>();

  async lerCredenciais(orgId: string) {
    return this.creds.get(orgId) ?? null;
  }
  async gravarCredenciais(orgId: string, valor: string) {
    this.creds.set(orgId, valor);
  }
  async lerChaves(orgId: string, tipo: string, ids: string[]) {
    const g = this.chaves.get(`${orgId}:${tipo}`);
    return new Map(ids.flatMap((id) => (g?.has(id) ? [[id, g.get(id)!] as [string, string]] : [])));
  }
  async gravarChaves(orgId: string, tipo: string, valores: Map<string, string | null>) {
    const g = this.chaves.get(`${orgId}:${tipo}`) ?? new Map<string, string>();
    for (const [id, v] of valores) v === null ? g.delete(id) : g.set(id, v);
    this.chaves.set(`${orgId}:${tipo}`, g);
  }
  async apagarTudo(orgId: string) {
    this.creds.delete(orgId);
    for (const k of [...this.chaves.keys()]) if (k.startsWith(`${orgId}:`)) this.chaves.delete(k);
  }
  async fechar() {}
}
