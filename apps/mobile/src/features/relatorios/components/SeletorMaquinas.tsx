import type { Maquina } from '@talhio/shared';
import { memo, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMaquinas } from '@/features/maquinas';
import { Icone } from '@/shared/components/Icone';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

type Props = {
  /** Ids das máquinas escolhidas; vazio = todas. */
  escolhidas: string[];
  aoMudar: (ids: string[]) => void;
};

/** A partir de quantas máquinas a lista ganha o campo de busca. */
const BUSCA_A_PARTIR_DE = 8;
/** Ativa = trabalhando agora, com o motor ligado, ou que já trabalhou hoje. Guardada ou sem sinal fica por último. */
const ativa = (m: Maquina) => m.status === 'trabalhando' || m.motorLigado || m.horasHoje > 0;
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Uma linha só na tela ("Máquinas · Todas") que abre a lista para marcar. Aguenta fazenda com muitas
 * máquinas: lista rolável com busca, e a escolha só vale ao tocar em "Ver relatório".
 */
export const SeletorMaquinas = memo(function SeletorMaquinas({ escolhidas, aoMudar }: Props) {
  const { maquinas } = useMaquinas();
  const [aberto, setAberto] = useState(false);
  // Com uma máquina só (ou nenhuma) não há o que escolher.
  if (maquinas.length < 2) return null;
  const marcadas = maquinas.filter((m) => escolhidas.includes(m.id));
  const resumo = marcadas.length === 0 ? 'Todas' : marcadas.length === 1 ? marcadas[0]!.nome : `${marcadas.length} máquinas`;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Máquinas do relatório: ${resumo}. Toque para escolher`} onPress={() => setAberto(true)} style={styles.linha}>
        <Icone nome={marcadas.length === 1 ? marcadas[0]!.tipo : 'trator'} cor={cores.mata} tamanho={22} espessura={2} />
        <Text style={styles.rotulo}>Máquinas</Text>
        <Text style={styles.valor} numberOfLines={1}>
          {resumo}
        </Text>
        <View style={styles.seta}>
          <Icone nome="voltar" cor={cores.textoSuave} tamanho={18} espessura={2.2} />
        </View>
      </Pressable>
      <Modal visible={aberto} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAberto(false)}>
        {aberto ? (
          <Lista
            maquinas={maquinas}
            iniciais={escolhidas}
            aoFechar={() => setAberto(false)}
            aoAplicar={(ids) => {
              aoMudar(ids);
              setAberto(false);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
});

function Lista({ maquinas, iniciais, aoFechar, aoAplicar }: { maquinas: Maquina[]; iniciais: string[]; aoFechar: () => void; aoAplicar: (ids: string[]) => void }) {
  const margens = useSafeAreaInsets();
  const [marcadas, setMarcadas] = useState<string[]>(iniciais);
  const [busca, setBusca] = useState('');
  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    const achadas = termo ? maquinas.filter((m) => semAcento(`${m.nome} ${m.modelo ?? ''}`).includes(termo)) : maquinas;
    // As ativas primeiro; dentro de cada grupo, por nome.
    return [...achadas].sort((a, b) => Number(ativa(b)) - Number(ativa(a)) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [maquinas, busca]);
  const ativas = maquinas.filter(ativa);
  const alternar = (id: string) => setMarcadas((atuais) => (atuais.includes(id) ? atuais.filter((e) => e !== id) : [...atuais, id]));
  const todas = marcadas.length === 0 || marcadas.length === maquinas.length;

  return (
    <View style={[styles.folha, { paddingBottom: Math.max(margens.bottom, 16) }]}>
      <View style={styles.topo}>
        <Text style={styles.titulo}>Máquinas do relatório</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10} onPress={aoFechar} style={styles.fechar}>
          <Icone nome="fechar" cor={cores.texto} tamanho={20} espessura={2.2} />
        </Pressable>
      </View>

      {maquinas.length >= BUSCA_A_PARTIR_DE ? (
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar máquina"
          placeholderTextColor={cores.textoSuave}
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Buscar máquina"
          style={styles.busca}
        />
      ) : null}

      {ativas.length > 0 && ativas.length < maquinas.length ? (
        <Pressable accessibilityRole="button" onPress={() => setMarcadas(ativas.map((m) => m.id))} style={styles.atalho}>
          <View style={styles.ponto} />
          <Text style={styles.atalhoTexto}>{ativas.length === 1 ? 'Marcar a máquina ativa hoje' : `Marcar as ${ativas.length} ativas hoje`}</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={visiveis}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.itens}
        ListHeaderComponent={busca.trim() ? undefined : <Item rotulo="Todas as máquinas" marcado={todas} aoTocar={() => setMarcadas([])} />}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhuma máquina com esse nome.</Text>}
        renderItem={({ item }) => <Item rotulo={item.nome} tipo={item.tipo} ativa={ativa(item)} marcado={!todas && marcadas.includes(item.id)} aoTocar={() => alternar(item.id)} />}
      />

      <Pressable accessibilityRole="button" onPress={() => aoAplicar(todas ? [] : marcadas)} style={styles.botao}>
        <Text style={styles.botaoTexto}>{todas ? 'Ver relatório de todas' : marcadas.length === 1 ? 'Ver relatório de 1 máquina' : `Ver relatório de ${marcadas.length} máquinas`}</Text>
      </Pressable>
    </View>
  );
}

/** O ícone tem o mesmo nome do tipo da máquina: trator, colheitadeira ou pulverizador. */
const Item = memo(function Item({ rotulo, tipo, marcado, ativa: estaAtiva, aoTocar }: { rotulo: string; tipo?: Maquina['tipo']; marcado: boolean; ativa?: boolean; aoTocar: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: marcado }} onPress={aoTocar} style={styles.item}>
      <View style={[styles.caixa, marcado && styles.caixaMarcada]}>{marcado ? <Icone nome="confere" cor={cores.sobreMilho} tamanho={16} espessura={3} /> : null}</View>
      {tipo ? <Icone nome={tipo} cor={marcado ? cores.mata : cores.textoSuave} tamanho={24} espessura={1.8} /> : null}
      <Text style={[styles.itemTexto, marcado && styles.itemTextoMarcado]} numberOfLines={1}>
        {rotulo}
      </Text>
      {estaAtiva ? (
        <View style={styles.ativa}>
          <View style={styles.ponto} />
          <Text style={styles.ativaTexto}>ativa</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  linha: { marginHorizontal: MARGEM_TELA, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, borderRadius: 26, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.cartao },
  rotulo: { fontFamily: fontes.rotulo, fontSize: 15, color: cores.textoSuave },
  seta: { transform: [{ rotate: '-90deg' }] },
  valor: { flex: 1, textAlign: 'right', fontFamily: fontes.rotulo, fontSize: 16, color: cores.texto },

  folha: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: MARGEM_TELA, paddingTop: 20, gap: 14 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { flex: 1, fontFamily: fontes.titulo, fontSize: 24, lineHeight: 28, color: cores.texto },
  fechar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda },
  busca: { minHeight: 50, borderRadius: 25, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.cartao, paddingHorizontal: 18, fontFamily: fontes.medio, fontSize: 16, color: cores.texto },
  itens: { paddingBottom: 8 },
  item: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: cores.divisor },
  caixa: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: cores.bordaForte, alignItems: 'center', justifyContent: 'center' },
  caixaMarcada: { backgroundColor: cores.milho, borderColor: cores.milho },
  itemTexto: { flex: 1, fontFamily: fontes.medio, fontSize: 17, color: cores.textoMedio },
  itemTextoMarcado: { fontFamily: fontes.rotulo, color: cores.texto },
  ativa: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ativaTexto: { fontFamily: fontes.medio, fontSize: 13, color: cores.online },
  ponto: { width: 9, height: 9, borderRadius: 5, backgroundColor: cores.online },
  atalho: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 22, backgroundColor: cores.primarioSuave },
  atalhoTexto: { fontFamily: fontes.rotulo, fontSize: 15, color: cores.textoSobreSuave },
  vazio: { paddingVertical: 24, textAlign: 'center', fontFamily: fontes.regular, fontSize: 15, color: cores.textoSuave },
  botao: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.milho },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.sobreMilho },
});
