import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import { StatusProvider } from './context/StatusContext';
import Layout from './components/Layout';
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StatusProvider>
      <RouterProvider router={router} />
    </StatusProvider>
  </React.StrictMode>
);
