import { useEffect, useState } from 'react';
import { Box, Button, Typography, CircularProgress, LinearProgress, Snackbar, Alert } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useInfra } from '../../context/InfraContext';
import StatusBadge from '../StatusBadge';
import WidgetInfoTip from '../WidgetInfoTip';

export default function InfraStatusBar() {
  const {
    infraData,
    lastRefreshedAt,
    isRefreshing,
    refreshStartedAt,
    refreshDurationMs,
    refreshProgress,
    cooldownNotice,
    dismissCooldownNotice,
    refresh,
  } = useInfra();
  const state = infraData?.state || 'unknown';
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (!isRefreshing) return undefined;
    setNowMs(Date.now());
    const timerId = setInterval(() => setNowMs(Date.now()), 100);
    return () => clearInterval(timerId);
  }, [isRefreshing]);

  const stalenessMinutes = lastRefreshedAt
    ? Math.floor((Date.now() - lastRefreshedAt.getTime()) / 60000)
    : null;

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, px: 3, py: 2.5, flexWrap: 'wrap' }}>
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
        {!isRefreshing && stalenessMinutes !== null && stalenessMinutes >= 5 && (
          <Typography variant="body2" color="warning.main">
            Data is {stalenessMinutes} minutes old — Refresh?
          </Typography>
        )}
        {!isRefreshing && lastRefreshedAt && stalenessMinutes !== null && stalenessMinutes < 5 && (
          <Typography variant="body2" color="text.secondary">
            Updated {lastRefreshedAt.toLocaleTimeString()}
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
      <Snackbar
        open={!!cooldownNotice}
        autoHideDuration={5000}
        onClose={dismissCooldownNotice}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={dismissCooldownNotice} severity="info" variant="filled" sx={{ width: '100%' }}>
          {cooldownNotice}
        </Alert>
      </Snackbar>
    </Box>
  );
}
