import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { refreshInfra, getJenkinsJobStatuses } from '../services/api';

const InfraContext = createContext(null);

export function InfraProvider({ children }) {
  const [infraData, setInfraData] = useState(null);
  const [jenkinsJobs, setJenkinsJobs] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshDurationMs, setRefreshDurationMs] = useState(null);
  const [error, setError] = useState(null);
  const startTimeRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    startTimeRef.current = performance.now();
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
    }
  }, []);

  const value = useMemo(
    () => ({ infraData, jenkinsJobs, lastRefresh, loading, refreshDurationMs, error, refresh }),
    [infraData, jenkinsJobs, lastRefresh, loading, refreshDurationMs, error, refresh]
  );

  return <InfraContext.Provider value={value}>{children}</InfraContext.Provider>;
}

export function useInfra() {
  const ctx = useContext(InfraContext);
  if (!ctx) throw new Error('useInfra must be used within InfraProvider');
  return ctx;
}
