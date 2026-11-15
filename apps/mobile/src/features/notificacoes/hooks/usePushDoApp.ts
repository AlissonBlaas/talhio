import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { configurarExibicao, registrarPush } from '../lib-push';
import { notificacoesKeys } from '../notificacoes.keys';

configurarExibicao();

/**
 * Liga o push enquanto há login: registra o aparelho, atualiza a aba quando chega um aviso com o app aberto e abre a
 * máquina quando a pessoa toca no aviso. Montar uma vez, na raiz, só com o usuário logado.
 */
export function usePushDoApp(): void {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    void registrarPush();
  }, []);

  useEffect(() => {
    const recebida = Notifications.addNotificationReceivedListener(() => void queryClient.invalidateQueries({ queryKey: notificacoesKeys.todas }));
    const tocada = Notifications.addNotificationResponseReceivedListener((resposta) => {
      void queryClient.invalidateQueries({ queryKey: notificacoesKeys.todas });
      const maquinaId = resposta.notification.request.content.data?.maquinaId;
      if (typeof maquinaId === 'string' && maquinaId) router.push({ pathname: '/maquina/[id]', params: { id: maquinaId } });
      else router.push('/notificacoes');
    });
    return () => {
      recebida.remove();
      tocada.remove();
    };
  }, [queryClient, router]);
}
