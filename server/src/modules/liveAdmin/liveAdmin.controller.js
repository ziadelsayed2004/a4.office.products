import db from '../../db/index.js';
import { getLiveOverview } from './liveAdmin.service.js';
import { subscribeToLiveEvents } from './liveEvents.js';

export async function getLiveOverviewController(req, res, next) {
  try {
    return res.status(200).json({ status: 'success', data: await getLiveOverview() });
  } catch (error) {
    return next(error);
  }
}

export function liveEventsController(req, res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let cleaned = false;
  let unsubscribe = () => {};
  let keepAlive;
  let sessionCheck;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(keepAlive);
    clearInterval(sessionCheck);
    unsubscribe();
  };
  const endConnection = () => {
    cleanup();
    if (res.writableEnded || res.destroyed) return;
    try {
      res.end();
    } catch {
      // A disconnected client is expected and must not escape the SSE handler.
    }
  };
  const safeWrite = (chunk) => {
    if (cleaned || res.writableEnded || res.destroyed) return false;
    try {
      res.write(chunk);
      return true;
    } catch {
      endConnection();
      return false;
    }
  };
  const send = (eventName, data, id = null) => {
    if (cleaned || res.writableEnded || res.destroyed) return false;
    const lines = [
      ...(id === null ? [] : [`id: ${id}\n`]),
      `event: ${eventName}\n`,
      `data: ${JSON.stringify(data)}\n\n`,
    ];
    return lines.every((line) => safeWrite(line));
  };
  if (!send('ready', { connectedAt: new Date().toISOString() })) {
    endConnection();
    return;
  }

  let validationInFlight = null;
  const revalidate = () => {
    if (cleaned) return Promise.resolve(false);
    if (validationInFlight) return validationInFlight;
    validationInFlight = db
      .get(
        `SELECT 1
           FROM sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.id = ? AND s.user_id = ?
            AND datetime(s.expires_at) > CURRENT_TIMESTAMP
            AND u.is_active = 1 AND u.role = 'Admin';`,
        [req.user.sessionId, req.user.id]
      )
      .then((active) => {
        if (!active) endConnection();
        return Boolean(active);
      })
      .catch(() => {
        endConnection();
        return false;
      })
      .finally(() => {
        validationInFlight = null;
      });
    return validationInFlight;
  };

  unsubscribe = subscribeToLiveEvents(async (event) => {
    if (await revalidate()) send('invalidate', event, event.id);
  });
  // Presence becomes stale because time passes, not because a database write
  // occurs. A periodic invalidation lets connected dashboards transition a
  // user to offline even when no sale/shift event happens in the meantime.
  keepAlive = setInterval(() => {
    if (!safeWrite(`: keep-alive ${Date.now()}\n\n`)) return;
    send('invalidate', { type: 'presence.tick', occurredAt: new Date().toISOString() });
  }, 20_000);
  keepAlive.unref?.();
  sessionCheck = setInterval(revalidate, 5_000);
  sessionCheck.unref?.();

  req.once('close', cleanup);
  res.once('close', cleanup);
  res.once('finish', cleanup);
}
