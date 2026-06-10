import { useEffect, useState } from 'react';
import { Box, Button, Typography, CircularProgress, LinearProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useInfra } from '../../context/InfraContext';
import StatusBadge from '../StatusBadge';
import WidgetInfoTip from '../WidgetInfoTip';

const AUTO_REFRESH_INTERVAL_S = 600;

export default function InfraStatusBar() {
  const {
    infraData,
    lastRefreshedAt,
    isRefreshing,
    refreshStartedAt,
    refreshDurationMs,
    refreshProgress,
    fromCache,
    refresh,
  } = useInfra();
  const state = infraData?.state || 'unknown';
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    const interval = isRefreshing ? 100 : 1000;
    const timerId = setInterval(() => setNowMs(Date.now()), interval);
    return () => clearInterval(timerId);
  }, [isRefreshing]);

  const runningDurationMs = isRefreshing && refreshStartedAt
    ? Math.max(0, nowMs - refreshStartedAt)
    : null;

  const runningDurationLabel = runningDurationMs != null
    ? `${(runningDurationMs / 1000).toFixed(1)}s`
    : null;

  const durationLabel = refreshDurationMs != null
    ? refreshDurationMs >= 1000
      ? `${(refreshDurationMs / 1000).toFixed(1)}s`
      : `${refreshDurationMs}ms`
    : null;

  const progressPercent = refreshProgress.total > 0
    ? (refreshProgress.done / refreshProgress.total) * 100
    : 0;

  let nextRefreshLabel = null;
  if (!isRefreshing && lastRefreshedAt) {
    const elapsedS = (nowMs - lastRefreshedAt.getTime()) / 1000;
    const remainingS = Math.max(0, Math.ceil(AUTO_REFRESH_INTERVAL_S - elapsedS));
    const mins = Math.floor(remainingS / 60);
    const secs = remainingS % 60;
    nextRefreshLabel = `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, flexWrap: 'wrap' }}>
        <StatusBadge state={state} />
        <WidgetInfoTip text="Overall infrastructure state: Ready (all resources available), Constrained (approaching limits), or Saturated (at capacity). Click Refresh to re-scan all hosts, datastores, VM folders, and Jenkins jobs." />
        <Button
          variant="outlined"
          size="small"
          startIcon={isRefreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={refresh}
          disabled={isRefreshing}
        >
          Refresh
        </Button>
        {isRefreshing && (
          <Typography variant="body2" color="text.secondary">
            {refreshProgress.done}/{refreshProgress.total} refreshed
            {runningDurationLabel && ` (${runningDurationLabel})`}
          </Typography>
        )}
        {durationLabel && !isRefreshing && (
          <Typography variant="body2" color="text.secondary">
            took {durationLabel}
          </Typography>
        )}
        {!isRefreshing && lastRefreshedAt && (
          <Typography variant="body2" color="text.secondary">
            Updated {lastRefreshedAt.toLocaleTimeString()}
            {fromCache && ' (cached)'}
          </Typography>
        )}
        {nextRefreshLabel && (
          <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.7 }}>
            next in {nextRefreshLabel}
          </Typography>
        )}
      </Box>
      {isRefreshing && (
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{ mx: 3, height: 3, borderRadius: 2 }}
        />
      )}
    </Box>
  );
}
