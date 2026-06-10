import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card, CardContent, Typography, Chip, Tooltip, Link, Skeleton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Box, Button,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useInfra } from '../../context/InfraContext';
import WidgetInfoTip from '../WidgetInfoTip';

const ALL_TEAMS = ['Portal', 'CloudFS', 'Gateway'];

const TEAM_COLORS = {
  Portal: '#5C9DFF',
  CloudFS: '#4ADE80',
  Gateway: '#FBBF24',
};

function RunningDots() {
  const [dotCount, setDotCount] = useState(3);
  useEffect(() => {
    const id = setInterval(() => setDotCount((c) => (c % 3) + 1), 500);
    return () => clearInterval(id);
  }, []);
  return <span>Running{'.'.repeat(dotCount)}<span style={{ visibility: 'hidden' }}>{'.'.repeat(3 - dotCount)}</span></span>;
}

const STATUS_META = {
  running: { label: <RunningDots />, color: 'info', variant: 'filled' },
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
  const [activeTeams, setActiveTeams] = useState(new Set(ALL_TEAMS));
  const filterBarRef = useRef(null);
  const groups = getJobGroups(jenkinsJobs || []);
  const filteredGroups = groups.filter(({ job }) => activeTeams.has(job.team));

  const stableToggle = useCallback((updater) => {
    const el = filterBarRef.current;
    const offsetBefore = el ? el.getBoundingClientRect().top : null;
    setActiveTeams(updater);
    if (el && offsetBefore !== null) {
      requestAnimationFrame(() => {
        const offsetAfter = el.getBoundingClientRect().top;
        window.scrollBy(0, offsetAfter - offsetBefore);
      });
    }
  }, []);

  const toggleTeam = (team) => {
    stableToggle((prev) => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team);
      else next.add(team);
      return next;
    });
  };

  const toggleAll = () => {
    stableToggle((prev) =>
      prev.size === ALL_TEAMS.length ? new Set() : new Set(ALL_TEAMS),
    );
  };

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
        <Box ref={filterBarRef} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, mb: 0.5 }}>
          <Typography variant="body1" color="text.secondary" sx={{ mr: 0.5, whiteSpace: 'nowrap', fontWeight: 500 }}>
            Filter by team
          </Typography>
          {ALL_TEAMS.map((team) => {
            const isActive = activeTeams.has(team);
            const color = TEAM_COLORS[team];
            return (
              <Button
                key={team}
                size="small"
                variant={isActive ? 'contained' : 'outlined'}
                onClick={() => toggleTeam(team)}
                sx={{
                  minWidth: 'auto',
                  px: 1.5,
                  py: 0.25,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderColor: color,
                  color: isActive ? '#0F172A' : color,
                  backgroundColor: isActive ? color : 'transparent',
                  textShadow: isActive ? '0 0 1px rgba(0,0,0,0.3)' : 'none',
                  '&:hover': {
                    borderColor: color,
                    backgroundColor: isActive ? color : `${color}22`,
                  },
                }}
              >
                {team}
              </Button>
            );
          })}
          <Box sx={{ width: '1px', height: 20, backgroundColor: 'divider', mx: 0.5 }} />
          <Button
            size="small"
            variant={activeTeams.size === ALL_TEAMS.length ? 'contained' : 'outlined'}
            onClick={toggleAll}
            sx={{
              minWidth: 'auto',
              px: 1.5,
              py: 0.25,
              fontSize: '0.75rem',
              fontWeight: 700,
              borderColor: 'rgba(148,163,184,0.4)',
              color: activeTeams.size === ALL_TEAMS.length ? '#0F172A' : 'text.secondary',
              backgroundColor: activeTeams.size === ALL_TEAMS.length ? 'rgba(148,163,184,0.5)' : 'transparent',
              '&:hover': {
                backgroundColor: 'rgba(148,163,184,0.15)',
              },
            }}
          >
            All Teams
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Displaying Jenkins Jobs of {activeTeams.size > 0 ? [...activeTeams].join(', ') : 'no teams'}
        </Typography>
        <TableContainer>
          <Table size="small" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow>
                <TableCell>Job</TableCell>
                <TableCell>Team</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Details</TableCell>
                <TableCell>Build</TableCell>
                <TableCell>Duration</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredGroups.map(({ job, builds }, groupIdx) => {
                const rows = builds.map((row, buildIdx) => {
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
                          borderBottom: isLastRow ? `1px solid ${borderColor}` : `1px dashed rgba(255,255,255,0.04)`,
                          py: isFirstRow || isLastRow ? 0.75 : 0.25,
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
                      {isFirstRow && (
                        <TableCell
                          rowSpan={builds.length}
                          sx={{ verticalAlign: 'middle' }}
                        >
                          {job.team && (
                            <Chip
                              label={job.team}
                              size="small"
                              color={job.team === 'Portal' ? 'primary' : job.team === 'CloudFS' ? 'success' : 'warning'}
                              variant="outlined"
                            />
                          )}
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
                });

                if (groupIdx > 0) {
                  return [
                    <TableRow key={`spacer-${groupIdx}`} sx={{ '& > td': { p: 0, border: 'none' } }}>
                      <TableCell colSpan={6} sx={{ height: 12 }} />
                    </TableRow>,
                    ...rows,
                  ];
                }
                return rows;
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
