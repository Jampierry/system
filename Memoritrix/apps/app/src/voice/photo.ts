import { Platform } from 'react-native';

export type Photo = { base64: string; mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; uri: string };
const MAX_SIDE = 1280;

/** Web: abre o seletor/câmera do navegador e reduz a imagem (máx. 1280 px, JPEG) para caber no limite da API. */
function pickWeb(camera: boolean): Promise<Photo | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.setAttribute('capture', 'environment');
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      try {
        const bmp = await createImageBitmap(f);
        const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas');
        c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
        c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
        const uri = c.toDataURL('image/jpeg', 0.82);
        resolve({ base64: uri.split(',')[1], mime: 'image/jpeg', uri });
      } catch { resolve(null); }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

async function pickNative(camera: boolean): Promise<Photo | null> {
  const IP = require('expo-image-picker');
  const perm = camera ? await IP.requestCameraPermissionsAsync() : await IP.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(camera ? 'Permita o acesso à câmera nas configurações.' : 'Permita o acesso às fotos nas configurações.');
  const opts = { base64: true, quality: 0.6, mediaTypes: ['images'] as const };
  const r = camera ? await IP.launchCameraAsync(opts) : await IP.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.[0]?.base64) return null;
  const a = r.assets[0];
  return { base64: a.base64, mime: a.mimeType === 'image/png' ? 'image/png' : 'image/jpeg', uri: a.uri };
}

export const pickPhoto = (source: 'camera' | 'library'): Promise<Photo | null> =>
  Platform.OS === 'web' ? pickWeb(source === 'camera') : pickNative(source === 'camera');
