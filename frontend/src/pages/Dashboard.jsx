import { useEffect } from 'react';
import { Box, Grid } from '@mui/material';
import { useInfra } from '../context/InfraContext';
import { useWebSocket } from '../services/websocket';
import InfraStatusBar from '../components/widgets/InfraStatusBar';
import StorageCluster from '../components/widgets/StorageCluster';
import HostCpuGauges from '../components/widgets/HostCpuGauges';
import RunningVms from '../components/widgets/RunningVms';
import ActiveJobs from '../components/widgets/ActiveJobs';
import AdvisoryMessage from '../components/AdvisoryMessage';
import IntentQueue from '../components/widgets/IntentQueue';
import RecentDecisions from '../components/widgets/RecentDecisions';
import JenkinsJobsStatus from '../components/widgets/JenkinsJobsStatus';

export default function Dashboard() {
  const { infraData, refresh } = useInfra();
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (lastMessage?.type === 'infra_update') {
      refresh();
    }
  }, [lastMessage, refresh]);

  return (
    <Box>
      <InfraStatusBar />
      <Box sx={{ mt: 2 }}>
        <AdvisoryMessage state={infraData?.state} />
      </Box>

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <StorageCluster />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <HostCpuGauges />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <RunningVms />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ActiveJobs />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <RecentDecisions />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <JenkinsJobsStatus />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <IntentQueue />
        </Grid>
      </Grid>
    </Box>
  );
}
