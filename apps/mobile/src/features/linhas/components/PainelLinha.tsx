import type { Linha } from '@talhio/shared';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cores, fontes } from '@/shared/theme/tokens';

type Props = {
  completa: boolean;
  direcao: number | null;
  larguraM: number;
  quantidadePassadas: number;
  linhasPadrao: Linha[];
  nome: string;
  aoMudarNome: (nome: string) => void;
  comoPadrao: boolean;
  aoAlternarPadrao: () => void;
  erro: string | null;
  salvando: boolean;
  confirmacao: string | null;
  aoUsarPadrao: (linha: Linha) => void;
  aoUsarBorda: () => void;
  aoRefazer: () => void;
  aoSalvar: () => void;
  aoConcluir: () => void;
  rotuloConcluir: string;
};

const graus = (valor: number) => `${Math.round(valor)}°`;

export function PainelLinha(props: Props) {
  const { bottom } = useSafeAreaInsets();
  const salva = props.confirmacao !== null;

  return (
    <View style={[styles.painel, { paddingBottom: Math.max(bottom, 22) + 8 }]}>
      <View style={styles.alca} />
      <Text style={styles.titulo}>Linha AB do piloto automático</Text>

      {props.completa ? (
        <View style={styles.bloco}>
          <View style={styles.dados}>
            <Dado rotulo="Direção" valor={props.direcao === null ? '—' : graus(props.direcao)} />
            <Dado rotulo="Largura" valor={`${props.larguraM} m`} />
            <Dado rotulo="Passadas" valor={`~${props.quantidadePassadas}`} />
          </View>
          <View style={styles.campo}>
            <Text style={styles.campoRotulo}>Nome da linha</Text>
            <TextInput
              value={props.nome}
              onChangeText={props.aoMudarNome}
              editable={!salva && !props.salvando}
              returnKeyType="done"
              maxLength={60}
              style={[styles.entrada, { borderColor: props.erro ? cores.erroBorda : cores.campoBorda }]}
            />
            {props.erro ? <Text style={styles.erro}>{props.erro}</Text> : null}
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: props.comoPadrao, disabled: salva }}
            disabled={salva || props.salvando}
            onPress={props.aoAlternarPadrao}
            style={styles.opcao}>
            <View style={[styles.caixa, props.comoPadrao && styles.caixaMarcada]}>
              {props.comoPadrao ? <Text style={styles.caixaSinal}>✓</Text> : null}
            </View>
            <Text style={styles.opcaoTexto}>Salvar como linha padrão da fazenda (usar em outros talhões)</Text>
          </Pressable>
          {props.confirmacao ? (
            <View style={styles.confirmacao}>
              <Text style={styles.confirmacaoTexto}>{props.confirmacao}</Text>
            </View>
          ) : null}
          {salva ? (
            <Pressable accessibilityRole="button" onPress={props.aoConcluir} style={[styles.botao, styles.primario]}>
              <Text style={[styles.botaoTexto, { color: cores.sobreMilho }]}>{props.rotuloConcluir}</Text>
            </Pressable>
          ) : (
            <View style={styles.botoes}>
              <Pressable accessibilityRole="button" disabled={props.salvando} onPress={props.aoRefazer} style={[styles.botao, styles.secundario]}>
                <Text style={[styles.botaoTexto, { color: cores.texto }]}>Refazer</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={props.salvando} onPress={props.aoSalvar} style={[styles.botao, styles.salvar, styles.primario]}>
                <Text style={[styles.botaoTexto, { color: cores.sobreMilho }]}>{props.salvando ? 'Salvando…' : 'Salvar e enviar'}</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.bloco}>
          {props.linhasPadrao.length > 0 ? (
            <View style={styles.padroes}>
              <Text style={styles.secao}>Linhas salvas da fazenda</Text>
              {props.linhasPadrao.map((linha) => (
                <Pressable key={linha.id} accessibilityRole="button" onPress={() => props.aoUsarPadrao(linha)} style={styles.padrao}>
                  <View style={styles.padraoIcone}>
                    <View style={[styles.padraoTraco, { transform: [{ rotate: `${linha.direcaoGraus}deg` }] }]} />
                  </View>
                  <View style={styles.padraoTextos}>
                    <Text style={styles.padraoNome} numberOfLines={1}>
                      {linha.nome}
                    </Text>
                    <Text style={styles.padraoDetalhe}>Reta · {graus(linha.direcaoGraus)}</Text>
                  </View>
                  <Text style={styles.usar}>Usar</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={styles.ou}>ou toque no mapa para marcar os pontos A e B</Text>
          <Pressable accessibilityRole="button" onPress={props.aoUsarBorda} style={[styles.botao, styles.secundario, styles.borda]}>
            <Text style={[styles.botaoTexto, { color: cores.texto }]}>Usar a borda mais comprida do talhão</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.dado}>
      <Text style={styles.dadoRotulo}>{rotulo}</Text>
      <Text style={styles.dadoValor}>{valor}</Text>
    </View>
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
  titulo: { fontFamily: fontes.titulo, fontSize: 18, lineHeight: 19, color: cores.texto },
  bloco: { gap: 12 },
  secao: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 16, color: cores.texto },
  padroes: { gap: 8 },
  padrao: {
    height: 52,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: cores.bordaForte,
    backgroundColor: cores.cartao,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  padraoIcone: { width: 32, height: 32, borderRadius: 10, backgroundColor: cores.sucessoFundo, alignItems: 'center', justifyContent: 'center' },
  padraoTraco: { width: 2.5, height: 18, borderRadius: 2, backgroundColor: cores.sucesso },
  padraoTextos: { flex: 1, gap: 1 },
  padraoNome: { fontFamily: fontes.semi, fontSize: 14, lineHeight: 17, color: cores.texto },
  padraoDetalhe: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.textoSuave },
  usar: { fontFamily: fontes.semi, fontSize: 13, color: cores.primario },
  ou: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.textoSuave, textAlign: 'center' },
  borda: { height: 48 },
  dados: { flexDirection: 'row', gap: 8 },
  dado: { flex: 1, backgroundColor: cores.fundo, borderRadius: 22, padding: 10, gap: 2 },
  dadoRotulo: { fontFamily: fontes.regular, fontSize: 11, lineHeight: 14, color: cores.textoSuave },
  dadoValor: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 19, color: cores.texto },
  campo: { gap: 6 },
  campoRotulo: { fontFamily: fontes.medio, fontSize: 13, lineHeight: 16, color: cores.textoMedio },
  entrada: {
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: cores.campoFundo,
    fontFamily: fontes.medio,
    fontSize: 15,
    color: cores.texto,
  },
  erro: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.perigo },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  caixa: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: cores.semSinal, alignItems: 'center', justifyContent: 'center' },
  caixaMarcada: { backgroundColor: cores.milho, borderColor: cores.milho },
  caixaSinal: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 16, color: cores.sobreMilho },
  opcaoTexto: { flex: 1, fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.dicaTexto },
  confirmacao: { backgroundColor: cores.sucessoFundo, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 12 },
  confirmacaoTexto: { fontFamily: fontes.medio, fontSize: 13, lineHeight: 18, color: cores.sucesso },
  botoes: { flexDirection: 'row', gap: 8 },
  botao: { height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  botaoTexto: { fontFamily: fontes.semi, fontSize: 14 },
  secundario: { flex: 1, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.bordaForte },
  salvar: { flex: 2 },
  primario: { backgroundColor: cores.milho },
});
