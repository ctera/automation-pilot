import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Alert, Typography } from '@mui/material';

const messages = {
  ready: {
    severity: 'success',
    text: 'Infrastructure is ready — automation can be triggered.',
  },
  constrained: {
    severity: 'warning',
    text: 'Infrastructure is near capacity — automation can run but may be affected by resource pressure.',
  },
  saturated: {
    severity: 'error',
    text: 'Infrastructure is saturated — cleanup recommended before triggering automation.',
  },
};

export default function AdvisoryMessage({ state }) {
  const config = messages[state];
  if (!config) return null;
  const isReadyState = state === 'ready';

  return (
    <Alert
      severity={config.severity}
      variant="outlined"
      icon={isReadyState ? <CheckCircleRoundedIcon sx={{ fontSize: 40, color: 'success.main' }} /> : undefined}
      sx={{
        borderRadius: 2,
        px: 3.5,
        py: isReadyState ? 2 : 1.5,
        alignItems: 'center',
        '& .MuiAlert-icon': {
          mr: isReadyState ? 2 : 1.5,
          py: 0,
          fontSize: 32,
        },
        '& .MuiAlert-message': {
          py: 0.5,
          width: '100%',
        },
      }}
    >
      <Typography
        sx={{
          fontSize: isReadyState ? '1.3rem' : '1.15rem',
          fontWeight: isReadyState ? 700 : 500,
          lineHeight: 1.4,
        }}
      >
        {config.text}
      </Typography>
    </Alert>
  );
}
