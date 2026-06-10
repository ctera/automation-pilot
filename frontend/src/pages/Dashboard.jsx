import { useEffect, useRef } from 'react';
import { Box, Grid, Card, CardContent, Typography } from '@mui/material';
import { useInfra } from '../context/InfraContext';
import InfraStatusBar from '../components/widgets/InfraStatusBar';
import { HostSaturationAlerts } from '../components/widgets/TrendAlerts';
import StorageCluster from '../components/widgets/StorageCluster';
import { HostCpuBars, HostRamBars } from '../components/widgets/HostCpuGauges';
import { TrendsProvider, TrendsRangeSelector, StorageTrendChart, HostCpuTrendChart, HostRamTrendChart } from '../components/widgets/InfraTrends';
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
      refreshRef.current(false);
    }
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <InfraStatusBar />
      <AdvisoryMessage state={infraData?.state} />

      <Grid container spacing={1.5}>
        {/* Storage section: gauge + history chart */}
        <Grid size={{ xs: 12 }}>
          <TrendsProvider>
            <Card sx={{ border: '1px solid rgba(148,163,184,0.08)' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">Storage Cluster</Typography>
                  <TrendsRangeSelector />
                </Box>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <StorageCluster embedded />
                  </Grid>
                  <Grid size={{ xs: 12, md: 9 }}>
                    <StorageTrendChart />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TrendsProvider>
        </Grid>

        {/* Host section: CPU row + RAM row */}
        <Grid size={{ xs: 12 }}>
          <TrendsProvider>
            <Card sx={{ border: '1px solid rgba(148,163,184,0.08)' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">Host Resources</Typography>
                  <TrendsRangeSelector />
                </Box>
                <HostSaturationAlerts />

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>CPU</Typography>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <HostCpuBars />
                  </Grid>
                  <Grid size={{ xs: 12, md: 9 }}>
                    <HostCpuTrendChart />
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>RAM</Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <HostRamBars />
                  </Grid>
                  <Grid size={{ xs: 12, md: 9 }}>
                    <HostRamTrendChart />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TrendsProvider>
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <RunningVms />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <JenkinsJobsStatus />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ActiveJobs />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <RecentDecisions />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <IntentQueue />
        </Grid>
      </Grid>
    </Box>
  );
}
