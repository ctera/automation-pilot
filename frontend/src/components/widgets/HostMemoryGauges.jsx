import { Card, CardContent, Typography, Box, LinearProgress, Skeleton } from '@mui/material';
import { useInfra } from '../../context/InfraContext';
import { infraColors } from '../../theme';
import WidgetInfoTip from '../WidgetInfoTip';

function memColor(percent) {
  if (percent >= 90) return infraColors.saturated;
  if (percent >= 75) return infraColors.constrained;
  return infraColors.ready;
}

export default function HostMemoryGauges() {
  const { hosts, loading } = useInfra();

  const hasData = hosts !== null;
  const hostList = hosts || [];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Host RAM
          <WidgetInfoTip text="RAM utilization for each ESXi host. Green < 75%, yellow 75-90%, red >= 90%." />
        </Typography>
        {!hasData && loading ? (
          <Box>
            <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 4, mb: 1.5 }} />
            <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 4 }} />
          </Box>
        ) : (
          <>
            {hostList.map((h) => (
              <Box key={h.ip} sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">{h.ip}</Typography>
                  <Typography variant="body2" sx={{ color: memColor(h.memory_percent) }}>
                    {h.memory_percent >= 0 ? `${h.memory_percent}%` : 'N/A'}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, Math.min(h.memory_percent, 100))}
                  sx={{
                    height: 8, borderRadius: 4,
                    '& .MuiLinearProgress-bar': { backgroundColor: memColor(h.memory_percent) },
                    backgroundColor: 'rgba(148,163,184,0.15)',
                  }}
                />
              </Box>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
