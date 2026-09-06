import { describe, expect, it, vi } from 'vitest';
import { runGridRequest } from './grid-request-pool';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('grid request pool', () => {
  it('runs at most five requests concurrently and starts the next queued request after cleanup', async () => {
    const tasks = Array.from({ length: 6 }, () => deferred<number>());
    const starts = tasks.map((task, index) => vi.fn(() => task.promise.then(() => index)));
    const requests = starts.map((request) => runGridRequest(new AbortController().signal, request));

    expect(starts.slice(0, 5).every((request) => request.mock.calls.length === 1)).toBe(true);
    expect(starts[5]).not.toHaveBeenCalled();
    tasks[0].resolve(0);
    await expect(requests[0]).resolves.toBe(0);
    expect(starts[5]).toHaveBeenCalledOnce();
    tasks.slice(1).forEach((task, index) => task.resolve(index + 1));

    await expect(Promise.all(requests)).resolves.toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('does not invoke a queued request that was aborted while waiting', async () => {
    const active = Array.from({ length: 5 }, () => deferred<void>());
    const activeRequests = active.map((task) =>
      runGridRequest(new AbortController().signal, () => task.promise),
    );
    const controller = new AbortController();
    const queuedRequest = vi.fn(() => Promise.resolve('unexpected'));
    const queued = runGridRequest(controller.signal, queuedRequest);

    controller.abort(new DOMException('Aborted', 'AbortError'));
    active[0].resolve();

    await expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    expect(queuedRequest).not.toHaveBeenCalled();
    active.slice(1).forEach((task) => task.resolve());
    await Promise.all(activeRequests);
  });
});
