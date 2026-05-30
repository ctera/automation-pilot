import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button,
  IconButton, List, ListItem, ListItemText,
  CircularProgress, Alert, Grid,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { getSettings, updateSetting } from '../services/api';

function EditableList({ title, items, settingKey, onSave }) {
  const [localItems, setLocalItems] = useState(items || []);
  const [newItem, setNewItem] = useState('');

  useEffect(() => { setLocalItems(items || []); }, [items]);

  const handleAdd = () => {
    if (newItem.trim()) {
      setLocalItems([...localItems, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemove = (index) => {
    setLocalItems(localItems.filter((_, i) => i !== index));
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>{title}</Typography>
        <List dense>
          {localItems.map((item, i) => (
            <ListItem
              key={i}
              secondaryAction={
                <IconButton edge="end" onClick={() => handleRemove(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemText primary={item} />
            </ListItem>
          ))}
        </List>
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <TextField
            size="small"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={`Add ${title.toLowerCase()}`}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <IconButton onClick={handleAdd}><AddIcon /></IconButton>
        </Box>
        <Button
          variant="contained"
          size="small"
          sx={{ mt: 1 }}
          onClick={() => onSave(settingKey, localItems)}
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

function ThresholdEditor({ thresholds, onSave }) {
  const [local, setLocal] = useState(thresholds);

  useEffect(() => { setLocal(thresholds); }, [thresholds]);

  const update = (metric, field, value) => {
    setLocal((prev) => ({
      ...prev,
      [metric]: { ...prev[metric], [field]: parseInt(value, 10) || 0 },
    }));
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Thresholds</Typography>
        {['storage', 'cpu'].map((metric) => (
          <Box key={metric} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ textTransform: 'capitalize', mb: 1 }}>
              {metric}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Ready below %"
                type="number"
                size="small"
                value={local?.[metric]?.ready_below ?? ''}
                onChange={(e) => update(metric, 'ready_below', e.target.value)}
              />
              <TextField
                label="Constrained below %"
                type="number"
                size="small"
                value={local?.[metric]?.constrained_below ?? ''}
                onChange={(e) => update(metric, 'constrained_below', e.target.value)}
              />
            </Box>
          </Box>
        ))}
        <Button variant="contained" size="small" onClick={() => onSave('thresholds', local)}>
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const resp = await getSettings();
      setSettings(resp.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (key, value) => {
    try {
      await updateSetting(key, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      load();
    } catch { /* ignore */ }
  };

  if (loading) return <CircularProgress />;
  if (!settings) return <Typography color="error">Failed to load settings</Typography>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Settings</Typography>
      {saved && <Alert severity="success" sx={{ mb: 2 }}>Settings saved</Alert>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <EditableList title="ESXi Hosts" items={settings.hosts} settingKey="hosts" onSave={handleSave} />
          <EditableList title="Datastores" items={settings.datastores} settingKey="datastores" onSave={handleSave} />
          <EditableList title="VM Folders" items={settings.vm_folders} settingKey="vm_folders" onSave={handleSave} />
          <EditableList title="Monitored Jenkins Jobs" items={settings.monitored_jenkins_jobs} settingKey="monitored_jenkins_jobs" onSave={handleSave} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ThresholdEditor thresholds={settings.thresholds} onSave={handleSave} />
        </Grid>
      </Grid>
    </Box>
  );
}
