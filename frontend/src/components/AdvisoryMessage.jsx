import { Alert } from '@mui/material';

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
  return (
    <Alert severity={config.severity} variant="outlined" sx={{ borderRadius: 2 }}>
      {config.text}
    </Alert>
  );
}
