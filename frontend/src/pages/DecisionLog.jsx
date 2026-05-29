import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button,
  Pagination, CircularProgress,
} from '@mui/material';
import { getDecisions } from '../services/api';
import DecisionEntry from '../components/DecisionEntry';

const PAGE_SIZE = 20;

export default function DecisionLog() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterIntentId, setFilterIntentId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
      if (filterIntentId) params.intent_id = parseInt(filterIntentId, 10);
      const resp = await getDecisions(params);
      setDecisions(resp.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, filterIntentId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Decision Log</Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField
          label="Filter by Intent ID"
          size="small"
          value={filterIntentId}
          onChange={(e) => setFilterIntentId(e.target.value)}
          type="number"
        />
        <Button variant="outlined" onClick={() => { setPage(1); load(); }}>Filter</Button>
        <Button variant="text" onClick={() => { setFilterIntentId(''); setPage(1); }}>Clear</Button>
      </Box>

      <Card>
        <CardContent>
          {loading ? (
            <CircularProgress />
          ) : decisions.length === 0 ? (
            <Typography color="text.secondary">No decisions found</Typography>
          ) : (
            decisions.map((d) => <DecisionEntry key={d.id} decision={d} />)
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Pagination
          count={decisions.length < PAGE_SIZE ? page : page + 1}
          page={page}
          onChange={(_, p) => setPage(p)}
        />
      </Box>
    </Box>
  );
}
