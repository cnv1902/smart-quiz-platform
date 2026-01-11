import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicRoute, AdminRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './components/Layout';
import { LoginPage, RegisterPage, ForgotPasswordPage } from './pages/Auth';
import { DashboardPage } from './pages/Dashboard';
import { ClassesPage, ClassDetailPage } from './pages/Classes';
import { ExamsPage } from './pages/Exams';
import { CreateExamPage } from './pages/ExamCreate';
import { ExamResultsPage } from './pages/ExamResults';
import { ExamInfoPage, ExamTakePage, LeaderboardPage } from './pages/ExamTake';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Protected Dashboard Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/classes/:classId" element={<ClassDetailPage />} />
          <Route path="/exams" element={<ExamsPage />} />
          <Route path="/exams/create" element={<CreateExamPage />} />
          <Route path="/exams/:examId/edit" element={<CreateExamPage />} />
          <Route path="/exams/:examId/results" element={<ExamResultsPage />} />
        </Route>
      </Route>

      {/* Public Exam Routes (accessible to anyone) */}
      <Route path="/exam/:publicId" element={<ExamInfoPage />} />
      <Route path="/exam/:publicId/take" element={<ExamTakePage />} />
      <Route path="/exam/:publicId/leaderboard" element={<LeaderboardPage />} />

      {/* Admin Routes - Only for admin role */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Route>

      {/* Class Join Route */}
      <Route path="/join-class/:token" element={<JoinClassPage />} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

// Simple Join Class Page
function JoinClassPage() {
  const token = window.location.pathname.split('/').pop();
  
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="card max-w-md text-center">
        <h1 className="text-xl font-bold text-slate-800 mb-4">Xác nhận tham gia lớp học</h1>
        <p className="text-slate-500 mb-6">
          Bạn đang xác nhận lời mời tham gia lớp học. Nhấn nút bên dưới để hoàn tất.
        </p>
        <button 
          onClick={async () => {
            try {
              const response = await fetch(`/api/classes/join/${token}`);
              const data = await response.json();
              if (response.ok) {
                alert(`Đã tham gia lớp: ${data.class_name}`);
                window.location.href = '/';
              } else {
                alert(data.detail || 'Có lỗi xảy ra');
              }
            } catch {
              alert('Có lỗi xảy ra');
            }
          }}
          className="btn-primary"
        >
          Xác nhận tham gia
        </button>
      </div>
    </div>
  );
}

export default App;
