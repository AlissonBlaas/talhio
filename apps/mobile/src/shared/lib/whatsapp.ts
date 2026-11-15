import { Linking, Share } from 'react-native';

/** Abre o WhatsApp com o texto pronto; se não houver WhatsApp, abre o compartilhar do aparelho. */
export async function enviarPorWhatsApp(texto: string): Promise<void> {
  try {
    await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(texto)}`);
  } catch {
    await Share.share({ message: texto }).catch(() => undefined);
  }
}
