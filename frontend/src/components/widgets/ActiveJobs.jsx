import { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, Chip, CircularProgress } from '@mui/material';
import { getIntents } from '../../services/api';

export default function ActiveJobs() {
  const [intents, setIntents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await getIntents();
        const running = resp.data.filter(
          (i) => i.status === 'running' || i.status === 'triggering'
        );
        setIntents(running);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Active Jobs</Typography>
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
