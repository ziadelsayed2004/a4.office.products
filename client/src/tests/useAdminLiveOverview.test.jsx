import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminLiveOverview } from '../hooks/useAdminLiveOverview.js';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  openAuthorizedStream: vi.fn(),
}));

vi.mock('../services/apiClient.js', () => ({
  api: { get: mocks.get },
  openAuthorizedStream: mocks.openAuthorizedStream,
}));

let visibility = 'visible';
let originalVisibilityDescriptor;

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useAdminLiveOverview fallback lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = 'visible';
    originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
    mocks.get.mockResolvedValue({
      data: { generatedAt: '2026-07-15T10:00:00.000Z', netSales: 1000 },
    });
    mocks.openAuthorizedStream.mockRejectedValue(new Error('SSE unavailable'));
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalVisibilityDescriptor) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityDescriptor);
    } else {
      delete document.visibilityState;
    }
  });

  it('polls after SSE failure, pauses while hidden, then resyncs and reconnects when visible', async () => {
    const { result, unmount } = renderHook(() => useAdminLiveOverview());
    await flushPromises();

    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenLastCalledWith('/api/admin/live-overview');
    expect(mocks.openAuthorizedStream).toHaveBeenCalledTimes(1);
    expect(result.current.connection).toBe('fallback');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_999);
    });
    expect(mocks.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mocks.get).toHaveBeenCalledTimes(2);

    const lastVisibleSignal = mocks.openAuthorizedStream.mock.calls.at(-1)[1].signal;
    visibility = 'hidden';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(lastVisibleSignal.aborted).toBe(true);
    expect(result.current.connection).toBe('paused');

    const hiddenGetCount = mocks.get.mock.calls.length;
    const hiddenStreamCount = mocks.openAuthorizedStream.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(mocks.get).toHaveBeenCalledTimes(hiddenGetCount);
    expect(mocks.openAuthorizedStream).toHaveBeenCalledTimes(hiddenStreamCount);

    visibility = 'visible';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await flushPromises();

    expect(mocks.get).toHaveBeenCalledTimes(hiddenGetCount + 1);
    expect(mocks.openAuthorizedStream).toHaveBeenCalledTimes(hiddenStreamCount + 1);
    const resumedSignal = mocks.openAuthorizedStream.mock.calls.at(-1)[1].signal;
    expect(resumedSignal).not.toBe(lastVisibleSignal);
    expect(resumedSignal.aborted).toBe(false);
    expect(result.current.connection).toBe('fallback');

    unmount();
    expect(resumedSignal.aborted).toBe(true);
  });
});
