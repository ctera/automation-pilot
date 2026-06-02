import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Switch, TextField, Button,
  CircularProgress, Alert, Chip, Link, Tooltip, IconButton,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckIcon from '@mui/icons-material/Check';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  getPortalTriggers, enableTriggerJob, disableTriggerJob, updateTriggerSchedule,
} from '../services/api';

function ScheduleEditor({ job, onSaved, readOnly }) {
  const [spec, setSpec] = useState(job.cron_spec || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [lastRunMsg, setLastRunMsg] = useState(job.last_run_message);
  const [nextRunMsg, setNextRunMsg] = useState(job.next_run_message);
  const dirty = spec !== (job.cron_spec || '');

  useEffect(() => {
    setSpec(job.cron_spec || '');
    setLastRunMsg(job.last_run_message);
    setNextRunMsg(job.next_run_message);
  }, [job.cron_spec, job.last_run_message, job.next_run_message]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const resp = await updateTriggerSchedule(job.job_name, spec || null);
      const updated = resp.data;
      setSpec(updated.cron_spec || '');
      setLastRunMsg(updated.last_run_message);
      setNextRunMsg(updated.next_run_message);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save schedule');
    }
    setSaving(false);
  };

  if (!job.cron_spec && !spec) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        No periodic schedule configured
      </Typography>
    );
  }

  if (readOnly) {
    return (
      <Box>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {job.cron_spec}
        </Typography>
        {lastRunMsg && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {lastRunMsg}
          </Typography>
        )}
        {nextRunMsg && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {nextRunMsg}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          size="small"
          value={spec}
          onChange={(e) => { setSpec(e.target.value); setError(null); }}
          placeholder="H 22 * * *"
          sx={{ fontFamily: 'monospace', minWidth: 180 }}
          inputProps={{ style: { fontFamily: 'monospace' } }}
        />
        <Button
          variant="contained"
          size="small"
          disabled={!dirty || saving}
          onClick={handleSave}
          startIcon={saved ? <CheckIcon /> : null}
          color={saved ? 'success' : 'primary'}
        >
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
        </Button>
      </Box>
      {error && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {error}
        </Typography>
      )}
      {lastRunMsg && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {lastRunMsg}
        </Typography>
      )}
      {nextRunMsg && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {nextRunMsg}
        </Typography>
      )}
    </Box>
  );
}

function TriggerCard({ job, onSaved, onScheduleSaved }) {
  const [localEnabled, setLocalEnabled] = useState(job.enabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const dirty = localEnabled !== job.enabled;

  useEffect(() => { setLocalEnabled(job.enabled); }, [job.enabled]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (localEnabled) {
        await enableTriggerJob(job.job_name);
      } else {
        await disableTriggerJob(job.job_name);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update job status');
    }
    setSaving(false);
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Job name + description */}
        <Box sx={{ flex: '1 1 280px', minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Link
              href={job.job_url}
              target="_blank"
              rel="noopener"
              underline="hover"
              sx={{
                fontWeight: 600,
                fontSize: '0.95rem',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
              }}
            >
              {job.job_name}
            </Link>
            <Tooltip title="View config.xml">
              <IconButton
                size="small"
                href={job.config_url}
                target="_blank"
                rel="noopener"
                sx={{ ml: 0.5 }}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {job.description}
          </Typography>
        </Box>

        {/* Status toggle + save */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 110 }}>
          <Switch
            checked={localEnabled}
            onChange={() => setLocalEnabled(!localEnabled)}
            color="success"
          />
          <Chip
            label={localEnabled ? 'Enabled' : 'Disabled'}
            size="small"
            color={localEnabled ? 'success' : 'default'}
            variant={localEnabled ? 'filled' : 'outlined'}
            sx={{ mt: 0.5 }}
          />
          <Button
            variant="contained"
            size="small"
            disabled={!dirty || saving}
            onClick={handleSave}
            startIcon={saved ? <CheckIcon /> : null}
            color={saved ? 'success' : 'primary'}
            sx={{ mt: 1 }}
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </Button>
          {error && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, textAlign: 'center' }}>
              {error}
            </Typography>
          )}
        </Box>

        {/* Schedule */}
        <Box sx={{ flex: '1 1 250px' }}>
          <Typography variant="overline" color="text.secondary">Schedule</Typography>
          <ScheduleEditor
            job={job}
            onSaved={onScheduleSaved}
            readOnly={job.job_name === 'TriggerPortalTestsWithToggles-pipeline'}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

export default function PortalTriggers() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const resp = await getPortalTriggers();
      setJobs(resp.data);
    } catch (err) {
      setError('Failed to load portal triggers');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = () => {
    setLoading(true);
    load();
  };

  if (loading && jobs.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4">Portal Triggers</Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={refresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {jobs.map((job) => (
        <TriggerCard
          key={job.job_name}
          job={job}
          onSaved={refresh}
          onScheduleSaved={refresh}
        />
      ))}
    </Box>
  );
}
