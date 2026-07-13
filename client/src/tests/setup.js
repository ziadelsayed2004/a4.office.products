import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});

if (!globalThis.matchMedia) {
  globalThis.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  });
}

globalThis.requestAnimationFrame ||= (callback) => setTimeout(callback, 0);
globalThis.cancelAnimationFrame ||= (id) => clearTimeout(id);
Element.prototype.scrollIntoView ||= () => {};

globalThis.ResizeObserver ||= class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
