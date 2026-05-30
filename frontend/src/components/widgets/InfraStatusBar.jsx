import { useEffect, useState } from 'react';
import { Box, Button, Typography, CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useInfra } from '../../context/InfraContext';
import StatusBadge from '../StatusBadge';
import WidgetInfoTip from '../WidgetInfoTip';

export default function InfraStatusBar() {
  const {
    infraData,
    lastRefresh,
    loading,
    refreshStartedAt,
    refreshDurationMs,
    refresh,
  } = useInfra();
  const state = infraData?.state || 'unknown';
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (!loading) {
      return undefined;
    }
    setNowMs(Date.now());
    const timerId = setInterval(() => {
      setNowMs(Date.now());
    }, 100);
    return () => clearInterval(timerId);
  }, [loading]);

  const stalenessMinutes = lastRefresh
    ? Math.floor((Date.now() - lastRefresh.getTime()) / 60000)
    : null;

  const runningDurationMs = loading && refreshStartedAt
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

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, px: 3, py: 2.5, flexWrap: 'wrap' }}>
      <StatusBadge state={state} />
      <WidgetInfoTip text="Overall infrastructure state: Ready (all resources available), Constrained (approaching limits), or Saturated (at capacity). Click Refresh to re-scan all hosts, datastores, VM folders, and Jenkins jobs." />
      <Button
        variant="outlined"
        size="small"
        startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
        onClick={refresh}
        disabled={loading}
      >
        Refresh
      </Button>
      {loading && runningDurationLabel && (
        <Typography variant="body2" color="text.secondary">
          Refreshing for {runningDurationLabel}
        </Typography>
      )}
      {durationLabel && !loading && (
        <Typography variant="body2" color="text.secondary">
          took {durationLabel}
        </Typography>
      )}
      {!loading && stalenessMinutes !== null && stalenessMinutes >= 5 && (
        <Typography variant="body2" color="warning.main">
          Data is {stalenessMinutes} minutes old — Refresh?
        </Typography>
      )}
      {lastRefresh && stalenessMinutes !== null && stalenessMinutes < 5 && (
        <Typography variant="body2" color="text.secondary">
          Updated {lastRefresh.toLocaleTimeString()}
        </Typography>
      )}
    </Box>
  );
}
