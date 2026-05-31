import {
  Card, CardContent, Typography, Skeleton, Box,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { useInfra } from '../../context/InfraContext';
import WidgetInfoTip from '../WidgetInfoTip';

export default function RunningVms() {
  const { vmCounts, loading } = useInfra();

  const hasData = vmCounts !== null;
  const vmList = vmCounts || [];

  return (
    <Card>
      <CardContent sx={{ pb: '12px !important' }}>
        <Typography variant="h6" gutterBottom>
          VM Folders
          <WidgetInfoTip text="Total VM count and powered-on count for each monitored vSphere folder. Helps gauge how much of the lab is actively in use." />
        </Typography>
        {!hasData && loading ? (
          <Box>
            <Skeleton variant="rectangular" height={24} sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" height={24} sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" height={24} sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" height={24} />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Folder</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Powered On</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {vmList.map((f) => {
                  const folderName = f.folder.split('/').pop();
                  return (
                    <TableRow key={f.folder}>
                      <TableCell>{folderName}</TableCell>
                      <TableCell align="right">
                        {f.count >= 0 ? f.count : '?'}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: f.powered_on > 0 ? 'success.main' : 'text.secondary' }}
                      >
                        {f.powered_on}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
