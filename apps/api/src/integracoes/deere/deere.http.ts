/** Ponto de injeção do `fetch`: os testes trocam por uma versão simulada, sem rede. */
export const DEERE_HTTP = Symbol('DEERE_HTTP');
export type Http = typeof fetch;
