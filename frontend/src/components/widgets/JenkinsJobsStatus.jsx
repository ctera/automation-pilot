import {
  Card, CardContent, Typography, Chip, Tooltip, Link,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Box,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useInfra } from '../../context/InfraContext';
import WidgetInfoTip from '../WidgetInfoTip';

function formatDuration(seconds) {
  if (seconds == null) return '--';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function DetailsCell({ params }) {
  if (!params) return '--';
  const image = params.IMG_TEMPLATE_NAME || params.PortalImageVersion;
  const upgrade = params.Upgrade_List;
  const toggles = params.Run_with_toggles;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      {image && (
        <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
          {image}
        </Typography>
      )}
      {upgrade && (
        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 220 }}>
          Upgrade: {upgrade}
        </Typography>
      )}
      {toggles === 'true' && (
        <Chip label="Toggles" size="small" color="info" variant="outlined" sx={{ width: 'fit-content' }} />
      )}
      {!image && !upgrade && !toggles && '--'}
    </Box>
  );
}

export default function JenkinsJobsStatus() {
  const { jenkinsJobs } = useInfra();

  if (!jenkinsJobs || jenkinsJobs.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Jenkins Jobs
            <WidgetInfoTip text="Real-time build status of monitored Jenkins jobs. Shows which jobs are currently building, their parameters, duration, and links. Configure the job list in Settings." />
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No monitored jobs configured. Add jobs in Settings.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent sx={{ pb: '12px !important' }}>
        <Typography variant="h6" gutterBottom>
          Jenkins Jobs
          <WidgetInfoTip text="Real-time build status of monitored Jenkins jobs. Shows which jobs are currently building, their parameters, duration, and links. Configure the job list in Settings." />
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Job</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Details</TableCell>
                <TableCell>Build</TableCell>
                <TableCell>Duration</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jenkinsJobs.map((job) => (
                <TableRow key={job.job_name}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {job.job_url ? (
                        <Link
                          href={job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                          variant="body2"
                        >
                          {job.job_name}
                        </Link>
                      ) : (
                        <Typography variant="body2">{job.job_name}</Typography>
                      )}
                      {job.error && (
                        <Tooltip title={job.error}>
                          <WarningAmberIcon fontSize="small" color="warning" />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={job.is_building ? 'Running' : 'Idle'}
                      size="small"
                      color={job.is_building ? 'success' : 'default'}
                      variant={job.is_building ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>
                    {job.is_building ? <DetailsCell params={job.parameters} /> : '--'}
                  </TableCell>
                  <TableCell>
                    {job.build_number ? (
                      job.build_url ? (
                        <Link
                          href={job.build_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                          variant="body2"
                        >
                          #{job.build_number}
                        </Link>
                      ) : (
                        `#${job.build_number}`
                      )
                    ) : '--'}
                  </TableCell>
                  <TableCell>
                    {job.is_building ? formatDuration(job.duration_seconds) : '--'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
