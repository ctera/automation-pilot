import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { refreshInfra, getInfraStatus } from '../services/api';

const InfraContext = createContext(null);

export function InfraProvider({ children }) {
  const [infraData, setInfraData] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await refreshInfra();
      setInfraData(resp.data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCurrent = useCallback(async () => {
    try {
      const resp = await getInfraStatus();
      setInfraData(resp.data);
      if (resp.data.timestamp) {
        setLastRefresh(new Date(resp.data.timestamp));
      }
    } catch {
      // no cached data yet
    }
  }, []);

  const value = useMemo(
    () => ({ infraData, lastRefresh, loading, error, refresh, loadCurrent }),
    [infraData, lastRefresh, loading, error, refresh, loadCurrent]
  );

  return <InfraContext.Provider value={value}>{children}</InfraContext.Provider>;
}

export function useInfra() {
  const ctx = useContext(InfraContext);
  if (!ctx) throw new Error('useInfra must be used within InfraProvider');
  return ctx;
}
