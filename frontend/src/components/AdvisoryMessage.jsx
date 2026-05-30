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
      icon={isReadyState ? <CheckCircleRoundedIcon sx={{ fontSize: 34, color: 'success.main' }} /> : undefined}
      sx={{
        borderRadius: 2,
        px: 2.5,
        py: isReadyState ? 1.25 : 0.75,
        alignItems: 'center',
        '& .MuiAlert-icon': {
          mr: isReadyState ? 1.5 : 1,
          py: 0,
        },
        '& .MuiAlert-message': {
          py: 0.25,
          width: '100%',
        },
      }}
    >
      <Typography
        sx={{
          fontSize: isReadyState ? '1.1rem' : '1rem',
          fontWeight: isReadyState ? 700 : 500,
          lineHeight: 1.35,
        }}
      >
        {config.text}
      </Typography>
    </Alert>
  );
}
