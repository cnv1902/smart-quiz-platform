import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  LogOut, 
  Menu, 
  X,
  ChevronRight,
  Home
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Quiz Platform';

const Sidebar = ({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { 
      path: '/dashboard', 
      icon: LayoutDashboard, 
      label: 'Dashboard' 
    },
    { 
      path: '/classes', 
      icon: Users, 
      label: 'Quản lý lớp học' 
    },
    { 
      path: '/exams', 
      icon: FileText, 
      label: 'Quản lý đề thi' 
    },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside 
        className={`fixed left-0 top-0 h-screen bg-white border-r border-slate-200 
                    transition-all duration-200 z-40 flex flex-col
                    ${isCollapsed ? 'lg:w-16' : 'lg:w-64'} 
                    ${isOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    w-64`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
          {!isCollapsed && (
            <span className="text-lg font-semibold text-primary-500">
              {APP_NAME}
            </span>
          )}
          <div className="flex items-center gap-1">
            {/* Close button on mobile */}
            <button 
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors lg:hidden"
            >
              <X size={20} />
            </button>
            {/* Collapse button on desktop */}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors hidden lg:block"
            >
              {isCollapsed ? <Menu size={20} /> : <X size={20} />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all
                 ${isActive 
                   ? 'bg-primary-50 text-primary-600 border border-primary-200' 
                   : 'text-slate-600 hover:bg-slate-50'}`
              }
            >
              <item.icon size={20} />
              {!isCollapsed && <span className="font-medium lg:block">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-slate-200 p-4">
          {!isCollapsed && (
            <div className="mb-3">
              <p className="text-sm font-medium text-slate-700 truncate">
                {user?.full_name || user?.email}
              </p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg
                        text-slate-600 hover:bg-red-50 hover:text-red-600 
                        transition-colors ${isCollapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={20} />
            {!isCollapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Generate breadcrumb based on current path
  const getBreadcrumb = () => {
    const path = location.pathname;
    const breadcrumbs = [{ label: 'Trang chủ', path: '/dashboard', icon: Home }];

    if (path.startsWith('/classes')) {
      breadcrumbs.push({ label: 'Quản lý lớp học', path: '/classes', icon: Users });
      if (path.match(/\/classes\/[^/]+$/)) {
        breadcrumbs.push({ label: 'Chi tiết lớp', path, icon: Users });
      }
    } else if (path.startsWith('/exams')) {
      breadcrumbs.push({ label: 'Quản lý đề thi', path: '/exams', icon: FileText });
      if (path.includes('/create')) {
        breadcrumbs.push({ label: 'Tạo đề thi', path, icon: FileText });
      } else if (path.includes('/edit')) {
        breadcrumbs.push({ label: 'Chỉnh sửa', path, icon: FileText });
      } else if (path.includes('/results')) {
        breadcrumbs.push({ label: 'Kết quả', path, icon: FileText });
      }
    } else if (path === '/dashboard') {
      breadcrumbs.push({ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard });
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumb();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main content */}
      <main className="transition-all duration-200 lg:ml-64">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6">
          {/* Mobile menu button */}
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100 mr-3 lg:hidden"
          >
            <Menu size={20} />
          </button>
          
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.path} className="flex items-center gap-2">
                {index > 0 && <ChevronRight size={14} className="text-slate-400" />}
                <button
                  onClick={() => navigate(crumb.path)}
                  className={`flex items-center gap-1 hover:text-primary-600 transition-colors ${
                    index === breadcrumbs.length - 1 
                      ? 'text-slate-700 font-medium' 
                      : 'text-slate-500'
                  }`}
                >
                  {index === 0 && crumb.icon && <crumb.icon size={14} />}
                  <span className={index === 0 ? 'hidden sm:inline' : ''}>
                    {crumb.label}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </header>

        {/* Page content */}
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
