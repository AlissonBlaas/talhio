import { Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold } from '@expo-google-fonts/outfit';
import { NunitoSans_400Regular, NunitoSans_400Regular_Italic, NunitoSans_500Medium, NunitoSans_600SemiBold } from '@expo-google-fonts/nunito-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useMaquinasAoVivo } from '@/features/maquinas';
import { usePushDoApp } from '@/features/notificacoes';
import { canalAoVivo } from '@/shared/lib/canalAoVivo';
import { ligarRefetchAutomatico, queryClient } from '@/shared/lib/queryClient';
import { sessao, useSessao } from '@/shared/lib/sessao';

SplashScreen.preventAutoHideAsync();

/** Mantém o canal ao vivo aberto enquanto houver login e joga as máquinas que chegam por ele no cache. */
function CanalAoVivo() {
  useMaquinasAoVivo();
  usePushDoApp();
  useEffect(() => canalAoVivo.ligar(), []);
  return null;
}

export default function RootLayout() {
  const [fontesProntas, erroFontes] = useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    NunitoSans_400Regular,
    NunitoSans_400Regular_Italic,
    NunitoSans_500Medium,
    NunitoSans_600SemiBold,
  });
  const { status } = useSessao();
  const pronto = (fontesProntas || !!erroFontes) && status !== 'carregando';
  const logado = status === 'logado';

  useEffect(() => ligarRefetchAutomatico(), []);
  useEffect(() => void sessao.carregar(), []);
  // Saiu (ou a sessão venceu): nenhum dado da fazenda fica na memória do app.
  useEffect(() => {
    if (status === 'deslogado') queryClient.clear();
  }, [status]);
  useEffect(() => {
    if (pronto) void SplashScreen.hideAsync();
  }, [pronto]);

  if (!pronto) return null;

  // As abas ficam num grupo; telas em tela cheia (mapa, fluxos) empilham por cima delas.
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <CanalAoVivo />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Sem login, só existe a tela de entrar; com login, ela some e o app aparece. */}
        <Stack.Protected guard={logado}>
          <Stack.Screen name="(abas)" />
          <Stack.Screen name="mapa" />
          <Stack.Screen name="novo-talhao" />
          <Stack.Screen name="linha-ab" />
          <Stack.Screen name="novo-plano" />
          <Stack.Screen name="planejar" />
          <Stack.Screen name="escala-do-plano" />
          <Stack.Screen name="ao-vivo" />
          <Stack.Screen name="maquina/[id]" />
          <Stack.Screen name="importar" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="config" />
          <Stack.Screen name="notificacoes" />
        </Stack.Protected>
        <Stack.Protected guard={!logado}>
          <Stack.Screen name="login" />
          <Stack.Screen name="cadastro" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
