import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import { StatusProvider } from './context/StatusContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Kanban from './pages/Kanban';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import Dashboard from './pages/Dashboard';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Kanban /> },
      { path: '/contatos', element: <Leads /> },
      { path: '/contatos/:id', element: <LeadDetail /> },
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/integracoes', element: <Integrations /> },
      { path: '/configuracoes', element: <Settings /> },
    ],
  },
]);

function AuthGate() {
  const { loading, enabled, user } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-900">
        <span className="font-brand text-2xl font-light tracking-wide text-cream/60">A&amp;L</span>
      </div>
    );
  }
  if (enabled && !user) return <Login />;
  return (
    <StatusProvider>
      <RouterProvider router={router} />
    </StatusProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  </React.StrictMode>
);
