import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Box, ToggleButtonGroup, ToggleButton, Typography, Skeleton } from '@mui/material';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, Legend, LineChart, Line,
} from 'recharts';
import { getInfraHistory } from '../../services/api';
import { infraColors } from '../../theme';

const RANGE_OPTIONS = [
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '3d', value: 72 },
  { label: '7d', value: 168 },
];

const HOST_COLORS = ['#5C9DFF', '#A78BFA', '#38BDF8', '#FB923C', '#34D399', '#E879F9'];

const TrendsDataContext = createContext(null);

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: 'background.paper', p: 1.5, borderRadius: 1, border: '1px solid rgba(148,163,184,0.2)' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{formatDate(label)}</Typography>
      {payload.map((entry) => (
        <Typography key={entry.name} variant="body2" sx={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? `${entry.value.toFixed(1)}%` : entry.value}
        </Typography>
      ))}
    </Box>
  );
}

export function TrendsProvider({ children }) {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await getInfraHistory(hours);
      setData(resp.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return (
    <TrendsDataContext.Provider value={{ data, loading, hours, setHours }}>
      {children}
    </TrendsDataContext.Provider>
  );
}

function useTrendsData() {
  return useContext(TrendsDataContext);
}

export function TrendsRangeSelector() {
  const { hours, setHours } = useTrendsData();
  return (
    <ToggleButtonGroup
      value={hours}
      exclusive
      onChange={(_, v) => v !== null && setHours(v)}
      size="small"
      sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 1, fontSize: '0.75rem' } }}
    >
      {RANGE_OPTIONS.map((opt) => (
        <ToggleButton key={opt.value} value={opt.value}>{opt.label}</ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

export function StorageTrendChart() {
  const { data, loading, hours } = useTrendsData();
  const tickFormatter = hours <= 24 ? formatTime : formatDate;

  const storageData = (data?.points || []).map((p) => ({
    timestamp: p.timestamp,
    storage: p.cluster_usage_percent,
  }));

  if (loading) {
    return <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2 }} />;
  }

  if (!data?.points?.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
        No history yet
      </Typography>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={storageData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="storageGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#5C9DFF" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#5C9DFF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
        <XAxis dataKey="timestamp" tickFormatter={tickFormatter} stroke="#94A3B8" fontSize={11} tickLine={false} />
        <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={11} tickLine={false} unit="%" />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={70} stroke={infraColors.constrained} strokeDasharray="4 4" strokeOpacity={0.6} />
        <ReferenceLine y={85} stroke={infraColors.saturated} strokeDasharray="4 4" strokeOpacity={0.6} />
        <Area
          type="monotone"
          dataKey="storage"
          name="Storage"
          stroke="#5C9DFF"
          fill="url(#storageGradient)"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HostCpuTrendChart() {
  const { data, loading, hours } = useTrendsData();
  const tickFormatter = hours <= 24 ? formatTime : formatDate;

  const hostIps = data?.points?.length
    ? [...new Set(data.points.flatMap((p) => (p.hosts || []).map((h) => h.ip)))]
    : [];

  const cpuData = (data?.points || []).map((p) => {
    const row = { timestamp: p.timestamp };
    for (const h of (p.hosts || [])) {
      row[h.ip] = h.cpu_percent;
    }
    return row;
  });

  if (loading) {
    return <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />;
  }

  if (!data?.points?.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
        No history yet
      </Typography>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={cpuData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
        <XAxis dataKey="timestamp" tickFormatter={tickFormatter} stroke="#94A3B8" fontSize={10} tickLine={false} />
        <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={10} tickLine={false} unit="%" />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={75} stroke={infraColors.constrained} strokeDasharray="4 4" strokeOpacity={0.6} />
        <ReferenceLine y={85} stroke={infraColors.saturated} strokeDasharray="4 4" strokeOpacity={0.6} />
        {hostIps.map((ip, idx) => (
          <Line
            key={ip}
            type="monotone"
            dataKey={ip}
            name={ip}
            stroke={HOST_COLORS[idx % HOST_COLORS.length]}
            strokeWidth={1.5}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HostRamTrendChart() {
  const { data, loading, hours } = useTrendsData();
  const tickFormatter = hours <= 24 ? formatTime : formatDate;

  const hostIps = data?.points?.length
    ? [...new Set(data.points.flatMap((p) => (p.hosts || []).map((h) => h.ip)))]
    : [];

  const memData = (data?.points || []).map((p) => {
    const row = { timestamp: p.timestamp };
    for (const h of (p.hosts || [])) {
      row[h.ip] = h.memory_percent;
    }
    return row;
  });

  if (loading) {
    return <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />;
  }

  if (!data?.points?.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
        No history yet
      </Typography>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={memData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
        <XAxis dataKey="timestamp" tickFormatter={tickFormatter} stroke="#94A3B8" fontSize={10} tickLine={false} />
        <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={10} tickLine={false} unit="%" />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={75} stroke={infraColors.constrained} strokeDasharray="4 4" strokeOpacity={0.6} />
        <ReferenceLine y={90} stroke={infraColors.saturated} strokeDasharray="4 4" strokeOpacity={0.6} />
        {hostIps.map((ip, idx) => (
          <Line
            key={ip}
            type="monotone"
            dataKey={ip}
            name={ip}
            stroke={HOST_COLORS[idx % HOST_COLORS.length]}
            strokeWidth={1.5}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HostTrendCharts() {
  return (
    <Box>
      <HostCpuTrendChart />
      <Box sx={{ mt: 2 }}>
        <HostRamTrendChart />
      </Box>
    </Box>
  );
}

export default function InfraTrends() {
  return null;
}
