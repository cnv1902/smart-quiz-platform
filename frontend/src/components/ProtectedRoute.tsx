import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const ProtectedRoute = () => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export const AdminRoute = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has admin role
  if (user?.role !== 'admin') {
    return <NotFoundPage />;
  }

  return <Outlet />;
};

// Simple 404 Page for non-admin users
const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-300 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-slate-700 mb-2">Không tìm thấy trang</h2>
        <p className="text-slate-500 mb-6">Trang bạn tìm kiếm không tồn tại hoặc đã bị xóa.</p>
        <a 
          href="/dashboard" 
          className="inline-flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          Về trang chủ
        </a>
      </div>
    </div>
  );
};

export const PublicRoute = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (isAuthenticated) {
    // Check if there's a returnUrl in the query params
    const searchParams = new URLSearchParams(location.search);
    const returnUrl = searchParams.get('returnUrl');
    
    // If there's a returnUrl, navigate to it instead of dashboard
    if (returnUrl) {
      return <Navigate to={decodeURIComponent(returnUrl)} replace />;
    }
    
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
