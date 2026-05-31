import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getIntents } from '../services/api';

const IntentsContext = createContext(null);

const POLL_INTERVAL_MS = 10_000;

export function IntentsProvider({ children }) {
  const [intents, setIntents] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const resp = await getIntents();
      setIntents(resp.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const value = useMemo(() => ({ intents, loading, reload: load }), [intents, loading, load]);

  return <IntentsContext.Provider value={value}>{children}</IntentsContext.Provider>;
}

export function useIntents() {
  const ctx = useContext(IntentsContext);
  if (!ctx) throw new Error('useIntents must be used within IntentsProvider');
  return ctx;
}
