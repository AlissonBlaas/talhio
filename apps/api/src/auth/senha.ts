import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scrypt) as (senha: string, sal: Buffer, tamanho: number) => Promise<Buffer>;
const TAMANHO = 64;

/** Guarda a senha como `scrypt$sal$hash` (nunca em texto). */
export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await derivar(senha, sal, TAMANHO);
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`;
}

/** Compara em tempo constante, para o tempo de resposta não revelar o quanto a senha acertou. */
export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [algoritmo, sal, hash] = guardado.split('$');
  if (algoritmo !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const calculado = await derivar(senha, Buffer.from(sal, 'base64'), esperado.length);
  return timingSafeEqual(esperado, calculado);
}
