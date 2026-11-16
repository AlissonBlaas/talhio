import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { escalaKeys } from '@/features/escala';
import { relatoriosKeys } from '@/features/relatorios';
import { AlertaWhatsapp } from '@/features/whatsapp';
import { Surgir } from '@/shared/components/animacoes';
import { useAlturaDaBarra } from '@/shared/components/BarraDeAbas';
import { ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { cores, MARGEM_TELA } from '@/shared/theme/tokens';

import { AcoesRapidas } from '../components/AcoesRapidas';
import { CabecalhoInicio } from '../components/CabecalhoInicio';
import { EscalaDeHoje } from '../components/EscalaDeHoje';
import { MiniMapa } from '../components/MiniMapa';
import { PerguntaRapida } from '../components/PerguntaRapida';
import { ProgressoOperacao } from '../components/ProgressoOperacao';
import { RelatorioDeHoje } from '../components/RelatorioDeHoje';
import { usePainelEstado } from '../hooks/usePainel';
import { inicioKeys } from '../inicio.keys';

/**
 * Só monta a tela: cada bloco busca e decide o que mostra por conta própria, sem receber props.
 * Aqui ficam a barra de status, o puxar-para-atualizar e a ordem dos blocos.
 */
export function InicioScreen() {
  const { erro, atualizar } = usePainelEstado();
  const alturaBarra = useAlturaDaBarra();

  // O topo é verde-lavoura: barra de status clara aqui, escura nas outras telas.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );

  // A tela abre na hora: cada bloco aparece quando o dado dele chega (mapa, painel, relatório e escala são pedidos separados).
  if (erro) return <View style={styles.fundo}><ErroComTentarDeNovo mensagem={erro.message} aoTentar={atualizar} /></View>;

  return (
    <View style={styles.fundo}>
      <ScrollView contentContainerStyle={{ paddingBottom: alturaBarra + 16 }} refreshControl={<Atualizador />}>
        <CabecalhoInicio />
        <View style={styles.corpo}>
          <AlertaWhatsapp />
          <Surgir ordem={1} modo="leve">
            <MiniMapa />
          </Surgir>
          <ProgressoOperacao />
          <AcoesRapidas />
          <RelatorioDeHoje />
          <PerguntaRapida />
          <EscalaDeHoje />
        </View>
      </ScrollView>
    </View>
  );
}

/** Puxar para atualizar: refaz o painel, o relatório de hoje e a escala. Estado só dele. */
function Atualizador() {
  const queryClient = useQueryClient();
  const { top } = useSafeAreaInsets();
  const [atualizando, setAtualizando] = useState(false);
  const aoAtualizar = async () => {
    setAtualizando(true);
    await Promise.all([inicioKeys.todas, relatoriosKeys.todos, escalaKeys.todas].map((queryKey) => queryClient.refetchQueries({ queryKey })));
    setAtualizando(false);
  };
  return <RefreshControl refreshing={atualizando} onRefresh={() => void aoAtualizar()} tintColor={cores.milho} progressViewOffset={top} />;
}

const styles = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  corpo: { paddingHorizontal: MARGEM_TELA, paddingTop: 18, gap: 18 },
});
