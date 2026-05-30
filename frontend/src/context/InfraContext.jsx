import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { refreshInfra, getInfraStatus, getJenkinsJobStatuses } from '../services/api';

const InfraContext = createContext(null);

export function InfraProvider({ children }) {
  const [infraData, setInfraData] = useState(null);
  const [jenkinsJobs, setJenkinsJobs] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [infraResp, jenkinsResp] = await Promise.all([
        refreshInfra(),
        getJenkinsJobStatuses().catch(() => ({ data: null })),
      ]);
      setInfraData(infraResp.data);
      setJenkinsJobs(jenkinsResp.data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCurrent = useCallback(async () => {
    try {
      const [infraResp, jenkinsResp] = await Promise.all([
        getInfraStatus(),
        getJenkinsJobStatuses().catch(() => ({ data: null })),
      ]);
      setInfraData(infraResp.data);
      setJenkinsJobs(jenkinsResp.data);
      if (infraResp.data.timestamp) {
        setLastRefresh(new Date(infraResp.data.timestamp));
      }
    } catch {
      // no cached data yet
    }
  }, []);

  const value = useMemo(
    () => ({ infraData, jenkinsJobs, lastRefresh, loading, error, refresh, loadCurrent }),
    [infraData, jenkinsJobs, lastRefresh, loading, error, refresh, loadCurrent]
  );

  return <InfraContext.Provider value={value}>{children}</InfraContext.Provider>;
}

export function useInfra() {
  const ctx = useContext(InfraContext);
  if (!ctx) throw new Error('useInfra must be used within InfraProvider');
  return ctx;
}
