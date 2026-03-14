import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import FileExplorer from './pages/FileExplorer';
import Login from './pages/Login';
import { useAuthStore } from './store/useAuthStore';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/files/root" replace />} />
          <Route path="files/:folderId" element={<FileExplorer />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
