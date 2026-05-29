import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { InfraProvider } from './context/InfraContext';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import DecisionLog from './pages/DecisionLog';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <InfraProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="decisions" element={<DecisionLog />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </InfraProvider>
    </ThemeProvider>
  );
}
