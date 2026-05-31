import {
  Card, CardContent, Typography, Chip, Tooltip, Link, Skeleton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Box,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useInfra } from '../../context/InfraContext';
import WidgetInfoTip from '../WidgetInfoTip';

const STATUS_META = {
  running: { label: 'Running', color: 'info', variant: 'filled' },
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

function getJobGroups(jenkinsJobs) {
  return jenkinsJobs.map((job) => {
    const runningBuilds = Array.isArray(job.running_builds) ? job.running_builds : [];
    if (runningBuilds.length === 0) {
      return { job, builds: [{ ...job, rowKey: `${job.job_name}-latest` }] };
    }

    const builds = runningBuilds.map((runningBuild, index) => ({
      ...job,
      ...runningBuild,
      status: runningBuild.status || job.status,
      is_building: runningBuild.is_building ?? true,
      build_number: runningBuild.build_number ?? job.build_number,
      build_url: runningBuild.build_url || job.build_url,
      duration_seconds: runningBuild.duration_seconds ?? job.duration_seconds,
      parameters: runningBuild.parameters || job.parameters,
      rowKey: `${job.job_name}-running-${runningBuild.build_number ?? index}`,
    }));

    return { job, builds };
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
          sx={{ width: 'fit-content', height: 18, fontSize: '0.675rem', '& .MuiChip-label': { px: 0.75 } }}
        />
      )}
      {!image && !upgrade && !hasToggles && '--'}
    </Box>
  );
}

export default function JenkinsJobsStatus() {
  const { jenkinsJobs, loading } = useInfra();
  const groups = getJobGroups(jenkinsJobs || []);

  if (!jenkinsJobs && loading) {
    return (
      <Card>
        <CardContent sx={{ pb: '12px !important' }}>
          <Typography variant="h6" gutterBottom>
            Jenkins Jobs
            <WidgetInfoTip text="Real-time build status of monitored Jenkins jobs. Shows which jobs are currently building, their parameters, duration, and links. Configure the job list in Settings." />
          </Typography>
          <Box>
            <Skeleton variant="rectangular" height={32} sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" height={32} sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" height={32} sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" height={32} />
          </Box>
        </CardContent>
      </Card>
    );
  }

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
          <Table size="small" sx={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
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
              {groups.map(({ job, builds }) =>
                builds.map((row, buildIdx) => {
                  const statusMeta = getStatusMeta(row);
                  const isFirstRow = buildIdx === 0;
                  const isLastRow = buildIdx === builds.length - 1;
                  const borderColor = 'rgba(255,255,255,0.08)';
                  return (
                    <TableRow
                      key={row.rowKey}
                      sx={{
                        '& > td': {
                          backgroundColor: 'action.hover',
                          borderTop: isFirstRow ? `1px solid ${borderColor}` : 'none',
                          borderBottom: isLastRow ? `1px solid ${borderColor}` : 'none',
                          py: 0.75,
                        },
                        '& > td:last-child': {
                          borderRight: `1px solid ${borderColor}`,
                          borderTopRightRadius: isFirstRow ? 6 : 0,
                          borderBottomRightRadius: isLastRow ? 6 : 0,
                        },
                      }}
                    >
                      {isFirstRow && (
                        <TableCell
                          rowSpan={builds.length}
                          sx={{
                            verticalAlign: 'middle',
                            borderLeft: '3px solid',
                            borderLeftColor: 'primary.main',
                            borderTop: `1px solid ${borderColor}`,
                            borderBottom: `1px solid ${borderColor}`,
                            borderTopLeftRadius: 6,
                            borderBottomLeftRadius: 6,
                            backgroundColor: 'action.hover',
                            px: 1.5,
                          }}
                        >
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
                      )}
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
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
