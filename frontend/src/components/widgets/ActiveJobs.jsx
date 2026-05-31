import { Card, CardContent, Typography, Box, Chip, CircularProgress } from '@mui/material';
import { useIntents } from '../../context/IntentsContext';
import WidgetInfoTip from '../WidgetInfoTip';

export default function ActiveJobs() {
  const { intents: allIntents, loading } = useIntents();

  const intents = allIntents.filter(
    (i) => i.status === 'running' || i.status === 'triggering'
  );

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Active Jobs
          <WidgetInfoTip text="Jobs that the pilot orchestrator has actively dispatched or is currently triggering. Shows only running/triggering intents — a quick glance at what's consuming infrastructure right now." />
        </Typography>
        {loading ? (
          <CircularProgress size={20} />
        ) : intents.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No active jobs</Typography>
        ) : (
          intents.map((intent) => (
            <Box key={intent.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip label={intent.status} size="small" color="primary" variant="outlined" />
              <Typography variant="body2">{intent.job_id}</Typography>
              <Typography variant="caption" color="text.secondary">
                #{intent.jenkins_build_number || '?'}
              </Typography>
            </Box>
          ))
        )}
      </CardContent>
    </Card>
  );
}
