import { useEffect, useRef } from 'react';
import { Box, Grid } from '@mui/material';
import { useInfra } from '../context/InfraContext';
import InfraStatusBar from '../components/widgets/InfraStatusBar';
import StorageCluster from '../components/widgets/StorageCluster';
import HostCpuGauges from '../components/widgets/HostCpuGauges';
import RunningVms from '../components/widgets/RunningVms';
import ActiveJobs from '../components/widgets/ActiveJobs';
import AdvisoryMessage from '../components/AdvisoryMessage';
import IntentQueue from '../components/widgets/IntentQueue';
import RecentDecisions from '../components/widgets/RecentDecisions';
import JenkinsJobsStatus from '../components/widgets/JenkinsJobsStatus';

const SETTINGS_CHANGED_KEY = 'pilot_settings_changed';

export default function Dashboard() {
  const { infraData, refresh } = useInfra();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const settingsChanged = sessionStorage.getItem(SETTINGS_CHANGED_KEY) === 'true';
    sessionStorage.removeItem(SETTINGS_CHANGED_KEY);
    if (settingsChanged) {
      refreshRef.current();
    }
  }, []);

  return (
    <Box>
      <InfraStatusBar />
      <Box sx={{ mt: 2, px: 1 }}>
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
