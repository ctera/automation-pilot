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
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '1.5px solid',
          borderColor: 'text.disabled',
          cursor: 'help',
          ml: 1,
          verticalAlign: 'middle',
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
      </Box>
    </Tooltip>
  );
}
