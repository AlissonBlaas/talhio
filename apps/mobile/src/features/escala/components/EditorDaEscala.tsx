import type { DefinirEscala, EscalaItem, Talhao } from '@talhio/shared';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapaDoTalhao } from '@/features/talhoes';
import { Icone } from '@/shared/components/Icone';
import { Opcoes } from '@/shared/components/Opcoes';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

import { useFormularioDaEscala } from '../hooks/useFormularioDaEscala';
import { TAREFAS, TURNOS } from '../textos';

type Props = {
  item: EscalaItem;
  /** Nomes já usados na escala de hoje, como atalho. */
  operadores: string[];
  talhoes: Talhao[];
  salvando: boolean;
  erro: string | null;
  aoSalvar: (dados: DefinirEscala) => void;
  aoTirar: () => void;
  aoFechar: () => void;
};

/** Folha para escolher quem vai em uma máquina, o que faz, onde e em que turno. */
export function EditorDaEscala({ item, operadores, talhoes, salvando, erro, aoSalvar, aoTirar, aoFechar }: Props) {
  const { bottom } = useSafeAreaInsets();
  const form = useFormularioDaEscala(item);
  const talhao = talhoes.find((t) => t.id === form.talhaoId) ?? null;
  const salvar = () => {
    const dados = form.conferir();
    if (dados) aoSalvar(dados);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.tela}>
      <View style={styles.cabecalho}>
        <View style={styles.titulos}>
          <Text style={styles.titulo} numberOfLines={1}>
            {item.maquinaNome}
          </Text>
          {item.implemento ? <Text style={styles.subtitulo}>{item.implemento}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={aoFechar} style={styles.fechar}>
          <Icone nome="fechar" cor={cores.texto} tamanho={20} espessura={2} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.conteudo, { paddingBottom: Math.max(bottom, 16) + 16 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.campo}>
          <Text style={styles.rotulo}>Operador</Text>
          <TextInput
            value={form.operador}
            onChangeText={form.setOperador}
            placeholder="Nome de quem vai operar"
            placeholderTextColor={cores.desabilitadoTexto}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={40}
            returnKeyType="done"
            style={[styles.entrada, form.faltaOperador && styles.entradaErro]}
          />
          {form.faltaOperador ? <Text style={styles.erroCampo}>Escolha quem vai operar</Text> : null}
          {operadores.length > 0 ? (
            <Opcoes opcoes={operadores.map((nome) => ({ valor: nome, rotulo: nome }))} valor={operadores.find((nome) => nome === form.operador.trim())} aoEscolher={form.setOperador} />
          ) : null}
        </View>

        <View style={styles.campo}>
          <Text style={styles.rotulo}>O que vai fazer</Text>
          <TextInput
            value={form.tarefa}
            onChangeText={form.setTarefa}
            placeholder="Ex.: Plantio de soja"
            placeholderTextColor={cores.desabilitadoTexto}
            maxLength={40}
            returnKeyType="done"
            style={styles.entrada}
          />
          <Opcoes opcoes={TAREFAS.map((t) => ({ valor: t, rotulo: t }))} valor={TAREFAS.find((t) => t === form.tarefa.trim())} aoEscolher={form.setTarefa} />
        </View>

        <View style={styles.campo}>
          <Text style={styles.rotulo}>Talhão</Text>
          <Opcoes<string | null>
            opcoes={[{ valor: null, rotulo: 'Sem talhão' }, ...talhoes.map((t) => ({ valor: t.id, rotulo: t.nome }))]}
            valor={form.talhaoId}
            aoEscolher={form.setTalhaoId}
          />
          {/* O mapa mostra o talhão escolhido logo acima e troca junto com a escolha. */}
          {talhao ? <MapaDoTalhao talhao={talhao} /> : null}
        </View>

        <View style={styles.campo}>
          <Text style={styles.rotulo}>Turno</Text>
          <Opcoes opcoes={TURNOS} valor={form.turno} aoEscolher={form.setTurno} />
        </View>

        {erro ? (
          <Text accessibilityRole="alert" style={styles.erro}>
            {erro}
          </Text>
        ) : null}

        <Pressable accessibilityRole="button" disabled={salvando} onPress={salvar} style={[styles.botao, salvando && styles.botaoEsperando]}>
          <Text style={styles.botaoTexto}>{salvando ? 'Salvando...' : 'Salvar'}</Text>
        </Pressable>
        {item.definida ? (
          <Pressable accessibilityRole="button" disabled={salvando} onPress={aoTirar} style={styles.tirar}>
            <Text style={styles.tirarTexto}>Tirar da escala de hoje</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: MARGEM_TELA, paddingTop: 20, paddingBottom: 12 },
  titulos: { flex: 1, gap: 2 },
  titulo: { fontFamily: fontes.titulo, fontSize: 22, lineHeight: 25, color: cores.texto },
  subtitulo: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 16, color: cores.textoSuave },
  fechar: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.bordaForte, alignItems: 'center', justifyContent: 'center' },
  conteudo: { paddingHorizontal: MARGEM_TELA, paddingTop: 4, gap: 18 },
  campo: { gap: 8 },
  rotulo: { fontFamily: fontes.medio, fontSize: 13, lineHeight: 16, color: cores.textoMedio },
  entrada: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: cores.campoBorda, backgroundColor: cores.campoFundo, paddingHorizontal: 12, fontFamily: fontes.medio, fontSize: 15, color: cores.texto },
  entradaErro: { borderColor: cores.erroBorda },
  erroCampo: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.perigo },
  erro: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.perigoTexto, backgroundColor: cores.perigoFundo, borderWidth: 1, borderColor: cores.perigoBorda, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, overflow: 'hidden' },
  botao: { height: 52, borderRadius: 16, backgroundColor: cores.primario, alignItems: 'center', justifyContent: 'center' },
  botaoEsperando: { opacity: 0.6 },
  botaoTexto: { fontFamily: fontes.semi, fontSize: 15, color: cores.sobreEscuro },
  tirar: { height: 44, alignItems: 'center', justifyContent: 'center' },
  tirarTexto: { fontFamily: fontes.semi, fontSize: 14, color: cores.perigo },
});
