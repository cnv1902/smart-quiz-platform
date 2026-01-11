import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Users, 
  Trash2, 
  Edit2, 
  Mail, 
  Check, 
  X,
  Clock,
  FileText,
  Eye,
  BarChart3,
  Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { classesAPI } from '../services/api';
import { ClassListItem, Class } from '../types';
import { useAuthStore } from '../store/authStore';
import { useConfirmDialog } from '../components/ConfirmDialog';

// Modal Component
const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-lg shadow-lift w-full max-w-md mx-4 animate-slideUp">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export const ClassesPage = () => {
  const navigate = useNavigate();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassListItem | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const response = await classesAPI.getAll();
      setClasses(response.data);
    } catch (error) {
      toast.error('Không thể tải danh sách lớp học');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    
    // Optimistic update: add to list immediately
    const tempId = `temp_${Date.now()}`;
    const optimisticClass: ClassListItem = {
      id: tempId,
      name: formData.name,
      description: formData.description || null,
      student_count: 0,
      created_at: new Date().toISOString(),
      role: 'teacher'
    };
    
    setClasses(prev => [optimisticClass, ...prev]);
    setShowCreateModal(false);
    setFormData({ name: '', description: '' });
    toast.success('Tạo lớp học thành công!');
    
    try {
      await classesAPI.create(formData);
      // Reload to get real data
      loadClasses();
    } catch (error) {
      // Rollback on error
      setClasses(prev => prev.filter(c => c.id !== tempId));
      toast.error('Tạo lớp học thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || submitting) return;
    setSubmitting(true);
    
    // Optimistic update
    const oldClass = classes.find(c => c.id === selectedClass.id);
    setClasses(prev => prev.map(c => 
      c.id === selectedClass.id 
        ? { ...c, name: formData.name, description: formData.description || null }
        : c
    ));
    setShowEditModal(false);
    toast.success('Cập nhật thành công!');
    
    try {
      await classesAPI.update(selectedClass.id, formData);
    } catch (error) {
      // Rollback on error
      if (oldClass) {
        setClasses(prev => prev.map(c => c.id === selectedClass.id ? oldClass : c));
      }
      toast.error('Cập nhật thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm('Bạn có chắc chắn muốn xóa lớp học này?', { variant: 'danger' });
    if (!confirmed) return;
    
    // Optimistic update
    const deletedClass = classes.find(c => c.id === id);
    setClasses(prev => prev.filter(c => c.id !== id));
    toast.success('Xóa lớp học thành công!');
    
    try {
      await classesAPI.delete(id);
    } catch (error) {
      // Rollback on error
      if (deletedClass) {
        setClasses(prev => [...prev, deletedClass]);
      }
      toast.error('Xóa lớp học thất bại');
    }
  };

  const openEditModal = (cls: ClassListItem) => {
    setSelectedClass(cls);
    setFormData({ name: cls.name, description: cls.description || '' });
    setShowEditModal(true);
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
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Quản lý lớp học</h1>
          <p className="text-sm lg:text-base text-slate-500 mt-1">Quản lý các lớp học và học sinh</p>
        </div>
        <button 
          onClick={() => {
            setFormData({ name: '', description: '' });
            setShowCreateModal(true);
          }}
          className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus size={20} />
          Tạo lớp mới
        </button>
      </div>

      {/* Class List */}
      {classes.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="mx-auto text-slate-300" size={48} />
          <p className="text-slate-500 mt-4">Chưa có lớp học nào</p>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn-primary mt-4"
          >
            Tạo lớp đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <div 
              key={cls.id} 
              className="card-hover cursor-pointer"
              onClick={() => navigate(`/classes/${cls.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{cls.name}</h3>
                    {cls.role === 'student' && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded">
                        Học sinh
                      </span>
                    )}
                  </div>
                  {cls.description && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                      {cls.description}
                    </p>
                  )}
                </div>
                {cls.role === 'teacher' && (
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(cls);
                      }}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} className="text-slate-500" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(cls.id);
                      }}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Users size={16} />
                  <span>{cls.student_count} học sinh</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock size={16} />
                  <span>{new Date(cls.created_at).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal 
        isOpen={showCreateModal} 
        onClose={() => !submitting && setShowCreateModal(false)}
        title="Tạo lớp học mới"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Tên lớp học *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              placeholder="Ví dụ: Lớp 12A1"
              disabled={submitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Mô tả
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field resize-none"
              rows={3}
              placeholder="Mô tả về lớp học..."
              disabled={submitting}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => setShowCreateModal(false)} 
              className="btn-secondary flex-1"
              disabled={submitting}
            >
              Hủy
            </button>
            <button 
              type="submit" 
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              {submitting ? 'Đang tạo...' : 'Tạo lớp'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal 
        isOpen={showEditModal} 
        onClose={() => !submitting && setShowEditModal(false)}
        title="Chỉnh sửa lớp học"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Tên lớp học *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              disabled={submitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Mô tả
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field resize-none"
              rows={3}
              disabled={submitting}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => setShowEditModal(false)} 
              className="btn-secondary flex-1"
              disabled={submitting}
            >
              Hủy
            </button>
            <button 
              type="submit" 
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>
      
      <ConfirmDialogComponent />
    </div>
  );
};

// Class Detail Page
export const ClassDetailPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [classData, setClassData] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);
  const [removingStudentIds, setRemovingStudentIds] = useState<Set<string>>(new Set());
  const classId = window.location.pathname.split('/').pop() || '';

  // Check if current user is teacher
  const isTeacher = classData?.teacher_id === user?.id;

  useEffect(() => {
    loadClass();
  }, [classId]);

  const loadClass = async () => {
    try {
      const response = await classesAPI.getOne(classId);
      setClassData(response.data);
    } catch (error) {
      toast.error('Không thể tải thông tin lớp học');
      navigate('/classes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addingStudent) return;
    setAddingStudent(true);
    
    // Optimistic update - add student immediately
    const tempStudent = {
      id: `temp_${Date.now()}`,
      student_email: studentEmail,
      is_verified: false,
      joined_at: new Date().toISOString()
    };
    
    const emailToAdd = studentEmail;
    
    if (classData) {
      setClassData({
        ...classData,
        students: [...classData.students, tempStudent]
      });
    }
    setStudentEmail('');
    setShowAddStudent(false);
    toast.success('Đã gửi lời mời đến học sinh!');
    
    try {
      await classesAPI.addStudent(classId, emailToAdd);
      // Reload to get real data
      loadClass();
    } catch (error: any) {
      // Rollback on error
      if (classData) {
        setClassData({
          ...classData,
          students: classData.students.filter(s => s.id !== tempStudent.id)
        });
      }
      toast.error(error.response?.data?.detail || 'Thêm học sinh thất bại');
    } finally {
      setAddingStudent(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (removingStudentIds.has(studentId)) return;
    
    const confirmed = await confirm('Xóa học sinh này khỏi lớp?', { variant: 'danger' });
    if (!confirmed) return;
    
    // Optimistic update
    const removedStudent = classData?.students.find(s => s.id === studentId);
    if (classData) {
      setClassData({
        ...classData,
        students: classData.students.filter(s => s.id !== studentId)
      });
    }
    setRemovingStudentIds(prev => new Set(prev).add(studentId));
    toast.success('Đã xóa học sinh');
    
    try {
      await classesAPI.removeStudent(classId, studentId);
    } catch (error) {
      // Rollback on error
      if (classData && removedStudent) {
        setClassData({
          ...classData,
          students: [...classData.students, removedStudent]
        });
      }
      toast.error('Xóa học sinh thất bại');
    } finally {
      setRemovingStudentIds(prev => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!classData) return null;

  return (
    <div className="animate-fadeIn">
      <button 
        onClick={() => navigate('/classes')}
        className="text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1"
      >
        ← Quay lại
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800">{classData.name}</h1>
          {classData.description && (
            <p className="text-sm lg:text-base text-slate-500 mt-1">{classData.description}</p>
          )}
        </div>
        {isTeacher && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button 
              onClick={() => navigate(`/exams/create?classId=${classId}`)}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <FileText size={20} />
              <span className="whitespace-nowrap">Tạo đề thi</span>
            </button>
            <button 
              onClick={() => setShowAddStudent(true)}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Mail size={20} />
              <span className="whitespace-nowrap">Thêm học sinh</span>
            </button>
          </div>
        )}
      </div>

      {/* Students List */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Danh sách học sinh ({classData.students.length})
        </h2>

        {classData.students.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Users size={40} className="mx-auto mb-2 text-slate-300" />
            <p>Chưa có học sinh nào</p>
          </div>
        ) : (
          <div className="space-y-2">
            {classData.students.map((student) => (
              <div 
                key={student.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <Mail size={18} className="text-primary-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">{student.student_email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {student.is_verified ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                          <Check size={12} /> Đã xác thực
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
                          <Clock size={12} /> Chờ xác thực
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isTeacher && (
                  <button
                    onClick={() => handleRemoveStudent(student.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exams List */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Danh sách đề thi ({classData.exams?.length || 0})
        </h2>

        {!classData.exams || classData.exams.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <FileText size={40} className="mx-auto mb-2 text-slate-300" />
            <p>Chưa có đề thi nào</p>
            {isTeacher && (
              <button 
                onClick={() => navigate(`/exams/create?classId=${classId}`)}
                className="btn-primary mt-4 mx-auto flex items-center gap-2"
              >
                <Plus size={18} />
                Tạo đề thi đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {classData.exams.map((exam) => (
              <div 
                key={exam.id}
                className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-800">{exam.title}</h3>
                    {exam.description && (
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{exam.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
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
                  
                  <div className="flex items-center gap-1">
                    {isTeacher && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/exam/${exam.public_id}`);
                          toast.success('Đã sao chép link!');
                        }}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                        title="Sao chép link"
                      >
                        <Copy size={16} className="text-slate-500" />
                      </button>
                    )}
                    <button
                      onClick={() => window.open(`/exam/${exam.public_id}`, '_blank')}
                      className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                      title="Làm bài"
                    >
                      <Eye size={16} className="text-slate-500" />
                    </button>
                    <button
                      onClick={() => navigate(`/exams/${exam.id}/results`)}
                      className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                      title="Kết quả"
                    >
                      <BarChart3 size={16} className="text-slate-500" />
                    </button>
                    {isTeacher && (
                      <button
                        onClick={() => navigate(`/exams/${exam.id}/edit`)}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Edit2 size={16} className="text-slate-500" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      <Modal 
        isOpen={showAddStudent} 
        onClose={() => !addingStudent && setShowAddStudent(false)}
        title="Thêm học sinh"
      >
        <form onSubmit={handleAddStudent} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email học sinh *
            </label>
            <input
              type="email"
              required
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              className="input-field"
              placeholder="hocsinh@example.com"
              disabled={addingStudent}
            />
            <p className="text-xs text-slate-500 mt-1">
              Một email mời sẽ được gửi đến địa chỉ này
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => setShowAddStudent(false)} 
              className="btn-secondary flex-1"
              disabled={addingStudent}
            >
              Hủy
            </button>
            <button 
              type="submit" 
              disabled={addingStudent}
              className="btn-primary flex-1"
            >
              {addingStudent ? 'Đang gửi...' : 'Gửi lời mời'}
            </button>
          </div>
        </form>
      </Modal>
      
      <ConfirmDialogComponent />
    </div>
  );
};
