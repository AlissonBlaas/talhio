import type { Maquina } from '@talhio/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

import { conexaoDe, detalheDaMaquina, textoDaConexao, type Conexao } from '../textos';

type Props = {
  maquinas: Maquina[];
  marcadas: string[];
  sugeridas: string[];
  aoAlternar: (maquinaId: string) => void;
};

const COR_DA_CONEXAO: Record<Conexao, string | null> = { online: cores.online, 'sem-sinal': cores.parada, 'sem-internet': null };

/** Máquinas que servem para a operação, para marcar quais recebem o plano. Sem internet não dá para marcar. */
export function MaquinasDoPlano({ maquinas, marcadas, sugeridas, aoAlternar }: Props) {
  return (
    <View style={styles.lista}>
      <View style={styles.legenda}>
        <Legenda conexao="online" rotulo="Online" />
        <Legenda conexao="sem-sinal" rotulo="Sem sinal agora" />
        <Legenda conexao="sem-internet" rotulo="Sem internet" />
      </View>
      {maquinas.map((maquina) => {
        const conexao = conexaoDe(maquina);
        const bloqueada = conexao === 'sem-internet';
        const marcada = !bloqueada && marcadas.includes(maquina.id);
        return (
          <Pressable
            key={maquina.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marcada, disabled: bloqueada }}
            disabled={bloqueada}
            onPress={() => aoAlternar(maquina.id)}
            style={[styles.linha, marcada && styles.linhaMarcada, bloqueada && styles.linhaBloqueada]}>
            <View style={[styles.caixa, marcada && styles.caixaMarcada, bloqueada && styles.caixaBloqueada]}>
              {marcada ? <Icone nome="confere" cor={cores.sobreMilho} tamanho={14} espessura={3} /> : null}
            </View>
            <View style={styles.textos}>
              <View style={styles.titulo}>
                <Text style={[styles.nome, bloqueada && styles.nomeBloqueado]} numberOfLines={1}>
                  {maquina.nome}
                </Text>
                {sugeridas.includes(maquina.id) ? <Text style={styles.sugerida}>Sugerida</Text> : null}
              </View>
              {detalheDaMaquina(maquina) ? <Text style={styles.detalhe}>{detalheDaMaquina(maquina)}</Text> : null}
              <View style={styles.conexao}>
                <Bolinha conexao={conexao} />
                <Text style={styles.conexaoTexto}>
                  {textoDaConexao(maquina)}
                  {conexao === 'sem-sinal' ? ' · chega quando ligar' : ''}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Bolinha({ conexao }: { conexao: Conexao }) {
  const cor = COR_DA_CONEXAO[conexao];
  return <View style={[styles.bolinha, cor ? { backgroundColor: cor } : styles.bolinhaVazia]} />;
}

function Legenda({ conexao, rotulo }: { conexao: Conexao; rotulo: string }) {
  return (
    <View style={styles.itemLegenda}>
      <Bolinha conexao={conexao} />
      <Text style={styles.legendaTexto}>{rotulo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { gap: 8 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 4 },
  itemLegenda: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendaTexto: { fontFamily: fontes.regular, fontSize: 11, lineHeight: 14, color: cores.textoSuave },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 22, borderWidth: 1, borderColor: cores.bordaForte, backgroundColor: cores.cartao },
  linhaMarcada: { borderColor: cores.primario, backgroundColor: cores.primarioSuave },
  linhaBloqueada: { borderStyle: 'dashed', backgroundColor: cores.campoFundo },
  caixa: { width: 22, height: 22, borderRadius: 7, marginTop: 1, borderWidth: 1.5, borderColor: cores.semSinal, backgroundColor: cores.cartao, alignItems: 'center', justifyContent: 'center' },
  caixaMarcada: { backgroundColor: cores.milho, borderColor: cores.milho },
  caixaBloqueada: { borderColor: cores.alca },
  textos: { flex: 1, gap: 3, minWidth: 0 },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nome: { flexShrink: 1, fontFamily: fontes.semi, fontSize: 15, lineHeight: 19, color: cores.texto },
  nomeBloqueado: { color: cores.semSinal },
  sugerida: { fontFamily: fontes.semi, fontSize: 11, lineHeight: 14, color: cores.sucesso, backgroundColor: cores.sucessoFundo, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6, overflow: 'hidden' },
  detalhe: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 16, color: cores.textoSuave },
  conexao: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  conexaoTexto: { flex: 1, fontFamily: fontes.medio, fontSize: 12, lineHeight: 16, color: cores.textoMedio },
  bolinha: { width: 8, height: 8, borderRadius: 4 },
  bolinhaVazia: { borderWidth: 1.5, borderColor: cores.semSinal },
});
