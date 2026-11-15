import type { StyleSpecification } from '@maplibre/maplibre-react-native';

/**
 * Imagem de satélite do mapa. O padrão é o serviço World Imagery da Esri, bom para desenvolvimento.
 * Antes de vender, confira a licença ou troque por um fornecedor contratado (ex.: MapTiler),
 * definindo EXPO_PUBLIC_SATELITE_TILES com a URL de tiles {z}/{x}/{y}.
 */
const TILES =
  process.env.EXPO_PUBLIC_SATELITE_TILES ??
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const ESTILO_SATELITE: StyleSpecification = {
  version: 8,
  sources: {
    satelite: {
      type: 'raster',
      tiles: [TILES],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagem: Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'satelite', type: 'raster', source: 'satelite' }],
};
