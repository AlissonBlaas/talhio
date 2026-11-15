import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icone } from './Icone';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

type Props = {
  titulo: string;
  subtitulo?: string;
  direita?: ReactNode;
  children?: ReactNode;
  /** Mostra o botão de voltar à esquerda do título. */
  voltar?: boolean;
  /** Passos de um fluxo: cheio = feito, tracejado = falta (as passadas da marca). */
  progresso?: boolean[];
};

/** Topo verde-lavoura das telas das abas: título, apoio e, embaixo, o que a tela quiser (filtro, seletor). */
export function CabecalhoTela({ titulo, subtitulo, direita, children, voltar, progresso }: Props) {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  // Fundo verde: barra de status clara enquanto a tela está em foco.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );
  return (
    <View style={[styles.topo, { paddingTop: top + 14 }]}>
      <View style={styles.linha}>
        {voltar ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.voltar}>
            <Icone nome="voltar" cor={cores.textoSobreEscuro} tamanho={20} espessura={2.2} />
          </Pressable>
        ) : null}
        <View style={styles.textos}>
          <Text style={styles.titulo} numberOfLines={1}>
            {titulo}
          </Text>
          {subtitulo ? (
            <Text style={styles.subtitulo} numberOfLines={2}>
              {subtitulo}
            </Text>
          ) : null}
        </View>
        {direita}
      </View>
      {progresso ? (
        <View style={styles.progresso} accessibilityRole="progressbar" accessibilityLabel={`Passo ${progresso.filter(Boolean).length} de ${progresso.length}`}>
          {progresso.map((feito, i) => (
            <View key={i} style={[styles.traco, feito ? styles.tracoFeito : styles.tracoFalta]} />
          ))}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  topo: { backgroundColor: cores.mata, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingHorizontal: MARGEM_TELA, paddingBottom: 20, gap: 14 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  voltar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(241,242,236,0.35)', alignItems: 'center', justifyContent: 'center' },
  progresso: { flexDirection: 'row', gap: 6 },
  traco: { flex: 1, height: 6, borderRadius: 3 },
  tracoFeito: { backgroundColor: cores.milho },
  tracoFalta: { borderWidth: 1.5, borderColor: 'rgba(241,242,236,0.4)', borderStyle: 'dashed' },
  textos: { flex: 1, gap: 2 },
  titulo: { fontFamily: fontes.titulo, fontSize: 34, lineHeight: 38, color: cores.textoSobreEscuro },
  subtitulo: { fontFamily: fontes.italico, fontSize: 15, lineHeight: 20, color: cores.suaveSobreEscuro },
});
