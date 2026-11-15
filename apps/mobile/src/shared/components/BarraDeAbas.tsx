import { TabList, TabSlot, TabTrigger, Tabs, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ALTURA_BARRA, cores, fontes } from '@/shared/theme/tokens';

import { Icone, type NomeIcone } from './Icone';

/** Espaço que cada tela reserva embaixo para a barra de abas. */
export function useAlturaDaBarra(): number {
  const { bottom } = useSafeAreaInsets();
  return ALTURA_BARRA + Math.max(bottom, 22);
}

export function AbasDoApp() {
  return (
    <Tabs>
      <TabSlot style={styles.conteudo} />
      <TabList asChild>
        <Barra>
          <TabTrigger name="inicio" href="/" asChild>
            <Aba icone="inicio" rotulo="Início" />
          </TabTrigger>
          <TabTrigger name="maquinas" href="/maquinas" asChild>
            <Aba icone="trator" rotulo="Máquinas" />
          </TabTrigger>
          <TabTrigger name="assistente" href="/assistente" asChild>
            <Aba icone="ia" rotulo="IA" />
          </TabTrigger>
          <TabTrigger name="relatorios" href="/relatorios" asChild>
            <Aba icone="grafico" rotulo="Relatórios" />
          </TabTrigger>
          <TabTrigger name="escala" href="/escala" asChild>
            <Aba icone="calendario" rotulo="Escala" />
          </TabTrigger>
        </Barra>
      </TabList>
    </Tabs>
  );
}

function Barra(props: TabListProps) {
  const altura = useAlturaDaBarra();
  return <View {...props} style={[styles.barra, { height: altura, paddingBottom: altura - ALTURA_BARRA }]} />;
}

type AbaProps = TabTriggerSlotProps & { icone: NomeIcone; rotulo: string };

function Aba({ icone, rotulo, isFocused, ...props }: AbaProps) {
  const cor = isFocused ? cores.mata : cores.textoSuave;
  return (
    // O gatilho da aba injeta onPress e ref; os tipos do slot e do Pressable divergem só no ref.
    <Pressable {...(props as unknown as PressableProps)} accessibilityRole="tab" accessibilityState={{ selected: !!isFocused }} style={styles.aba}>
      <View style={[styles.indicador, isFocused && styles.indicadorAtivo]} />
      <Icone nome={icone} cor={cor} tamanho={22} espessura={isFocused ? 2.2 : 1.8} />
      <Text style={[styles.rotulo, { color: cor, fontFamily: isFocused ? fontes.rotulo : fontes.rotuloLeve }]}>{rotulo}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  conteudo: { height: '100%' },
  barra: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: cores.cartao,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: cores.borda,
    paddingTop: 6,
    paddingHorizontal: 6,
  },
  aba: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  indicador: { width: 28, height: 4, borderRadius: 2, backgroundColor: 'transparent', marginBottom: 3 },
  indicadorAtivo: { backgroundColor: cores.milho },
  rotulo: { fontSize: 12, lineHeight: 15 },
});
