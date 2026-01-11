import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  FileText, 
  Trash2, 
  Edit2, 
  Clock,
  Users,
  Copy,
  Eye,
  BarChart3
} from 'lucide-react';
import toast from 'react-hot-toast';
import { examsAPI } from '../services/api';
import { ExamListItem } from '../types';
import { useConfirmDialog } from '../components/ConfirmDialog';

export const ExamsPage = () => {
  const navigate = useNavigate();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      const response = await examsAPI.getAll();
      setExams(response.data);
    } catch (error) {
      toast.error('Không thể tải danh sách đề thi');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingIds.has(id)) return;
    
    const confirmed = await confirm('Bạn có chắc chắn muốn xóa đề thi này?', { variant: 'danger' });
    if (!confirmed) return;
    
    // Optimistic update
    const deletedExam = exams.find(e => e.id === id);
    setExams(prev => prev.filter(e => e.id !== id));
    setDeletingIds(prev => new Set(prev).add(id));
    toast.success('Xóa đề thi thành công!');
    
    try {
      await examsAPI.delete(id);
    } catch (error) {
      // Rollback on error
      if (deletedExam) {
        setExams(prev => [...prev, deletedExam]);
      }
      toast.error('Xóa đề thi thất bại');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const copyLink = async (publicId: string) => {
    const link = `${window.location.origin}/exam/${publicId}`;
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
        toast.success('Đã sao chép link!');
      } else {
        // Fallback for non-secure contexts (HTTP)
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          toast.success('Đã sao chép link!');
        } else {
          toast.error('Không thể sao chép. Vui lòng copy thủ công: ' + link);
        }
      }
    } catch (err) {
      console.error('Copy failed:', err);
      toast.error('Không thể sao chép. Link: ' + link);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Quản lý đề thi</h1>
          <p className="text-sm lg:text-base text-slate-500 mt-1">Tạo và quản lý các đề thi trắc nghiệm</p>
        </div>
        <button 
          onClick={() => navigate('/exams/create')}
          className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus size={20} />
          Tạo đề thi
        </button>
      </div>

      {/* Exam List */}
      {exams.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="mx-auto text-slate-300" size={48} />
          <p className="text-slate-500 mt-4">Chưa có đề thi nào</p>
          <button 
            onClick={() => navigate('/exams/create')}
            className="btn-primary mt-4"
          >
            Tạo đề thi đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => (
            <div 
              key={exam.id} 
              className="card-hover"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 text-base lg:text-lg truncate">{exam.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                      exam.mode === 'practice' 
                        ? 'bg-green-50 text-green-600' 
                        : 'bg-blue-50 text-blue-600'
                    }`}>
                      {exam.mode === 'practice' ? 'Luyện tập' : 'Kiểm tra'}
                    </span>
                    {exam.is_public && (
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-600 flex-shrink-0">
                        Công khai
                      </span>
                    )}
                  </div>
                  {exam.description && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">{exam.description}</p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-3 lg:gap-6 mt-3 text-xs lg:text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <FileText size={14} />
                      {exam.question_count} câu
                    </span>
                    {exam.time_limit && (
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {exam.time_limit} phút
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {exam.total_attempts} lượt
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 flex-shrink-0">
                  <button
                    onClick={() => copyLink(exam.public_id)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Copy link"
                  >
                    <Copy size={18} className="text-slate-500" />
                  </button>
                  <button
                    onClick={() => window.open(`/exam/${exam.public_id}`, '_blank')}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Xem trước"
                  >
                    <Eye size={18} className="text-slate-500" />
                  </button>
                  <button
                    onClick={() => navigate(`/exams/${exam.id}/results`)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Kết quả"
                  >
                    <BarChart3 size={18} className="text-slate-500" />
                  </button>
                  <button
                    onClick={() => navigate(`/exams/${exam.id}/edit`)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Chỉnh sửa"
                  >
                    <Edit2 size={18} className="text-slate-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(exam.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Xóa"
                  >
                    <Trash2 size={18} className="text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <ConfirmDialogComponent />
    </div>
  );
};
