import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import FileExplorer from './pages/FileExplorer';
import Trash from './pages/Trash';
import Gallery from './pages/Gallery';

import Login from './pages/Login';
import OnlyOfficeEditor from './pages/OnlyOfficeEditor';
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
        <Route path="/editor/:fileId" element={<ProtectedRoute><OnlyOfficeEditor /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/files/root" replace />} />
          <Route path="files/:folderId" element={<FileExplorer />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="starred" element={<Navigate to="/starred/root" replace />} />
          <Route path="starred/:folderId" element={<FileExplorer isStarredView={true} />} />

          <Route path="trash" element={<Navigate to="/trash/root" replace />} />
          <Route path="trash/:folderId" element={<Trash />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
