import { useEffect, useRef } from 'react';

function editableTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}

export function useScannerCapture({ onScan, disabled = false, restoreFocusRef, maxGapMs = 70, duplicateMs = 1200 }) {
  const state = useRef({ buffer: '', lastKeyAt: 0, lastCode: '', lastScanAt: 0 });
  const callback = useRef(onScan);
  callback.current = onScan;

  useEffect(() => {
    if (disabled) return undefined;
    const onKeyDown = async (event) => {
      if (event.ctrlKey || event.altKey || event.metaKey || editableTarget(event.target)) return;
      const now = performance.now();
      const current = state.current;
      if (event.key === 'Enter') {
        const code = current.buffer.trim();
        current.buffer = '';
        if (code.length < 3) return;
        event.preventDefault();
        if (code === current.lastCode && now - current.lastScanAt < duplicateMs) return;
        current.lastCode = code;
        current.lastScanAt = now;
        try {
          await callback.current(code);
        } finally {
          requestAnimationFrame(() => restoreFocusRef?.current?.focus?.());
        }
        return;
      }
      if (event.key.length !== 1) return;
      if (now - current.lastKeyAt > maxGapMs) current.buffer = '';
      current.buffer += event.key;
      current.lastKeyAt = now;
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [disabled, duplicateMs, maxGapMs, restoreFocusRef]);
}
