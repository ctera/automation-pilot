import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button,
  IconButton, List, ListItem, ListItemText,
  CircularProgress, Alert, Grid, Chip, MenuItem, Select, FormControl, InputLabel,
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

const GROUPS = ['Portal', 'CloudFS', 'Gateway'];

const GROUP_COLORS = {
  Portal: 'primary',
  CloudFS: 'success',
  Gateway: 'warning',
};

function FolderListEditor({ items, onSave }) {
  const [localItems, setLocalItems] = useState(items || []);
  const [newPath, setNewPath] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [groupError, setGroupError] = useState(false);

  useEffect(() => { setLocalItems(items || []); }, [items]);

  const handleAdd = () => {
    if (!newPath.trim()) return;
    if (!newGroup) {
      setGroupError(true);
      return;
    }
    setLocalItems([...localItems, { path: newPath.trim(), group: newGroup }]);
    setNewPath('');
    setNewGroup('');
    setGroupError(false);
  };

  const handleRemove = (index) => {
    setLocalItems(localItems.filter((_, i) => i !== index));
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Automation Folders</Typography>
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
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">{item.path}</Typography>
                    {item.group && (
                      <Chip
                        label={item.group}
                        size="small"
                        color={GROUP_COLORS[item.group] || 'default'}
                        variant="outlined"
                      />
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
        <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'flex-start' }}>
          <TextField
            size="small"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="Folder path (e.g. DevProd/QA/PIM)"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            sx={{ flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }} error={groupError}>
            <InputLabel>Group *</InputLabel>
            <Select
              value={newGroup}
              label="Group *"
              onChange={(e) => { setNewGroup(e.target.value); setGroupError(false); }}
            >
              {GROUPS.map((g) => (
                <MenuItem key={g} value={g}>{g}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <IconButton onClick={handleAdd}><AddIcon /></IconButton>
        </Box>
        {groupError && (
          <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
            Group is required
          </Typography>
        )}
        <Button
          variant="contained"
          size="small"
          sx={{ mt: 1 }}
          onClick={() => onSave('vm_folders', localItems)}
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

const TEAMS = ['Portal', 'CloudFS', 'Gateway'];

const TEAM_COLORS = {
  Portal: 'primary',
  CloudFS: 'success',
  Gateway: 'warning',
};

function JobListEditor({ items, onSave }) {
  const [localItems, setLocalItems] = useState(items || []);
  const [newName, setNewName] = useState('');
  const [newTeam, setNewTeam] = useState('');
  const [teamError, setTeamError] = useState(false);

  useEffect(() => { setLocalItems(items || []); }, [items]);

  const handleAdd = () => {
    if (!newName.trim()) return;
    if (!newTeam) {
      setTeamError(true);
      return;
    }
    setLocalItems([...localItems, { name: newName.trim(), team: newTeam }]);
    setNewName('');
    setNewTeam('');
    setTeamError(false);
  };

  const handleRemove = (index) => {
    setLocalItems(localItems.filter((_, i) => i !== index));
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Monitored Jenkins Jobs</Typography>
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
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">{item.name}</Typography>
                    <Chip
                      label={item.team}
                      size="small"
                      color={TEAM_COLORS[item.team] || 'default'}
                      variant="outlined"
                    />
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
        <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'flex-start' }}>
          <TextField
            size="small"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Jenkins job name"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            sx={{ flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }} error={teamError}>
            <InputLabel>Team *</InputLabel>
            <Select
              value={newTeam}
              label="Team *"
              onChange={(e) => { setNewTeam(e.target.value); setTeamError(false); }}
            >
              {TEAMS.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <IconButton onClick={handleAdd}><AddIcon /></IconButton>
        </Box>
        {teamError && (
          <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
            Team is required
          </Typography>
        )}
        <Button
          variant="contained"
          size="small"
          sx={{ mt: 1 }}
          onClick={() => onSave('monitored_jenkins_jobs', localItems)}
        >
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
      sessionStorage.setItem('pilot_settings_changed', 'true');
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
          <FolderListEditor items={settings.vm_folders} onSave={handleSave} />
          <JobListEditor items={settings.monitored_jenkins_jobs} onSave={handleSave} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ThresholdEditor thresholds={settings.thresholds} onSave={handleSave} />
        </Grid>
      </Grid>
    </Box>
  );
}
