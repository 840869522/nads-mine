
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ScenarioPage from './pages/ScenarioPage';
import AttackDefensePage from './pages/AttackDefensePage';
import PageWrapper from './components/layout/PageWrapper';
import LearningPage from "./pages/LearningPage.tsx";
import AddQuestionPage from "./pages/AddQuestionPage.tsx";
import ImageManagementPage from "./pages/ImageManagementPage.tsx";
import CourseCasesPage from "./pages/CourseCasesPage.tsx";
import RunningInstancesPage from "./pages/RunningInstancesPage.tsx"; 
import UserManagementPage from "./pages/admin/UserManagementPage.tsx"; // New
import RoleManagementPage from "./pages/admin/RoleManagementPage.tsx";   // New
import ScenarioManagementPage from "@/pages/ScenarioManagementPage.tsx";

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';



const DRAWER_WIDTH = 250; 

const App: React.FC = () => {
  const { user, loading } = useAuth();

  React.useEffect(() => {
    document.documentElement.lang = 'zh-CN'; 
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <CircularProgress size={64} sx={{ mb: 2 }} color="primary" />
        <Typography variant="h6" color="text.secondary">加载中...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {user && <Sidebar drawerWidth={DRAWER_WIDTH} />}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: user ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%' },
          display: 'flex',
          flexDirection: 'column',
          height: '100vh', 
          overflow: 'hidden', 
        }}
      >
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
          <Route path="/" element={user ? <PageWrapper><DashboardPage /></PageWrapper> : <Navigate to="/login" />} />
          <Route path="/learn/quiz" element={user ? <PageWrapper><LearningPage /></PageWrapper> : <Navigate to="/login" />} />
          <Route path="/learn/docs" element={user ? <PageWrapper><AddQuestionPage /></PageWrapper> : <Navigate to="/login" />} />
          <Route path="/learn/cases" element={user ? <PageWrapper><CourseCasesPage /></PageWrapper> : <Navigate to="/login" />} />
          <Route path="/scenario/envirments" element={user ? <PageWrapper><ScenarioPage /></PageWrapper> : <Navigate to="/login" />} />
          <Route path="/scenario/images" element={user ? <PageWrapper><ImageManagementPage /></PageWrapper> : <Navigate to="/login" />} /> 
          <Route path="/scenario/instances" element={user ? <PageWrapper><RunningInstancesPage /></PageWrapper> : <Navigate to="/login" />} />
          <Route path="/drill" element={user ? <PageWrapper><AttackDefensePage /></PageWrapper> : <Navigate to="/login" />} />
          <Route path="/scenario/manage" element={user ? <PageWrapper><ScenarioManagementPage /></PageWrapper> : <Navigate to="/login" />}/>
          {/* Admin Routes */}
          <Route path="/admin/users" element={user ? <PageWrapper><UserManagementPage /></PageWrapper> : <Navigate to="/login" />} />
          <Route path="/admin/roles" element={user ? <PageWrapper><RoleManagementPage /></PageWrapper> : <Navigate to="/login" />} />

          <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default App;
