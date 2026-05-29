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
        border: `1px solid ${color}44`,
        fontWeight: 700,
      }}
    />
  );
}
