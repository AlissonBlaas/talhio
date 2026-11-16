import type { EscalaItem } from '@talhio/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { siglaTalhao } from '@/shared/lib/format';
import { cores, fontes } from '@/shared/theme/tokens';

import { ROTULO_DO_STATUS, rotuloDoTurno, turnoLivre, type MaquinaNaEscala as Maquina } from '../textos';

type Props = {
  maquina: Maquina;
  /** Tocar numa linha (um turno) abre a edição dela. */
  aoTocar: (item: EscalaItem) => void;
  /** Tocar em "Adicionar turno": abre a edição de um turno novo para esta máquina. */
  aoAdicionar: () => void;
};

/**
 * Uma máquina na escala: como ela está agora (operando, parada, inativa) e quem opera em cada turno.
 * Máquina com um operador o dia todo tem uma linha só; com turnos separados, uma linha por turno.
 */
export function MaquinaNaEscala({ maquina, aoTocar, aoAdicionar }: Props) {
  const comOperador = maquina.linhas.some((l) => l.operador);
  const podeAdicionar = comOperador && turnoLivre(maquina.linhas) !== null;
  return (
    <View style={styles.cartao}>
      <View style={styles.cabeca}>
        <View style={[styles.avatar, !comOperador && styles.avatarVazio]}>
          <Icone nome={maquina.tipo} cor={comOperador ? cores.sobreMilho : cores.neutro} tamanho={22} espessura={2} />
        </View>
        <View style={styles.titulos}>
          <Text style={styles.nome} numberOfLines={1}>
            {maquina.maquinaNome}
          </Text>
          {maquina.implemento ? (
            <Text style={styles.implemento} numberOfLines={1}>
              {maquina.implemento}
            </Text>
          ) : null}
        </View>
        <View accessible accessibilityLabel={`Agora: ${ROTULO_DO_STATUS[maquina.status]}`} style={[styles.status, styles[`fundo_${maquina.status}`]]}>
          <View style={[styles.ponto, styles[`ponto_${maquina.status}`]]} />
          <Text style={[styles.statusTexto, styles[`texto_${maquina.status}`]]}>{ROTULO_DO_STATUS[maquina.status]}</Text>
        </View>
      </View>

      {maquina.linhas.map((item) => {
        const estado = item.enviadaEm ? 'Enviada' : !item.operador || item.definida ? null : 'A confirmar';
        return (
          <Pressable
            key={item.turno}
            accessibilityRole="button"
            accessibilityLabel={`${rotuloDoTurno(item.turno)}: ${item.operador ?? 'sem operador'}. Toque para mudar.`}
            onPress={() => aoTocar(item)}
            style={({ pressed }) => [styles.linha, pressed && styles.apertado]}>
            <Text style={styles.turno}>{rotuloDoTurno(item.turno)}</Text>
            <View style={styles.meio}>
              <Text style={[styles.operador, !item.operador && styles.semOperador]} numberOfLines={1}>
                {item.operador ?? 'Escolher operador'}
              </Text>
              {item.operador && (item.tarefa || estado) ? (
                <Text style={styles.detalhe} numberOfLines={1}>
                  {[item.tarefa, estado].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
            {item.talhaoNome ? (
              <Text style={styles.talhao} numberOfLines={1}>
                {siglaTalhao(item.talhaoNome)}
              </Text>
            ) : null}
          </Pressable>
        );
      })}

      {podeAdicionar ? (
        <Pressable accessibilityRole="button" onPress={aoAdicionar} style={({ pressed }) => [styles.adicionar, pressed && styles.apertado]}>
          <Icone nome="mais" cor={cores.folha} tamanho={16} espessura={2.4} />
          <Text style={styles.adicionarTexto}>Adicionar turno</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 24, paddingVertical: 8, paddingHorizontal: 14 },
  cabeca: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  avatarVazio: { backgroundColor: cores.neutroFundo },
  titulos: { flex: 1, gap: 2, minWidth: 0 },
  nome: { fontFamily: fontes.rotulo, fontSize: 17, lineHeight: 21, color: cores.texto },
  implemento: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 16, color: cores.textoSuave },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  statusTexto: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 15 },
  fundo_trabalhando: { backgroundColor: cores.primarioSuave },
  ponto_trabalhando: { backgroundColor: cores.folha },
  texto_trabalhando: { color: cores.textoSobreSuave },
  fundo_parada: { backgroundColor: cores.alertaFundo },
  ponto_parada: { backgroundColor: cores.parada },
  texto_parada: { color: cores.alerta },
  'fundo_sem-sinal': { backgroundColor: cores.neutroFundo },
  'ponto_sem-sinal': { backgroundColor: cores.semSinalNoMapa },
  'texto_sem-sinal': { color: cores.neutro },
  linha: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: cores.borda },
  apertado: { opacity: 0.6 },
  turno: { width: 64, fontFamily: fontes.semi, fontSize: 13, lineHeight: 16, color: cores.textoMedio },
  meio: { flex: 1, gap: 1, minWidth: 0 },
  operador: { fontFamily: fontes.rotulo, fontSize: 15, lineHeight: 19, color: cores.texto },
  semOperador: { fontFamily: fontes.regular, color: cores.alerta },
  detalhe: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 16, color: cores.textoSuave },
  talhao: { maxWidth: 110, fontFamily: fontes.rotulo, fontSize: 13, lineHeight: 16, color: cores.texto, backgroundColor: cores.fundo, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden' },
  adicionar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: cores.borda },
  adicionarTexto: { fontFamily: fontes.semi, fontSize: 14, color: cores.folha },
});
