import { useMemo, Fragment } from 'react';
import {
  Card, CardContent, Typography, Skeleton, Box,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { useInfra } from '../../context/InfraContext';
import WidgetInfoTip from '../WidgetInfoTip';

const GROUP_COLORS = {
  Portal: 'primary.main',
  CloudFS: 'success.main',
  Gateway: 'warning.main',
};

const border = '1px solid';
const colBorder = { borderRight: border, borderRightColor: 'divider' };

function calcTotals(folders) {
  const vms = folders.reduce((s, f) => s + (f.count >= 0 ? f.count : 0), 0);
  const on = folders.reduce((s, f) => s + f.powered_on, 0);
  const suspended = folders.reduce((s, f) => s + (f.suspended ?? 0), 0);
  return { vms, on, suspended, off: vms - on - suspended };
}

export default function RunningVms() {
  const { vmCounts, loading } = useInfra();

  const hasData = vmCounts !== null;
  const vmList = vmCounts || [];

  const grouped = useMemo(() => {
    const map = {};
    for (const f of vmList) {
      const g = f.group || 'Ungrouped';
      if (!map[g]) map[g] = [];
      map[g].push(f);
    }
    const order = { Portal: 0, CloudFS: 1, Gateway: 2 };
    return Object.entries(map).sort(([a], [b]) => (order[a] ?? 99) - (order[b] ?? 99));
  }, [vmList]);

  const grand = useMemo(() => calcTotals(vmList), [vmList]);

  const edgeSx = {
    left: { borderLeft: border, borderLeftColor: 'divider' },
    right: { borderRight: border, borderRightColor: 'divider' },
    bottom: { borderBottom: border, borderBottomColor: 'divider' },
    top: { borderTop: border, borderTopColor: 'divider' },
  };

  return (
    <Card>
      <CardContent sx={{ pb: '12px !important' }}>
        <Typography variant="h6" gutterBottom>
          Automation Folders
          <WidgetInfoTip text="Total VM count and power-state breakdown for each monitored vSphere folder, grouped by team." />
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
                  <TableCell sx={colBorder}>Folder</TableCell>
                  <TableCell align="right" sx={colBorder}>VMs</TableCell>
                  <TableCell align="right" sx={colBorder}>Suspended</TableCell>
                  <TableCell align="right" sx={colBorder}>Powered Off</TableCell>
                  <TableCell align="right">Powered On</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {grouped.map(([groupName, folders]) => {
                  const totals = calcTotals(folders);

                  return (
                    <Fragment key={groupName}>
                      {/* Group header */}
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            color: GROUP_COLORS[groupName] || 'text.primary',
                            ...edgeSx.top,
                            ...edgeSx.left,
                            ...edgeSx.right,
                            borderBottom: 'none',
                            borderTopLeftRadius: 6,
                            borderTopRightRadius: 6,
                            pt: 1,
                            pb: 0.5,
                          }}
                        >
                          {groupName}
                        </TableCell>
                      </TableRow>

                      {/* Folder rows */}
                      {folders.map((f) => {
                        const folderName = f.folder.split('/').pop();
                        const suspended = f.suspended ?? 0;
                        const poweredOff = f.count >= 0 ? f.count - f.powered_on - suspended : (f.powered_off ?? 0);
                        return (
                          <TableRow key={f.folder} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                            <TableCell sx={{
                              pl: 3,
                              ...edgeSx.left,
                              ...colBorder,
                              borderBottom: 'none',
                            }}>
                              {folderName}
                            </TableCell>
                            <TableCell align="right" sx={{ ...colBorder, borderBottom: 'none' }}>
                              {f.count >= 0 ? f.count : '?'}
                            </TableCell>
                            <TableCell align="right" sx={{
                              color: suspended > 0 ? 'warning.main' : 'text.secondary',
                              ...colBorder,
                              borderBottom: 'none',
                            }}>
                              {suspended}
                            </TableCell>
                            <TableCell align="right" sx={{
                              color: poweredOff > 0 ? 'error.main' : 'text.secondary',
                              ...colBorder,
                              borderBottom: 'none',
                            }}>
                              {poweredOff}
                            </TableCell>
                            <TableCell align="right" sx={{
                              color: f.powered_on > 0 ? 'success.main' : 'text.secondary',
                              ...edgeSx.right,
                              borderBottom: 'none',
                            }}>
                              {f.powered_on}
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {/* Group totals */}
                      <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
                        <TableCell sx={{
                          pl: 3,
                          fontWeight: 'bold',
                          fontSize: '0.825rem',
                          ...edgeSx.left,
                          ...edgeSx.bottom,
                          ...colBorder,
                          borderTop: border,
                          borderTopColor: 'divider',
                          borderBottomLeftRadius: 6,
                          pb: 1,
                        }}>
                          Total
                        </TableCell>
                        <TableCell align="right" sx={{
                          fontWeight: 'bold',
                          fontSize: '0.825rem',
                          ...edgeSx.bottom,
                          ...colBorder,
                          borderTop: border,
                          borderTopColor: 'divider',
                          pb: 1,
                        }}>
                          {totals.vms}
                        </TableCell>
                        <TableCell align="right" sx={{
                          fontWeight: 'bold',
                          fontSize: '0.825rem',
                          color: totals.suspended > 0 ? 'warning.main' : 'text.secondary',
                          ...edgeSx.bottom,
                          ...colBorder,
                          borderTop: border,
                          borderTopColor: 'divider',
                          pb: 1,
                        }}>
                          {totals.suspended}
                        </TableCell>
                        <TableCell align="right" sx={{
                          fontWeight: 'bold',
                          fontSize: '0.825rem',
                          color: totals.off > 0 ? 'error.main' : 'text.secondary',
                          ...edgeSx.bottom,
                          ...colBorder,
                          borderTop: border,
                          borderTopColor: 'divider',
                          pb: 1,
                        }}>
                          {totals.off}
                        </TableCell>
                        <TableCell align="right" sx={{
                          fontWeight: 'bold',
                          fontSize: '0.825rem',
                          color: totals.on > 0 ? 'success.main' : 'text.secondary',
                          ...edgeSx.right,
                          ...edgeSx.bottom,
                          borderTop: border,
                          borderTopColor: 'divider',
                          borderBottomRightRadius: 6,
                          pb: 1,
                        }}>
                          {totals.on}
                        </TableCell>
                      </TableRow>

                      {/* Spacer between groups */}
                      <TableRow>
                        <TableCell colSpan={5} sx={{ border: 'none', p: 0, height: 8 }} />
                      </TableRow>
                    </Fragment>
                  );
                })}

                {/* Grand total */}
                {vmList.length > 0 && (
                  <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.06)' }}>
                    <TableCell sx={{
                      fontWeight: 'bold',
                      fontSize: '0.925rem',
                      borderTop: '2px solid',
                      borderTopColor: 'divider',
                      borderBottom: 'none',
                      ...colBorder,
                      pt: 1.5,
                    }}>
                      All Folders
                    </TableCell>
                    <TableCell align="right" sx={{
                      fontWeight: 'bold',
                      fontSize: '0.925rem',
                      borderTop: '2px solid',
                      borderTopColor: 'divider',
                      borderBottom: 'none',
                      ...colBorder,
                      pt: 1.5,
                    }}>
                      {grand.vms}
                    </TableCell>
                    <TableCell align="right" sx={{
                      fontWeight: 'bold',
                      fontSize: '0.925rem',
                      color: grand.suspended > 0 ? 'warning.main' : 'text.secondary',
                      borderTop: '2px solid',
                      borderTopColor: 'divider',
                      borderBottom: 'none',
                      ...colBorder,
                      pt: 1.5,
                    }}>
                      {grand.suspended}
                    </TableCell>
                    <TableCell align="right" sx={{
                      fontWeight: 'bold',
                      fontSize: '0.925rem',
                      color: grand.off > 0 ? 'error.main' : 'text.secondary',
                      borderTop: '2px solid',
                      borderTopColor: 'divider',
                      borderBottom: 'none',
                      ...colBorder,
                      pt: 1.5,
                    }}>
                      {grand.off}
                    </TableCell>
                    <TableCell align="right" sx={{
                      fontWeight: 'bold',
                      fontSize: '0.925rem',
                      color: grand.on > 0 ? 'success.main' : 'text.secondary',
                      borderTop: '2px solid',
                      borderTopColor: 'divider',
                      borderBottom: 'none',
                      pt: 1.5,
                    }}>
                      {grand.on}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
