import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import {
  refreshDatastores,
  refreshHosts,
  refreshVmFolders,
  getJenkinsJobStatuses,
} from '../services/api';

const InfraContext = createContext(null);

const REFRESH_COOLDOWN_MS = 10_000;
const STORAGE_KEY = 'pilot_last_refresh_ts';
const TOTAL_SLICES = 4;

function getLastRefreshTs() {
  const val = sessionStorage.getItem(STORAGE_KEY);
  return val ? Number(val) : 0;
}

function setLastRefreshTs(ts) {
  sessionStorage.setItem(STORAGE_KEY, String(ts));
}

export function InfraProvider({ children }) {
  const [datastores, setDatastores] = useState(null);
  const [clusterUsagePercent, setClusterUsagePercent] = useState(null);
  const [hosts, setHosts] = useState(null);
  const [vmCounts, setVmCounts] = useState(null);
  const [jenkinsJobs, setJenkinsJobs] = useState(null);

  const [lastRefresh, setLastRefresh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshStartedAt, setRefreshStartedAt] = useState(null);
  const [refreshDurationMs, setRefreshDurationMs] = useState(null);
  const [refreshProgress, setRefreshProgress] = useState({ total: TOTAL_SLICES, done: 0 });
  const [error, setError] = useState(null);
  const startTimeRef = useRef(null);
  const inFlightRef = useRef(false);
  const doneCountRef = useRef(0);

  const refresh = useCallback(async () => {
    const now = Date.now();
    if (inFlightRef.current || now - getLastRefreshTs() < REFRESH_COOLDOWN_MS) {
      return;
    }
    inFlightRef.current = true;
    doneCountRef.current = 0;
    setLastRefreshTs(now);
    setRefreshStartedAt(now);
    startTimeRef.current = performance.now();
    setLoading(true);
    setError(null);
    setRefreshProgress({ total: TOTAL_SLICES, done: 0 });

    const tick = () => {
      doneCountRef.current += 1;
      setRefreshProgress({ total: TOTAL_SLICES, done: doneCountRef.current });
    };

    const promises = [
      refreshDatastores()
        .then((r) => {
          setDatastores(r.data.datastores);
          setClusterUsagePercent(r.data.cluster_usage_percent);
          tick();
        })
        .catch((err) => {
          setError(err?.response?.data?.detail || err?.message);
          tick();
        }),
      refreshHosts()
        .then((r) => {
          setHosts(r.data.hosts);
          tick();
        })
        .catch(() => tick()),
      refreshVmFolders()
        .then((r) => {
          setVmCounts(r.data.vm_counts);
          tick();
        })
        .catch(() => tick()),
      getJenkinsJobStatuses()
        .then((r) => {
          setJenkinsJobs(r.data);
          tick();
        })
        .catch(() => tick()),
    ];

    await Promise.allSettled(promises);

    setRefreshDurationMs(Math.round(performance.now() - startTimeRef.current));
    setLastRefresh(new Date());
    setLoading(false);
    setRefreshStartedAt(null);
    inFlightRef.current = false;
  }, []);

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
      lastRefresh,
      loading,
      refreshStartedAt,
      refreshDurationMs,
      refreshProgress,
      error,
      refresh,
    }),
    [
      infraData, datastores, clusterUsagePercent, hosts, vmCounts,
      jenkinsJobs, lastRefresh, loading, refreshStartedAt,
      refreshDurationMs, refreshProgress, error, refresh,
    ]
  );

  return <InfraContext.Provider value={value}>{children}</InfraContext.Provider>;
}

export function useInfra() {
  const ctx = useContext(InfraContext);
  if (!ctx) throw new Error('useInfra must be used within InfraProvider');
  return ctx;
}
