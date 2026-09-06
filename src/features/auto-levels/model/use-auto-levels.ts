import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  autoLevelIntervals,
  type AutoLevelInterval,
  type AutoLevelPoint,
  type AutoLevelSettings,
  type AutoLevelWorkerRequest,
  type AutoLevelWorkerResponse,
  type DetectedAutoLevel,
} from '../../../entities/auto-level';
import {
  useClosedCandleWindowQuery,
  useClosedCandleWindowSubscription,
  type Candle,
} from '../../../entities/market';
import { confirmedAutoLevelCandles } from './auto-level-data';
import { loadAutoLevelSettings, saveAutoLevelSettings } from './auto-level-settings-storage';

type UseAutoLevelsOptions = {
  symbol: string;
  displayedInterval: string;
  displayedCandles: Candle[];
  displayedLatestCandles: Candle[];
  displayedIncludesCurrentEnd?: boolean;
  displayedCanLoadOlder?: boolean;
};

const EMPTY_CANDLES: Candle[] = [];

const isEnabledLevel = (level: DetectedAutoLevel, settings: AutoLevelSettings) => {
  if (!settings.enabledDetectors[level.detector]) return false;
  if (level.kind === 'support') return settings.enabledTypes.support;
  if (level.kind === 'resistance') return settings.enabledTypes.resistance;
  return settings.enabledTypes.trend;
};

const mergeFrozen = (
  detected: DetectedAutoLevel[],
  frozen: Map<string, DetectedAutoLevel> | undefined,
  settings: AutoLevelSettings,
) => {
  const levels = new Map(
    detected.filter((level) => isEnabledLevel(level, settings)).map((level) => [level.id, level]),
  );
  if (!frozen || frozen.size === 0) return [...levels.values()];
  for (const level of frozen.values()) {
    if (isEnabledLevel(level, settings)) levels.set(level.id, level);
  }
  return [...levels.values()];
};

const sameCandleWindow = (left: Candle[], right: Candle[]) =>
  left.length === right.length &&
  left.every((candle, index) => candle.every((value, valueIndex) => value === right[index][valueIndex]));

