import { Card, CardContent, Typography, Box, LinearProgress, Skeleton } from '@mui/material';
import { useInfra } from '../../context/InfraContext';
import { infraColors } from '../../theme';

export const HOST_COLORS = ['#5C9DFF', '#A78BFA', '#38BDF8', '#FB923C', '#34D399', '#E879F9'];

function cpuColor(percent) {
  if (percent >= 85) return infraColors.saturated;
  if (percent >= 75) return infraColors.constrained;
  return infraColors.ready;
}

function memColor(percent) {
  if (percent >= 90) return infraColors.saturated;
  if (percent >= 75) return infraColors.constrained;
  return infraColors.ready;
}

function HostBar({ ip, value, colorFn, hostIdx }) {
  const pct = Math.max(0, Math.min(value, 100));
  const color = colorFn(value);
  const hostColor = HOST_COLORS[hostIdx % HOST_COLORS.length];
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: hostColor }}>{ip}</Typography>
        <Typography variant="body2" sx={{ color, fontWeight: 600 }}>
          {value >= 0 ? `${value}%` : 'N/A'}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 6, borderRadius: 4,
          '& .MuiLinearProgress-bar': { backgroundColor: color },
          backgroundColor: 'rgba(148,163,184,0.15)',
        }}
      />
    </Box>
  );
}

export function HostCpuBars() {
  const { hosts, loading } = useInfra();
  const hostList = hosts || [];

  if (!hosts && loading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 4, mb: 1.5 }} />
        <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 4 }} />
      </Box>
    );
  }

  return (
    <Box>
      {hostList.map((h, idx) => (
        <HostBar key={h.ip} ip={h.ip} value={h.cpu_percent} colorFn={cpuColor} hostIdx={idx} />
      ))}
    </Box>
  );
}

export function HostRamBars() {
  const { hosts, loading } = useInfra();
  const hostList = hosts || [];

  if (!hosts && loading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 4, mb: 1.5 }} />
        <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 4 }} />
      </Box>
    );
  }

  return (
    <Box>
      {hostList.map((h, idx) => (
        <HostBar key={h.ip} ip={h.ip} value={h.memory_percent} colorFn={memColor} hostIdx={idx} />
      ))}
    </Box>
  );
}

export default function HostCpuGauges({ embedded = false }) {
  const { hosts, loading } = useInfra();
  const hasData = hosts !== null;

  const content = (
    <>
      {!hasData && loading ? (
        <Box>
          <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 2, mb: 1.5 }} />
          <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 2 }} />
        </Box>
      ) : (
        <Box>
          <HostCpuBars />
          <Box sx={{ mt: 2 }}>
            <HostRamBars />
          </Box>
        </Box>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Host Resources</Typography>
        {content}
      </CardContent>
    </Card>
  );
}
