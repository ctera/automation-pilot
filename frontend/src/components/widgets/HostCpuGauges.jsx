import { Card, CardContent, Typography, Box, LinearProgress, Alert } from '@mui/material';
import { useInfra } from '../../context/InfraContext';
import { infraColors } from '../../theme';
import WidgetInfoTip from '../WidgetInfoTip';

function cpuColor(percent) {
  if (percent >= 85) return infraColors.saturated;
  if (percent >= 75) return infraColors.constrained;
  return infraColors.ready;
}

export default function HostCpuGauges() {
  const { infraData } = useInfra();
  const hosts = infraData?.hosts || [];
  const anyConstrained = hosts.some((h) => h.cpu_percent >= 75 && h.cpu_percent < 85);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Host CPU
          <WidgetInfoTip text="CPU utilization for each ESXi host. The pilot uses the highest value to determine infrastructure state. Green < 75%, yellow 75-85%, red >= 85%." />
        </Typography>
        {hosts.map((h) => (
          <Box key={h.ip} sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">{h.ip}</Typography>
              <Typography variant="body2" sx={{ color: cpuColor(h.cpu_percent) }}>
                {h.cpu_percent >= 0 ? `${h.cpu_percent}%` : 'N/A'}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.max(0, Math.min(h.cpu_percent, 100))}
              sx={{
                height: 8, borderRadius: 4,
                '& .MuiLinearProgress-bar': { backgroundColor: cpuColor(h.cpu_percent) },
                backgroundColor: 'rgba(148,163,184,0.15)',
              }}
            />
          </Box>
        ))}
        {anyConstrained && (
          <Alert severity="info" variant="outlined" sx={{ mt: 1, borderRadius: 2, fontSize: '0.8rem' }}>
            CPU usage is fluctuating near the threshold. The reported value may vary by ~10%.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
