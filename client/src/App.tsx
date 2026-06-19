import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Toaster } from '@/components/ui/toaster';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AnalyzePage } from '@/pages/AnalyzePage';
import { AnalysisDetailPage } from '@/pages/AnalysisDetailPage';
import { useAuthStore } from '@/store/auth-store';

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { loadUser } = useAuthStore();
  useEffect(() => { loadUser(); }, [loadUser]);
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppInitializer>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/dashboard"
              element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
            />
            <Route
              path="/analyze"
              element={<ProtectedRoute><AnalyzePage /></ProtectedRoute>}
            />
            <Route
              path="/analysis/:id"
              element={<ProtectedRoute><AnalysisDetailPage /></ProtectedRoute>}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </AppInitializer>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
