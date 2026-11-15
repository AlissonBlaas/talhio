import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { notificacoesApi } from './api/notificacoesApi';

/** Token do Expo Push registrado neste aparelho nesta sessão (para tirar ao sair da conta). */
let tokenAtual: string | null = null;

export const tokenDePush = () => tokenAtual;

/** Como a notificação aparece com o app aberto: banner e som, igual a quando ele está fechado. */
export function configurarExibicao(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/**
 * Pede permissão (uma vez), pega o token do Expo deste aparelho e registra no servidor. Devolve o token, ou nulo
 * quando não dá: simulador, permissão negada, ou o app ainda sem projeto no Expo (EAS). Nunca lança: sem push o app
 * funciona igual, só sem o aviso no celular (a aba de notificações continua).
 */
export async function registrarPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alertas', { name: 'Alertas das máquinas', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250], lightColor: '#2E6A39' });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await notificacoesApi.registrarAparelho({ token, plataforma: Platform.OS === 'ios' ? 'ios' : 'android' });
    tokenAtual = token;
    return token;
  } catch {
    return null;
  }
}

/** Tira este aparelho da lista de push (sair da conta). Sair não pode depender de internet: erro é ignorado. */
export async function removerPush(): Promise<void> {
  const token = tokenAtual;
  tokenAtual = null;
  if (!token) return;
  await notificacoesApi.removerAparelho(token).catch(() => undefined);
}
