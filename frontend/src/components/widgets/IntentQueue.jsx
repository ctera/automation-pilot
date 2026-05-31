import { useState } from 'react';
import {
  Card, CardContent, Typography, Box, IconButton, Chip,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, FormControlLabel, Checkbox,
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import StopIcon from '@mui/icons-material/Stop';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { cancelIntent, stopIntent, reprioritizeIntent } from '../../services/api';
import { useIntents } from '../../context/IntentsContext';
import WidgetInfoTip from '../WidgetInfoTip';

const statusColors = {
  pending: 'default',
  queued: 'warning',
  preparing: 'info',
  triggering: 'info',
  running: 'primary',
  completed: 'success',
  failed: 'error',
  preempted: 'error',
  cancelled: 'default',
  stopped: 'default',
};

export default function IntentQueue() {
  const { intents: allIntents, reload } = useIntents();
  const [stopDialog, setStopDialog] = useState(null);
  const [deleteVms, setDeleteVms] = useState(false);

  const intents = allIntents.filter(
    (i) => !['completed', 'failed', 'cancelled', 'stopped'].includes(i.status)
  );

  const handleCancel = async (id) => {
    await cancelIntent(id);
    reload();
  };

  const handleStop = async () => {
    if (stopDialog) {
      await stopIntent(stopDialog, deleteVms);
      setStopDialog(null);
      setDeleteVms(false);
      reload();
    }
  };

  const handleReprioritize = async (id, newPriority) => {
    await reprioritizeIntent(id, newPriority);
    reload();
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Intent Queue
          <WidgetInfoTip text="All non-terminal job intents managed by the pilot (pending, queued, preparing, triggering, running). Use the action buttons to cancel, stop, or reprioritize jobs." />
        </Typography>
        {intents.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No active intents</Typography>
        ) : (
          intents.map((intent) => (
            <Box
              key={intent.id}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, py: 0.5 }}
            >
              <Chip label={intent.status} size="small" color={statusColors[intent.status]} />
              <Chip
                label={intent.priority}
                size="small"
                variant="outlined"
                color={intent.priority === 'high' ? 'error' : 'default'}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>{intent.job_id}</Typography>

              {['pending', 'queued', 'preparing'].includes(intent.status) && (
                <Tooltip title="Cancel">
                  <IconButton size="small" onClick={() => handleCancel(intent.id)}>
                    <CancelIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {intent.status === 'running' && (
                <Tooltip title="Stop">
                  <IconButton size="small" onClick={() => setStopDialog(intent.id)}>
                    <StopIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {['queued', 'running'].includes(intent.status) && (
                <Tooltip title="Reprioritize">
                  <IconButton
                    size="small"
                    onClick={() =>
                      handleReprioritize(intent.id, intent.priority === 'normal' ? 'high' : 'normal')
                    }
                  >
                    <SwapVertIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          ))
        )}

        <Dialog open={!!stopDialog} onClose={() => setStopDialog(null)}>
          <DialogTitle>Stop Automation</DialogTitle>
          <DialogContent>
            <FormControlLabel
              control={<Checkbox checked={deleteVms} onChange={(e) => setDeleteVms(e.target.checked)} />}
              label="Also power off and delete VMs"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStopDialog(null)}>Cancel</Button>
            <Button onClick={handleStop} color="error" variant="contained">Stop</Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}
