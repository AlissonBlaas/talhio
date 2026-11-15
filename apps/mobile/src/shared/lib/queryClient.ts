import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { ApiErro } from './apiClient';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dado fresco por 30 s: dentro disso, nenhuma tela dispara request novo.
      staleTime: 30_000,
      // Leitura repete até 2 vezes, exceto em erro que repetir não resolve (404, 400...).
      retry: (falhas, erro) => !(erro instanceof ApiErro && erro.status >= 400 && erro.status < 500) && falhas < 2,
    },
    // Envio nunca repete sozinho: evita mandar o mesmo plano duas vezes ao trator.
    mutations: { retry: 0 },
  },
});

/**
 * No React Native, foco e conexão não são detectados sozinhos como no navegador.
 * Chamado uma vez, no layout raiz.
 */
export function ligarRefetchAutomatico(): () => void {
  // Voltou para o app -> refaz as queries vencidas.
  const foco = AppState.addEventListener('change', (estado) => {
    if (Platform.OS !== 'web') focusManager.setFocused(estado === 'active');
  });
  // Voltou o sinal -> refaz o que falhou sem internet.
  onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(!!s.isConnected)));
  return () => foco.remove();
}
