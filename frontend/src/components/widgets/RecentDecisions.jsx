import { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getDecisions } from '../../services/api';
import DecisionEntry from '../DecisionEntry';
import WidgetInfoTip from '../WidgetInfoTip';

export default function RecentDecisions() {
  const [decisions, setDecisions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await getDecisions({ limit: 5 });
        setDecisions(resp.data);
      } catch { /* ignore */ }
    };
    load();
  }, []);

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">
            Recent Decisions
            <WidgetInfoTip text="The last 5 decisions made by the pilot's orchestration engine — trigger, queue, preempt, cleanup, or block. Shows the reasoning behind each scheduling action." />
          </Typography>
          <Button size="small" onClick={() => navigate('/decisions')}>View All</Button>
        </Box>
        {decisions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No decisions yet</Typography>
        ) : (
          decisions.map((d) => <DecisionEntry key={d.id} decision={d} />)
        )}
      </CardContent>
    </Card>
  );
}
