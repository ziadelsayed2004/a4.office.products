import ar from './ar.json';

export function t(path, fallback = '') {
  return path.split('.').reduce((value, key) => value?.[key], ar) ?? (fallback || path);
}
