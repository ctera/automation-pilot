import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { refreshInfra, getJenkinsJobStatuses } from '../services/api';

const InfraContext = createContext(null);

const REFRESH_COOLDOWN_MS = 10_000;
const STORAGE_KEY = 'pilot_last_refresh_ts';

function getLastRefreshTs() {
  const val = sessionStorage.getItem(STORAGE_KEY);
  return val ? Number(val) : 0;
}

function setLastRefreshTs(ts) {
  sessionStorage.setItem(STORAGE_KEY, String(ts));
}

export function InfraProvider({ children }) {
  const [infraData, setInfraData] = useState(null);
  const [jenkinsJobs, setJenkinsJobs] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshStartedAt, setRefreshStartedAt] = useState(null);
  const [refreshDurationMs, setRefreshDurationMs] = useState(null);
  const [error, setError] = useState(null);
  const startTimeRef = useRef(null);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    const now = Date.now();
    if (inFlightRef.current || now - getLastRefreshTs() < REFRESH_COOLDOWN_MS) {
      return;
    }
    inFlightRef.current = true;
    setLastRefreshTs(now);
    setRefreshStartedAt(now);
    startTimeRef.current = performance.now();
    setLoading(true);
    setError(null);
    try {
      const [infraResult, jenkinsResult] = await Promise.allSettled([
        refreshInfra(),
        getJenkinsJobStatuses(),
      ]);
      if (infraResult.status === 'fulfilled') {
        setInfraData(infraResult.value.data);
        setLastRefresh(new Date());
      } else {
        setError(infraResult.reason?.response?.data?.detail || infraResult.reason?.message);
      }
      if (jenkinsResult.status === 'fulfilled') {
        setJenkinsJobs(jenkinsResult.value.data);
      }
    } finally {
      setRefreshDurationMs(Math.round(performance.now() - startTimeRef.current));
      setLoading(false);
      setRefreshStartedAt(null);
      inFlightRef.current = false;
    }
  }, []);

  const value = useMemo(
    () => ({
      infraData,
      jenkinsJobs,
      lastRefresh,
      loading,
      refreshStartedAt,
      refreshDurationMs,
      error,
      refresh,
    }),
    [infraData, jenkinsJobs, lastRefresh, loading, refreshStartedAt, refreshDurationMs, error, refresh]
  );

  return <InfraContext.Provider value={value}>{children}</InfraContext.Provider>;
}

export function useInfra() {
  const ctx = useContext(InfraContext);
  if (!ctx) throw new Error('useInfra must be used within InfraProvider');
  return ctx;
}