export function useAutoLevels({
  symbol,
  displayedInterval,
  displayedCandles,
  displayedLatestCandles,
  displayedIncludesCurrentEnd = true,
  displayedCanLoadOlder = false,
}: UseAutoLevelsOptions) {
  const [settings, setSettings] = useState(loadAutoLevelSettings);
  const [detectedByScope, setDetectedByScope] = useState(() => new Map<string, DetectedAutoLevel[]>());
  const [frozenByScope, setFrozenByScope] = useState(() => new Map<string, Map<string, DetectedAutoLevel>>());
  const [closedByScope, setClosedByScope] = useState(() => new Map<string, Candle[]>());
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analysisInterval = autoLevelIntervals.includes(displayedInterval as AutoLevelInterval)
    ? (displayedInterval as AutoLevelInterval)
    : '1m';
  const effectiveSettings = useMemo(
    () => (settings.interval === analysisInterval ? settings : { ...settings, interval: analysisInterval }),
    [analysisInterval, settings],
  );
  const analysisHistorySize = Math.max(
    settings.enabledDetectors.breakout ? settings.historySize : 0,
    settings.enabledDetectors.extremum ? settings.extremumHistorySize : 0,
    1,
  );
  const usesDisplayedData = displayedInterval === analysisInterval && displayedIncludesCurrentEnd;
  const displayedWindowReady = displayedCandles.length > analysisHistorySize || !displayedCanLoadOlder;
  const loadsSeparateData = settings.enabled && !usesDisplayedData;
  const analysisWindow = useClosedCandleWindowQuery(
    symbol,
    analysisInterval,
    analysisHistorySize,
    loadsSeparateData,
  );
  useClosedCandleWindowSubscription(
    symbol,
    analysisInterval,
    analysisHistorySize,
    loadsSeparateData && analysisWindow.isSuccess && !analysisWindow.isFetching,
  );
  const sourceCandles = useMemo(() => {
    if (usesDisplayedData) return displayedWindowReady ? displayedCandles : EMPTY_CANDLES;
    return analysisWindow.isSuccess && !analysisWindow.isFetching
      ? (analysisWindow.data.candles ?? EMPTY_CANDLES)
      : EMPTY_CANDLES;
  }, [
    analysisWindow.data?.candles,
    analysisWindow.isFetching,
    analysisWindow.isSuccess,
    displayedCandles,
    displayedWindowReady,
    usesDisplayedData,
  ]);
  const sourceLatest = usesDisplayedData && displayedWindowReady ? displayedLatestCandles : EMPTY_CANDLES;
  const analysisCurrent =
    !usesDisplayedData && analysisWindow.isSuccess && !analysisWindow.isFetching
      ? analysisWindow.data.current
      : undefined;
  const sourceLatestRef = useRef(sourceLatest);
  const scope = `${symbol}:${analysisInterval}`;
  const analysisDataScope = `${scope}:${analysisHistorySize}`;
  const newestObservedOpenTime = Math.max(
    sourceCandles.at(-1)?.[0] ?? Number.NEGATIVE_INFINITY,
    sourceLatest.at(-1)?.[0] ?? analysisCurrent?.[0] ?? Number.NEGATIVE_INFINITY,
  );
  const latestCandidate = sourceLatest?.at(-1);
  const confirmedLatestCandle =
    latestCandidate && latestCandidate[0] < newestObservedOpenTime ? latestCandidate : sourceLatest?.at(-2);
  const closedCandles = useMemo(
    () => closedByScope.get(analysisDataScope) ?? EMPTY_CANDLES,
    [analysisDataScope, closedByScope],
  );
  const currentScopeRef = useRef(scope);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const latestRequestIdRef = useRef(0);
  const signatureRef = useRef('');
  const levels = useMemo(
    () =>
      settings.enabled
        ? mergeFrozen(detectedByScope.get(scope) ?? [], frozenByScope.get(scope), settings)
        : [],
    [detectedByScope, frozenByScope, scope, settings],
  );

  useEffect(() => saveAutoLevelSettings(settings), [settings]);

  useEffect(() => {
    sourceLatestRef.current = sourceLatest;
  }, [sourceLatest]);

  useEffect(() => {
    if (!settings.enabled || !Number.isFinite(newestObservedOpenTime)) return;
    const confirmedLatest = sourceLatestRef.current.filter(([openTime]) => openTime < newestObservedOpenTime);
    setClosedByScope((current) => {
      const previous = current.get(analysisDataScope) ?? [];
      const next = confirmedAutoLevelCandles(
        sourceCandles,
        confirmedLatest,
        newestObservedOpenTime,
        analysisHistorySize,
        previous,
      );
      if (sameCandleWindow(previous, next)) return current;
      return new Map([[analysisDataScope, next]]);
    });
  }, [
    confirmedLatestCandle,
    analysisDataScope,
    newestObservedOpenTime,
    settings.enabled,
    analysisHistorySize,
    sourceCandles,
  ]);

  useEffect(() => {
    currentScopeRef.current = scope;
  }, [scope]);

  useEffect(() => {
    if (!settings.enabled) return;
    signatureRef.current = '';
    const worker = new Worker(new URL('./auto-levels.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = ({ data }: MessageEvent<AutoLevelWorkerResponse>) => {
      if (data.requestId !== latestRequestIdRef.current) return;
      const isCurrentScope = data.scope === currentScopeRef.current;
      if (isCurrentScope) setIsCalculating(false);
      if ('error' in data) {
        if (isCurrentScope) setError(data.error);
        return;
      }
      if (isCurrentScope) setError(null);
      setDetectedByScope((current) => new Map(current).set(data.scope, data.levels));
    };
    worker.onerror = () => {
      setIsCalculating(false);
      setError('Не удалось рассчитать автоуровни');
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [settings.enabled]);

  useEffect(() => {
    if (!settings.enabled || !workerRef.current) return;
    const firstCandle = closedCandles[0];
    const lastCandle = closedCandles.at(-1);
    if (!firstCandle || !lastCandle) return;
    const detectorSettings = {
      historySize: effectiveSettings.historySize,
      minTouches: effectiveSettings.minTouches,
      deviationPercent: effectiveSettings.deviationPercent,
      nearPriceOnly: effectiveSettings.nearPriceOnly,
      maxDistancePercent: effectiveSettings.maxDistancePercent,
      enabledDetectors: effectiveSettings.enabledDetectors,
      extremumHistorySize: effectiveSettings.extremumHistorySize,
      extremumMinTouches: effectiveSettings.extremumMinTouches,
      extremumStrength: effectiveSettings.extremumStrength,
      extremumLimit: effectiveSettings.extremumLimit,
      showBrokenExtremums: effectiveSettings.showBrokenExtremums,
      enabledTypes: effectiveSettings.enabledTypes,
      hideWeak: effectiveSettings.hideWeak,
    };
    const finalCandleSignature = lastCandle.slice(0, 5).join(':');
    const signature = `${scope}:${firstCandle[0]}:${finalCandleSignature}:${closedCandles.length}:${JSON.stringify(detectorSettings)}`;
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    latestRequestIdRef.current = requestId;
    setIsCalculating(true);
    setError(null);
    const request: AutoLevelWorkerRequest = {
      requestId,
      scope,
      candles: closedCandles,
      settings: effectiveSettings,
    };
    workerRef.current.postMessage(request);
  }, [closedCandles, effectiveSettings, scope, settings.enabled]);

  const updateSettings = useCallback((patch: Partial<AutoLevelSettings>) => {
    if (patch.enabled === false) {
      requestIdRef.current += 1;
      latestRequestIdRef.current = requestIdRef.current;
      signatureRef.current = '';
      setDetectedByScope(new Map());
      setFrozenByScope(new Map());
      setClosedByScope(new Map());
      setError(null);
      setIsCalculating(false);
    }
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const toggleFrozen = useCallback(
    (id: string) => {
      const currentLevel = levels.find((level) => level.id === id);
      if (!currentLevel) return;
      setFrozenByScope((current) => {
        const next = new Map(current);
        const frozen = new Map(next.get(scope));
        if (currentLevel.frozen) frozen.delete(id);
        else frozen.set(id, { ...currentLevel, frozen: true });
        if (frozen.size > 0) next.set(scope, frozen);
        else next.delete(scope);
        return next;
      });
    },
    [levels, scope],
  );

  const editLevel = useCallback(
    (id: string, points: AutoLevelPoint[]) => {
      const currentLevel = levels.find((level) => level.id === id);
      if (!currentLevel || points.length === 0) return;
      setFrozenByScope((current) => {
        const next = new Map(current);
        const frozen = new Map(next.get(scope));
        frozen.set(id, {
          ...currentLevel,
          points,
          projectedPrice: points.at(-1)?.price ?? currentLevel.projectedPrice,
          frozen: true,
        });
        next.set(scope, frozen);
        return next;
      });
    },
    [levels, scope],
  );

  const deleteLevel = useCallback(
    (id: string) => {
      setDetectedByScope((current) => {
        const detected = current.get(scope);
        if (!detected?.some((level) => level.id === id)) return current;
        return new Map(current).set(
          scope,
          detected.filter((level) => level.id !== id),
        );
      });
      setFrozenByScope((current) => {
        const frozen = current.get(scope);
        if (!frozen?.has(id)) return current;
        const next = new Map(current);
        const nextFrozen = new Map(frozen);
        nextFrozen.delete(id);
        if (nextFrozen.size === 0) next.delete(scope);
        else next.set(scope, nextFrozen);
        return next;
      });
    },
    [scope],
  );

  return {
    settings: effectiveSettings,
    updateSettings,
    levels,
    isCalculating,
    error: loadsSeparateData && analysisWindow.isError ? 'Не удалось загрузить свечи для автоуровней' : error,
    toggleFrozen,
    editLevel,
    deleteLevel,
    analysisHistorySize,
    analysisUsesDisplayedInterval: analysisInterval === displayedInterval,
  };
}
