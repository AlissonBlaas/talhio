import { SessaoSchema, type Sessao, type Usuario } from '@talhio/shared';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

/**
 * Sessão do usuário: quem está logado e os tokens.
 *
 * Os tokens ficam no cofre do aparelho (Keychain no iOS, Keystore no Android), nunca em
 * armazenamento comum, e só neste aparelho (não vão para backup).
 */
type Estado = { status: 'carregando' } | { status: 'deslogado' } | { status: 'logado'; usuario: Usuario };

const CHAVE = 'talhio.sessao';
const OPCOES: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

let estado: Estado = { status: 'carregando' };
let tokens: { acesso: string; renovacao: string } | null = null;
const ouvintes = new Set<() => void>();

function mudar(novo: Estado) {
  estado = novo;
  for (const ouvinte of ouvintes) ouvinte();
}

export const sessao = {
  /** Lê a sessão guardada. Chamado uma vez, ao abrir o app. */
  async carregar(): Promise<void> {
    try {
      const guardado = await SecureStore.getItemAsync(CHAVE, OPCOES);
      const lido = guardado ? SessaoSchema.safeParse(JSON.parse(guardado)) : null;
      if (lido?.success) {
        // O token de acesso guardado pode ter vencido: a primeira chamada renova sozinha.
        tokens = { acesso: lido.data.tokenAcesso, renovacao: lido.data.tokenRenovacao };
        mudar({ status: 'logado', usuario: lido.data.usuario });
        return;
      }
    } catch {
      // Cofre indisponível ou conteúdo estragado: trata como deslogado.
    }
    mudar({ status: 'deslogado' });
  },

  async definir(nova: Sessao): Promise<void> {
    tokens = { acesso: nova.tokenAcesso, renovacao: nova.tokenRenovacao };
    mudar({ status: 'logado', usuario: nova.usuario });
    await SecureStore.setItemAsync(CHAVE, JSON.stringify(nova), OPCOES).catch(() => undefined);
  },

  async limpar(): Promise<void> {
    tokens = null;
    mudar({ status: 'deslogado' });
    await SecureStore.deleteItemAsync(CHAVE, OPCOES).catch(() => undefined);
  },

  tokenAcesso: () => tokens?.acesso ?? null,
  tokenRenovacao: () => tokens?.renovacao ?? null,
  atual: () => estado,
  assinar(ouvinte: () => void): () => void {
    ouvintes.add(ouvinte);
    return () => ouvintes.delete(ouvinte);
  },
};

/** Estado da sessão para a tela: carregando, deslogado ou logado (com o usuário). */
export function useSessao(): Estado {
  return useSyncExternalStore(sessao.assinar, sessao.atual, sessao.atual);
}
