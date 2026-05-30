import { Box, Button, Typography, CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useInfra } from '../../context/InfraContext';
import StatusBadge from '../StatusBadge';
import WidgetInfoTip from '../WidgetInfoTip';

export default function InfraStatusBar() {
  const { infraData, lastRefresh, loading, refresh } = useInfra();
  const state = infraData?.state || 'unknown';

  const stalenessMinutes = lastRefresh
    ? Math.floor((Date.now() - lastRefresh.getTime()) / 60000)
    : null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, flexWrap: 'wrap' }}>
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
      {stalenessMinutes !== null && stalenessMinutes >= 5 && (
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
