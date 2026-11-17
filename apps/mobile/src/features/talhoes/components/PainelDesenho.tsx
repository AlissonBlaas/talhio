import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cores, fontes } from '@/shared/theme/tokens';

type Props = {
  quantidadeCantos: number;
  areaHa: number;
  nome: string;
  aoMudarNome: (nome: string) => void;
  /** Mensagem de erro a mostrar sob o nome (validação ou resposta do servidor). */
  erro: string | null;
  salvando: boolean;
  /** Texto de confirmação quando o talhão já foi salvo. */
  confirmacao: string | null;
  /** Há um canto selecionado: o primeiro botão passa a remover esse canto. */
  cantoSelecionado: boolean;
  aoRemover: () => void;
  aoLimpar: () => void;
  aoSalvar: () => void;
  aoConcluir: () => void;
  aoDefinirLinha: () => void;
  /** Editando um talhão que já existe: muda os textos e oferece apagar. Ausente = talhão novo. */
  edicao?: { aoApagar: () => void; apagando: boolean };
};

// Área pequena aparece com duas casas: ao desenhar de perto, "0,0 ha" parece erro e a pessoa não vê a área crescer.
const area = (ha: number) => ha.toLocaleString('pt-BR', ha < 10 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function PainelDesenho(props: Props) {
  const { bottom } = useSafeAreaInsets();
  const { quantidadeCantos, confirmacao, salvando } = props;
  const pronto = quantidadeCantos >= 3;
  const salvo = confirmacao !== null;

  return (
    <View style={[styles.painel, { paddingBottom: Math.max(bottom, 22) + 8 }]}>
      <View style={styles.alca} />
      {pronto ? (
        <View style={styles.bloco}>
          <View style={styles.areaLinha}>
            <View style={styles.areaTextos}>
              <Text style={styles.rotuloPequeno}>Área calculada</Text>
              <Text style={styles.area}>{area(props.areaHa)} ha</Text>
            </View>
            <Text style={[styles.rotuloPequeno, styles.cantos]}>{quantidadeCantos} cantos</Text>
          </View>
          <View style={styles.campo}>
            <Text style={styles.campoRotulo}>Nome do talhão *</Text>
            <TextInput
              value={props.nome}
              onChangeText={props.aoMudarNome}
              editable={!salvo && !salvando}
              placeholder="Ex.: Talhão 10 ou Baixada"
              placeholderTextColor={cores.desabilitadoTexto}
              returnKeyType="done"
              maxLength={60}
              style={[styles.entrada, { borderColor: props.erro ? cores.erroBorda : cores.campoBorda }]}
            />
            {props.erro ? <Text style={styles.erro}>{props.erro}</Text> : null}
          </View>
          {confirmacao ? (
            <View style={styles.confirmacao}>
              <Text style={styles.confirmacaoTexto}>{confirmacao}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.introducao}>
          <Text style={styles.titulo}>{props.edicao ? 'Redesenhe o talhão' : 'Desenhe o novo talhão'}</Text>
          <Text style={styles.descricao}>
            Siga a divisão que aparece na imagem: toque em cada canto do talhão, na ordem. Para corrigir um canto, toque nele e depois no lugar certo.
          </Text>
        </View>
      )}

      {salvo ? (
        <View style={styles.botoes}>
          <Pressable accessibilityRole="button" onPress={props.aoConcluir} style={[styles.botao, styles.secundario]}>
            <Text style={[styles.botaoTexto, { color: cores.texto }]}>Ver no mapa</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={props.aoDefinirLinha} style={[styles.botao, styles.salvar, styles.primario]}>
            <Text style={[styles.botaoTexto, { color: cores.sobreMilho }]}>Definir a linha AB</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.botoes}>
          <Secundario rotulo={props.cantoSelecionado ? 'Remover' : 'Desfazer'} onPress={props.aoRemover} desabilitado={quantidadeCantos === 0 || salvando} />
          <Secundario rotulo="Limpar" onPress={props.aoLimpar} desabilitado={quantidadeCantos === 0 || salvando} />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !pronto || salvando }}
            disabled={!pronto || salvando}
            onPress={props.aoSalvar}
            style={[styles.botao, styles.salvar, pronto ? styles.primario : styles.desabilitado]}>
            <Text style={[styles.botaoTexto, { color: pronto ? cores.sobreMilho : cores.desabilitadoTexto }]}>
              {salvando ? 'Salvando…' : props.edicao ? 'Salvar alterações' : 'Salvar talhão'}
            </Text>
          </Pressable>
        </View>
      )}
      {props.edicao && !salvo ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: salvando || props.edicao.apagando }}
          disabled={salvando || props.edicao.apagando}
          onPress={props.edicao.aoApagar}
          style={styles.apagar}>
          <Text style={styles.apagarTexto}>{props.edicao.apagando ? 'Apagando…' : 'Apagar talhão'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Secundario({ rotulo, onPress, desabilitado }: { rotulo: string; onPress: () => void; desabilitado: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: desabilitado }}
      disabled={desabilitado}
      onPress={onPress}
      style={[styles.botao, styles.secundario, desabilitado && styles.apagado]}>
      <Text style={[styles.botaoTexto, { color: cores.texto }]}>{rotulo}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  painel: {
    backgroundColor: cores.cartao,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    gap: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  alca: { width: 40, height: 5, borderRadius: 3, backgroundColor: cores.alca, alignSelf: 'center' },
  introducao: { gap: 6, paddingBottom: 6 },
  titulo: { fontFamily: fontes.titulo, fontSize: 18, lineHeight: 19, color: cores.texto },
  descricao: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 19, color: cores.textoSuave },
  bloco: { gap: 12 },
  areaLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  areaTextos: { gap: 2 },
  rotuloPequeno: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.textoSuave },
  cantos: { paddingBottom: 6 },
  area: { fontFamily: fontes.titulo, fontSize: 30, lineHeight: 33, color: cores.texto },
  campo: { gap: 6 },
  campoRotulo: { fontFamily: fontes.medio, fontSize: 13, lineHeight: 16, color: cores.textoMedio },
  entrada: {
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: cores.campoFundo,
    fontFamily: fontes.medio,
    fontSize: 15,
    color: cores.texto,
  },
  erro: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.perigo },
  confirmacao: { backgroundColor: cores.sucessoFundo, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 12 },
  confirmacaoTexto: { fontFamily: fontes.medio, fontSize: 13, lineHeight: 18, color: cores.sucesso },
  botoes: { flexDirection: 'row', gap: 8 },
  botao: { height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  botaoTexto: { fontFamily: fontes.semi, fontSize: 14 },
  secundario: { flex: 1, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.bordaForte },
  apagado: { opacity: 0.45 },
  apagar: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -4 },
  apagarTexto: { fontFamily: fontes.semi, fontSize: 14, color: cores.perigo },
  salvar: { flex: 2 },
  primario: { backgroundColor: cores.milho },
  desabilitado: { backgroundColor: cores.desabilitado },
});
