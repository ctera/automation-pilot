import { Tooltip, Box } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export default function WidgetInfoTip({ text }) {
  return (
    <Tooltip title={text} arrow placement="top">
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'help',
          ml: 1,
          verticalAlign: 'middle',
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
      </Box>
    </Tooltip>
  );
}
