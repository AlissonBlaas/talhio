import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const chaveDe = (segredo: string) => createHash('sha256').update(segredo).digest();

/** Cifra um texto com AES-256-GCM. Sai como `v1.iv.etiqueta.dados` (base64url). */
export function cifrar(texto: string, segredo: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chaveDe(segredo), iv);
  const dados = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
  return ['v1', iv.toString('base64url'), cifra.getAuthTag().toString('base64url'), dados.toString('base64url')].join('.');
}

/** Desfaz `cifrar`. Lança erro se a chave estiver errada ou o texto foi alterado. */
export function decifrar(guardado: string, segredo: string): string {
  const [versao, iv, etiqueta, dados] = guardado.split('.');
  if (versao !== 'v1' || !iv || !etiqueta || !dados) throw new Error('Token guardado em formato desconhecido');
  const decifra = createDecipheriv('aes-256-gcm', chaveDe(segredo), Buffer.from(iv, 'base64url'));
  decifra.setAuthTag(Buffer.from(etiqueta, 'base64url'));
  return Buffer.concat([decifra.update(Buffer.from(dados, 'base64url')), decifra.final()]).toString('utf8');
}
