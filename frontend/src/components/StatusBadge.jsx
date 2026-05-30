import { Chip } from '@mui/material';
import { infraColors } from '../theme';

const labels = {
  ready: 'Ready',
  constrained: 'Constrained',
  saturated: 'Saturated',
  unknown: 'Unknown',
};

export default function StatusBadge({ state = 'unknown', size = 'medium' }) {
  const color = infraColors[state] || infraColors.unknown;
  return (
    <Chip
      label={labels[state] || state}
      size={size}
      sx={{
        backgroundColor: `${color}22`,
        color: color,
        border: `2px solid ${color}55`,
        fontWeight: 800,
        fontSize: '1.25rem',
        height: 48,
        px: 2,
        '& .MuiChip-label': { px: 1.5 },
      }}
    />
  );
}
