import { Platform } from 'react-native';

export const filesSupported = Platform.OS === 'web';

/** Abre o seletor de arquivos do navegador. */
export function pickFiles(accept: string, multiple = true): Promise<File[]> {
  return new Promise(resolve => {
    if (!filesSupported) return resolve([]);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.oncancel = () => resolve([]);
    input.click();
  });
}

export const readAsText = (f: File): Promise<string> => f.text();

export function readAsBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (!filesSupported) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
