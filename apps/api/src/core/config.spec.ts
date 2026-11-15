import { carregarConfig } from './config.js';

describe('carregarConfig', () => {
  it('em desenvolvimento usa login padrão e avisa', () => {
    const config = carregarConfig({ NODE_ENV: 'test' });
    expect(config.credenciaisDeDesenvolvimento).toBe(true);
    expect(config.jwtSegredo.length).toBeGreaterThanOrEqual(32);
    expect(config.corsOrigens).toEqual([]);
    // Nos testes o banco é só em memória.
    expect(config).toMatchObject({ bancoUrl: null, bancoPasta: null });
  });

  it('em produção não sobe sem segredo e login definidos', () => {
    expect(() => carregarConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET, ADMIN_EMAIL, ADMIN_SENHA, DATABASE_URL/);
    expect(() => carregarConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), ADMIN_EMAIL: 'a@b.com' })).toThrow(/ADMIN_SENHA/);
  });

  it('recusa segredo curto e senha fraca', () => {
    expect(() => carregarConfig({ JWT_SECRET: 'curto' })).toThrow(/32 caracteres/);
    expect(() => carregarConfig({ ADMIN_SENHA: '123456' })).toThrow(/10 caracteres/);
  });

  it('em produção, com tudo definido, não usa nenhum padrão', () => {
    const config = carregarConfig({ NODE_ENV: 'production', JWT_SECRET: 's'.repeat(40), ADMIN_EMAIL: 'Dono@Fazenda.com', ADMIN_SENHA: 'senha-bem-forte', DATABASE_URL: 'postgres://u:s@host:5432/talhio', CORS_ORIGENS: 'https://a.com, https://b.com' });
    expect(config).toMatchObject({ credenciaisDeDesenvolvimento: false, adminEmail: 'dono@fazenda.com', jwtSegredo: 's'.repeat(40), bancoUrl: 'postgres://u:s@host:5432/talhio', corsOrigens: ['https://a.com', 'https://b.com'] });
  });
});
