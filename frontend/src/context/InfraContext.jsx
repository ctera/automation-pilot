import { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { refreshInfra, getInfraStatus } from '../services/api';
import { useWebSocket } from '../services/websocket';

const InfraContext = createContext(null);

export function InfraProvider({ children }) {
  const [datastores, setDatastores] = useState(null);
  const [clusterUsagePercent, setClusterUsagePercent] = useState(null);
  const [hosts, setHosts] = useState(null);
  const [vmCounts, setVmCounts] = useState(null);
  const [jenkinsJobs, setJenkinsJobs] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStartedAt, setRefreshStartedAt] = useState(null);
  const [refreshDurationMs, setRefreshDurationMs] = useState(null);
  const [refreshProgress, setRefreshProgress] = useState({ total: 4, done: 0 });
  const [cooldownNotice, setCooldownNotice] = useState(null);
  const [error, setError] = useState(null);

  const { lastMessage } = useWebSocket();

  const applySnapshot = useCallback((data) => {
    if (!data) return;
    setDatastores(data.datastores || []);
    setClusterUsagePercent(data.cluster_usage_percent ?? null);
    setHosts(data.hosts || []);
    setVmCounts(data.vm_counts || []);
    setJenkinsJobs(data.jenkins_jobs || []);
  }, []);

  const loadCached = useCallback(async () => {
    try {
      const resp = await getInfraStatus();
      const { data, is_refreshing, last_refreshed_at } = resp.data;
      if (data) applySnapshot(data);
      setIsRefreshing(is_refreshing);
      if (last_refreshed_at) setLastRefreshedAt(new Date(last_refreshed_at));
    } catch {
      // ignore — will be populated on first refresh
    }
  }, [applySnapshot]);

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadCached();
    }
  }, [loadCached]);

  const dismissCooldownNotice = useCallback(() => setCooldownNotice(null), []);

  const refresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshStartedAt(Date.now());
    setRefreshDurationMs(null);
    setRefreshProgress({ total: 4, done: 0 });
    setCooldownNotice(null);
    setError(null);
    const t0 = performance.now();
    try {
      const resp = await refreshInfra();
      applySnapshot(resp.data);
      setLastRefreshedAt(new Date());
      setRefreshDurationMs(Math.round(performance.now() - t0));
    } catch (err) {
      if (err?.response?.status === 409) {
        const retryAfter = err.response?.data?.retry_after_seconds;
        setCooldownNotice(
          `Data was refreshed recently. Please wait ${retryAfter || 60} seconds before refreshing again.`
        );
        await loadCached();
      } else {
        setError(err?.response?.data?.detail || err?.message || 'Refresh failed');
      }
      setRefreshDurationMs(null);
    } finally {
      setIsRefreshing(false);
      setRefreshStartedAt(null);
    }
  }, [isRefreshing, applySnapshot, loadCached]);

  useEffect(() => {
    if (lastMessage?.type === 'infra_refreshed') {
      const ts = lastMessage.last_refreshed_at;
      if (ts) setLastRefreshedAt(new Date(ts));
      loadCached();
    } else if (lastMessage?.type === 'infra_refresh_progress') {
      setRefreshProgress({ total: lastMessage.total, done: lastMessage.done });
    }
  }, [lastMessage, loadCached]);

  const infraData = useMemo(() => {
    if (!datastores && !hosts && !vmCounts) return null;

    let state = 'unknown';
    if (datastores && hosts) {
      const storagePercent = clusterUsagePercent ?? 0;
      const maxCpu = Math.max(...(hosts || []).map((h) => h.cpu_percent).filter((v) => v >= 0), 0);

      const storageSaturated = storagePercent >= 85;
      const storageConstrained = storagePercent >= 70;
      const cpuSaturated = maxCpu >= 85;
      const cpuConstrained = maxCpu >= 75;

      if (storageSaturated || cpuSaturated) state = 'saturated';
      else if (storageConstrained || cpuConstrained) state = 'constrained';
      else state = 'ready';
    }

    return {
      state,
      datastores: datastores || [],
      cluster_usage_percent: clusterUsagePercent ?? 0,
      hosts: hosts || [],
      vm_counts: vmCounts || [],
    };
  }, [datastores, hosts, vmCounts, clusterUsagePercent]);

  const value = useMemo(
    () => ({
      infraData,
      datastores,
      clusterUsagePercent,
      hosts,
      vmCounts,
      jenkinsJobs,
      lastRefreshedAt,
      isRefreshing,
      refreshStartedAt,
      refreshDurationMs,
      refreshProgress,
      cooldownNotice,
      dismissCooldownNotice,
      loading: isRefreshing,
      error,
      refresh,
    }),
    [
      infraData, datastores, clusterUsagePercent, hosts, vmCounts,
      jenkinsJobs, lastRefreshedAt, isRefreshing, refreshStartedAt,
      refreshDurationMs, refreshProgress, cooldownNotice, dismissCooldownNotice,
      error, refresh,
    ]
  );

  return <InfraContext.Provider value={value}>{children}</InfraContext.Provider>;
}

export function useInfra() {
  const ctx = useContext(InfraContext);
  if (!ctx) throw new Error('useInfra must be used within InfraProvider');
  return ctx;
}
