import { EventEmitter } from 'node:events';

const emitter = new EventEmitter();
emitter.setMaxListeners(250);

let nextEventId = 1;

function reportListenerFailure(error) {
  try {
    console.error('Live event listener failed:', error?.message || error);
  } catch {
    // Logging is best-effort too; it cannot affect a committed operation.
  }
}

/**
 * Publishes a lightweight invalidation after a business transaction commits.
 * The overview endpoint remains the source of truth; event payloads are hints.
 */
export function publishLiveEvent(type, payload = {}) {
  const event = {
    id: nextEventId,
    type: String(type || 'data.changed'),
    occurredAt: new Date().toISOString(),
    payload: payload && typeof payload === 'object' ? payload : {},
  };
  nextEventId += 1;
  // Live invalidation is deliberately best-effort. These events are emitted
  // after business transactions commit, so a disconnected SSE response (or
  // any other faulty listener) must never turn a successful financial write
  // into an HTTP 500 response.
  for (const listener of emitter.listeners('invalidation')) {
    try {
      const outcome = listener(event);
      if (outcome && typeof outcome.then === 'function') {
        Promise.resolve(outcome).catch(reportListenerFailure);
      }
    } catch (error) {
      reportListenerFailure(error);
    }
  }
  return event;
}

export function subscribeToLiveEvents(listener) {
  emitter.on('invalidation', listener);
  return () => emitter.off('invalidation', listener);
}

export function liveEventListenerCount() {
  return emitter.listenerCount('invalidation');
}
