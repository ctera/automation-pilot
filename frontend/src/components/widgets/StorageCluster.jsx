import { Card, CardContent, Typography, Box, LinearProgress, Skeleton } from '@mui/material';
import { useInfra } from '../../context/InfraContext';
import { infraColors } from '../../theme';
import WidgetInfoTip from '../WidgetInfoTip';

function barColor(percent) {
  if (percent >= 85) return infraColors.saturated;
  if (percent >= 70) return infraColors.constrained;
  return infraColors.ready;
}

export default function StorageCluster() {
  const { datastores, clusterUsagePercent, loading } = useInfra();

  const hasData = datastores !== null;
  const dsList = datastores || [];
  const clusterPercent = clusterUsagePercent ?? 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Storage Cluster
          <WidgetInfoTip text="Disk usage across all configured datastores. Shows aggregate cluster usage and per-datastore breakdown. Green < 70%, yellow 70-85%, red >= 85%." />
        </Typography>
        {!hasData && loading ? (
          <Box>
            <Skeleton variant="rectangular" height={10} sx={{ borderRadius: 5, mb: 2 }} />
            <Skeleton variant="rectangular" height={6} sx={{ borderRadius: 3, mb: 1 }} />
            <Skeleton variant="rectangular" height={6} sx={{ borderRadius: 3, mb: 1 }} />
            <Skeleton variant="rectangular" height={6} sx={{ borderRadius: 3 }} />
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Aggregate</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(clusterPercent, 100)}
                  sx={{
                    flex: 1,
                    height: 10, borderRadius: 5,
                    '& .MuiLinearProgress-bar': { backgroundColor: barColor(clusterPercent) },
                    backgroundColor: 'rgba(148,163,184,0.15)',
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: barColor(clusterPercent), fontWeight: 600, minWidth: 48, textAlign: 'right' }}
                >
                  {clusterPercent.toFixed(1)}%
                </Typography>
              </Box>
            </Box>
            {dsList.map((ds) => (
              <Box key={ds.name} sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">{ds.name}</Typography>
                  <Typography variant="body2" sx={{ color: barColor(ds.usage_percent) }}>
                    {ds.usage_percent >= 0 ? `${ds.usage_percent}%` : 'N/A'}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, Math.min(ds.usage_percent, 100))}
                  sx={{
                    height: 6, borderRadius: 3,
                    '& .MuiLinearProgress-bar': { backgroundColor: barColor(ds.usage_percent) },
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
