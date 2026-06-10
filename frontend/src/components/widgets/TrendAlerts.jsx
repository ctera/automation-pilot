import { useState, useEffect } from 'react';
import { Box, Alert } from '@mui/material';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import { getInfraTrends } from '../../services/api';

export default function TrendAlerts() {
  return null;
}

export function HostSaturationAlerts() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function fetchTrends() {
      try {
        const resp = await getInfraTrends(72);
        if (!cancelled) {
          setAlerts(resp.data.alerts || []);
        }
      } catch {
        if (!cancelled) setAlerts([]);
      }
    }
    fetchTrends();
    const interval = setInterval(fetchTrends, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!alerts.length) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1.5 }}>
      {alerts.map((alert, idx) => (
        <Alert
          key={idx}
          severity={alert.severity === 'error' ? 'error' : 'warning'}
          icon={<WhatshotIcon />}
          variant="outlined"
          sx={{ '& .MuiAlert-message': { fontSize: '0.813rem' }, py: 0.25 }}
        >
          {alert.message}
        </Alert>
      ))}
    </Box>
  );
}
