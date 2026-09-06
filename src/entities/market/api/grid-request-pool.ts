const MAX_CONCURRENT_GRID_REQUESTS = 5;
let activeRequests = 0;
const queue: Array<() => void> = [];

function startNext() {
  while (activeRequests < MAX_CONCURRENT_GRID_REQUESTS && queue.length > 0) queue.shift()?.();
}

export function runGridRequest<T>(signal: AbortSignal, request: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      if (signal.aborted) {
        reject(signal.reason);
        startNext();
        return;
      }
      activeRequests += 1;
      void request()
        .then(resolve, reject)
        .finally(() => {
          activeRequests -= 1;
          startNext();
        });
    };
    queue.push(start);
    startNext();
  });
}
