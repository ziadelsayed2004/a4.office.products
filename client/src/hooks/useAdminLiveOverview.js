import { useCallback, useEffect, useRef, useState } from 'react';
import { api, openAuthorizedStream } from '../services/apiClient.js';

const FALLBACK_INTERVAL_MS = 15_000;
const MAX_RECONNECT_MS = 10_000;

function eventBlocks(buffer) {
  const normalized = buffer.replaceAll('\r\n', '\n');
  const blocks = normalized.split('\n\n');
  return { blocks: blocks.slice(0, -1), rest: blocks.at(-1) || '' };
}

function isInvalidation(block) {
  if (!block || block.startsWith(':')) return false;
  const lines = block.split('\n');
  const event = lines
    .find((line) => line.startsWith('event:'))
    ?.slice(6)
    .trim();
  return !event || event === 'invalidate' || event === 'dashboard.invalidate';
}

export function useAdminLiveOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState('connecting');
  const [lastUpdated, setLastUpdated] = useState(null);
  const requestSequence = useRef(0);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    const sequence = ++requestSequence.current;
    if (!quiet) setLoading(true);
    try {
      const response = await api.get('/api/admin/live-overview');
      if (sequence !== requestSequence.current) return;
      const next = response?.data || response || {};
      setData(next);
      setLastUpdated(next.generatedAt || new Date().toISOString());
      setError('');
    } catch (loadError) {
      if (sequence === requestSequence.current) setError(loadError.message);
    } finally {
      if (!quiet && sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    let controller = null;
    let reconnectTimer = null;
    let fallbackTimer = null;
    let refreshTimer = null;
    let reconnectDelay = 1_000;

    const clearTimers = () => {
      globalThis.clearTimeout?.(reconnectTimer);
      globalThis.clearTimeout?.(refreshTimer);
      globalThis.clearInterval?.(fallbackTimer);
      reconnectTimer = null;
      refreshTimer = null;
      fallbackTimer = null;
    };

    const scheduleRefresh = () => {
      globalThis.clearTimeout?.(refreshTimer);
      refreshTimer = globalThis.setTimeout?.(() => refresh({ quiet: true }), 150);
    };

    const startFallback = () => {
      if (fallbackTimer || stopped || document.visibilityState === 'hidden') return;
      fallbackTimer = globalThis.setInterval?.(
        () => refresh({ quiet: true }),
        FALLBACK_INTERVAL_MS
      );
    };

    const stopFallback = () => {
      globalThis.clearInterval?.(fallbackTimer);
      fallbackTimer = null;
    };

    const connect = async () => {
      if (stopped || document.visibilityState === 'hidden') return;
      controller?.abort();
      const streamController = new AbortController();
      controller = streamController;
      setConnection('connecting');
      try {
        const response = await openAuthorizedStream('/api/admin/live-events', {
          signal: streamController.signal,
          headers: { Accept: 'text/event-stream' },
        });
        if (!response.body) throw new Error('قناة التحديث غير متاحة.');
        setConnection('live');
        stopFallback();
        reconnectDelay = 1_000;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped && !streamController.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = eventBlocks(buffer);
          buffer = parsed.rest;
          if (parsed.blocks.some(isInvalidation)) scheduleRefresh();
        }
        if (!stopped && !streamController.signal.aborted) throw new Error('انقطع التحديث المباشر.');
      } catch (streamError) {
        if (stopped || streamController.signal.aborted) return;
        setConnection('fallback');
        setError((current) => current || streamError.message);
        startFallback();
        reconnectTimer = globalThis.setTimeout?.(connect, reconnectDelay);
        reconnectDelay = Math.min(MAX_RECONNECT_MS, reconnectDelay * 2);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        controller?.abort();
        clearTimers();
        setConnection('paused');
        return;
      }
      refresh({ quiet: true });
      connect();
    };

    refresh();
    connect();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stopped = true;
      controller?.abort();
      clearTimers();
      document.removeEventListener('visibilitychange', handleVisibility);
      requestSequence.current += 1;
    };
  }, [refresh]);

  return { data, loading, error, connection, lastUpdated, refresh };
}

export default useAdminLiveOverview;
