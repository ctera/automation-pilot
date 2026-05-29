import { Box, Typography, Chip } from '@mui/material';

const actionColors = {
  trigger: 'success',
  queue: 'warning',
  preempt: 'error',
  cleanup: 'info',
  block: 'error',
};

export default function DecisionEntry({ decision }) {
  return (
    <Box sx={{ py: 1, borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Chip label={decision.action} size="small" color={actionColors[decision.action] || 'default'} />
        <Typography variant="caption" color="text.secondary">
          {decision.timestamp ? new Date(decision.timestamp).toLocaleString() : ''}
        </Typography>
      </Box>
      <Typography variant="body2">{decision.reasoning}</Typography>
    </Box>
  );
}
