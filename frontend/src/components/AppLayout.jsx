import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Toolbar, Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import ScheduleIcon from '@mui/icons-material/Schedule';

function AppLogo() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
          '&:hover': { transform: 'rotate(90deg)' },
        }}
      >
        <svg width="30" height="30" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5C9DFF" />
              <stop offset="100%" stopColor="#A78BFA" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="44" stroke="url(#logoGrad)" strokeWidth="5" opacity="0.3" />
          <circle cx="50" cy="50" r="6" fill="url(#logoGrad)" />
          <path d="M50 10 L54 46 L50 50 L46 46 Z" fill="url(#logoGrad)" />
          <path d="M90 50 L54 54 L50 50 L54 46 Z" fill="url(#logoGrad)" opacity="0.8" />
          <path d="M50 90 L46 54 L50 50 L54 54 Z" fill="url(#logoGrad)" opacity="0.6" />
          <path d="M10 50 L46 46 L50 50 L46 54 Z" fill="url(#logoGrad)" opacity="0.8" />
        </svg>
      </Box>
      <Box component="span" sx={{ display: 'flex', alignItems: 'baseline', gap: 0.3 }}>
        <Typography
          component="span"
          sx={{
            fontSize: '1.35rem',
            fontWeight: 300,
            letterSpacing: '-0.02em',
            color: 'text.secondary',
          }}
        >
          automation
        </Typography>
        <Typography
          component="span"
          sx={{
            fontSize: '1.35rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #5C9DFF 0%, #A78BFA 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          pilot
        </Typography>
      </Box>
    </Box>
  );
}

const DRAWER_WIDTH = 220;

const navItems = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { label: 'Decision Log', path: '/decisions', icon: <ListAltIcon /> },
  { label: 'Portal Triggers', path: '/triggers', icon: <ScheduleIcon /> },
  { label: 'Settings', path: '/settings', icon: <SettingsIcon /> },
];

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(!drawerOpen)} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <AppLogo />
        </Toolbar>
      </AppBar>

      <Drawer
        variant="persistent"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', mt: '64px' },
        }}
      >
        <List>
          {navItems.map((item) => (
            <ListItemButton
              key={item.path}
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 1.5,
          mt: '64px',
          ml: drawerOpen ? 0 : `-${DRAWER_WIDTH}px`,
          transition: 'margin 0.2s',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
