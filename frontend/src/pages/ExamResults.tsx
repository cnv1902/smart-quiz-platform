import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BarChart3, Trophy, Clock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { examsAPI } from '../services/api';
import { ExamResult } from '../types';

export const ExamResultsPage = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [examId]);

  const loadResults = async () => {
    try {
      const response = await examsAPI.getResults(examId!);
      setResults(response.data);
    } catch (error) {
      toast.error('Không thể tải kết quả');
      navigate('/exams');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-50';
    if (score >= 5) return 'text-blue-600 bg-blue-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  // Calculate statistics
  const avgScore = results.length > 0 
    ? results.reduce((sum, r) => sum + r.score, 0) / results.length 
    : 0;
  const highestScore = results.length > 0 
    ? Math.max(...results.map(r => r.score)) 
    : 0;
  const passRate = results.length > 0 
    ? (results.filter(r => r.score >= 5).length / results.length) * 100 
    : 0;

  return (
    <div className="animate-fadeIn">
      <button 
        onClick={() => navigate('/exams')}
        className="text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1"
      >
        ← Quay lại
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Kết quả làm bài</h1>
        <p className="text-slate-500 mt-1">Thống kê chi tiết các lượt làm bài</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <User size={20} className="text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Tổng lượt làm</p>
              <p className="text-xl font-bold text-slate-800">{results.length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <BarChart3 size={20} className="text-green-500" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Điểm TB</p>
              <p className="text-xl font-bold text-slate-800">{avgScore.toFixed(1)}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Trophy size={20} className="text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Điểm cao nhất</p>
              <p className="text-xl font-bold text-slate-800">{highestScore.toFixed(1)}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Clock size={20} className="text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Tỷ lệ đạt</p>
              <p className="text-xl font-bold text-slate-800">{passRate.toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="card overflow-hidden">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Chi tiết kết quả</h2>
        
        {results.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            Chưa có ai làm bài thi này
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">#</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Người làm</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Điểm</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Số câu đúng</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Thời gian</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Ngày làm</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={result.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-600">{index + 1}</td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">
                        {result.user_name || 'Ẩn danh'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-1 rounded font-semibold ${getScoreColor(result.score)}`}>
                        {result.score.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {result.correct_count}/{result.total_questions}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {formatTime(result.time_taken)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-sm">
                      {new Date(result.completed_at).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
