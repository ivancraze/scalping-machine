/// <reference lib="webworker" />

import {
  detectAutoLevels,
  type AutoLevelWorkerRequest,
  type AutoLevelWorkerResponse,
} from '../../../entities/auto-level';

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = ({ data }: MessageEvent<AutoLevelWorkerRequest>) => {
  let response: AutoLevelWorkerResponse;
  try {
    response = {
      requestId: data.requestId,
      scope: data.scope,
      levels: detectAutoLevels(data.candles, data.settings),
    };
  } catch (error) {
    response = {
      requestId: data.requestId,
      scope: data.scope,
      error: error instanceof Error ? error.message : 'Не удалось рассчитать автоуровни',
    };
  }
  worker.postMessage(response);
};
