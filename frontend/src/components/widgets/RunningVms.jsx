import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { useInfra } from '../../context/InfraContext';

export default function RunningVms() {
  const { infraData } = useInfra();
  const vmCounts = infraData?.vm_counts || [];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Running VMs</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {vmCounts.map((f) => {
            const folderName = f.folder.split('/').pop();
            return (
              <Chip
                key={f.folder}
                label={`${folderName}: ${f.count >= 0 ? f.count : '?'}`}
                variant="outlined"
                size="small"
              />
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}
