import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';
import './designs/modern/modern.css';
import './theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname.replace(/\/$/, '') === '/dashboard' ? <AdminDashboard /> : <App />}
  </StrictMode>,
);
