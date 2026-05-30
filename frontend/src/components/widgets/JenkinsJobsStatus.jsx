import {
  Card, CardContent, Typography, Chip, Tooltip, Link,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Box,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useInfra } from '../../context/InfraContext';
import WidgetInfoTip from '../WidgetInfoTip';

const STATUS_META = {
  running: { label: 'Running', color: 'success', variant: 'filled' },
  success: { label: 'Success', color: 'success', variant: 'filled' },
  failure: { label: 'Failed', color: 'error', variant: 'filled' },
  unstable: { label: 'Unstable', color: 'warning', variant: 'filled' },
  aborted: { label: 'Aborted', color: 'default', variant: 'outlined' },
  not_built: { label: 'Not built', color: 'default', variant: 'outlined' },
  never_built: { label: 'Never built', color: 'default', variant: 'outlined' },
  unknown: { label: 'Unknown', color: 'default', variant: 'outlined' },
  error: { label: 'Error', color: 'error', variant: 'outlined' },
};

function formatDuration(seconds) {
  if (seconds == null) return '--';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function getStatusMeta(job) {
  const rawStatus = job.is_building ? 'running' : (job.status || 'unknown');
  const key = String(rawStatus).toLowerCase().replace(/\s+/g, '_');
  return STATUS_META[key] || {
    label: key.replace(/_/g, ' '),
    color: 'default',
    variant: 'outlined',
  };
}

function getTableRows(jenkinsJobs) {
  return jenkinsJobs.flatMap((job) => {
    const runningBuilds = Array.isArray(job.running_builds) ? job.running_builds : [];
    if (runningBuilds.length === 0) {
      return [{ ...job, rowKey: `${job.job_name}-latest` }];
    }

    return runningBuilds.map((runningBuild, index) => ({
      ...job,
      ...runningBuild,
      status: runningBuild.status || job.status,
      is_building: runningBuild.is_building ?? true,
      build_number: runningBuild.build_number ?? job.build_number,
      build_url: runningBuild.build_url || job.build_url,
      duration_seconds: runningBuild.duration_seconds ?? job.duration_seconds,
      parameters: runningBuild.parameters || job.parameters,
      rowKey: `${job.job_name}-${runningBuild.build_number ?? index}`,
    }));
  });
}

function DetailsCell({ params }) {
  if (!params) return '--';
  const image = params.IMG_TEMPLATE_NAME || params.PortalImageVersion;
  const upgrade = params.Upgrade_List;
  const hasToggles = Object.prototype.hasOwnProperty.call(params, 'Run_with_toggles');
  const togglesRaw = params.Run_with_toggles;
  const togglesValue = String(togglesRaw).toLowerCase() === 'true' ? 'true' : 'false';

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
      {hasToggles && (
        <Chip
          label={`Toggles: ${togglesValue}`}
          size="small"
          color={togglesValue === 'true' ? 'info' : 'default'}
          variant="outlined"
          sx={{ width: 'fit-content' }}
        />
      )}
      {!image && !upgrade && !hasToggles && '--'}
    </Box>
  );
}

export default function JenkinsJobsStatus() {
  const { jenkinsJobs } = useInfra();
  const rows = getTableRows(jenkinsJobs || []);

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
                <TableCell>Last Build</TableCell>
                <TableCell>Duration</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const statusMeta = getStatusMeta(row);
                return (
                <TableRow key={row.rowKey}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {row.job_url ? (
                        <Link
                          href={row.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                          variant="body2"
                        >
                          {row.job_name}
                        </Link>
                      ) : (
                        <Typography variant="body2">{row.job_name}</Typography>
                      )}
                      {row.error && (
                        <Tooltip title={row.error}>
                          <WarningAmberIcon fontSize="small" color="warning" />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusMeta.label}
                      size="small"
                      color={statusMeta.color}
                      variant={statusMeta.variant}
                    />
                  </TableCell>
                  <TableCell>
                    <DetailsCell params={row.parameters} />
                  </TableCell>
                  <TableCell>
                    {row.build_number ? (
                      row.build_url ? (
                        <Link
                          href={row.build_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                          variant="body2"
                        >
                          #{row.build_number}
                        </Link>
                      ) : (
                        `#${row.build_number}`
                      )
                    ) : '--'}
                  </TableCell>
                  <TableCell>
                    {formatDuration(row.duration_seconds)}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
