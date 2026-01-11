import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileText, 
  Check, 
  Plus,
  Trash2,
  Save,
  Clock,
  Lock,
  Shuffle,
  Globe,
  AlertCircle,
  Users,
  Copy,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { examsAPI, classesAPI } from '../services/api';
import { Question, ExamConfig, ClassListItem, Exam } from '../types';

// File Dropzone Component
const FileDropzone = ({ onParsed }: { onParsed: (questions: Question[]) => void }) => {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setParsing(true);
    setError(null);

    try {
      const response = await examsAPI.parseFile(file);
      const { success, questions, error: parseError, total_parsed } = response.data;

      if (success && questions.length > 0) {
        // Convert to proper Question format
        const formattedQuestions: Question[] = questions.map((q: any) => ({
          id: q.id,
          text: q.text,
          options: q.options.map((opt: any) => ({
            id: opt.id,
            text: opt.text,
            is_correct: opt.is_correct || false
          }))
        }));
        
        onParsed(formattedQuestions);
        toast.success(`Đã phân tích ${total_parsed} câu hỏi từ file!`);
      } else {
        setError(parseError || 'Không tìm thấy câu hỏi trong file');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Lỗi khi phân tích file');
    } finally {
      setParsing(false);
    }
  }, [onParsed]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/plain': ['.txt']
    },
    maxFiles: 1
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
        ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-primary-400'}
        ${error ? 'border-red-300 bg-red-50' : ''}`}
    >
      <input {...getInputProps()} />
      
      {parsing ? (
        <div>
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent mx-auto"></div>
          <p className="text-slate-600 mt-3">Đang phân tích file...</p>
        </div>
      ) : error ? (
        <div>
          <AlertCircle size={40} className="mx-auto text-red-400" />
          <p className="text-red-600 mt-3">{error}</p>
          <p className="text-sm text-slate-500 mt-1">Nhấp để thử lại</p>
        </div>
      ) : (
        <div>
          <Upload size={40} className="mx-auto text-slate-400" />
          <p className="text-slate-600 mt-3 font-medium">
            {isDragActive ? 'Thả file vào đây...' : 'Kéo thả file vào đây hoặc nhấp để chọn'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Hỗ trợ: Word (.docx), Excel (.xlsx), Text (.txt)
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Định dạng: Câu [số]: [Nội dung] | a. b. c. d. [Đáp án] | <strong>In đậm = Đáp án đúng</strong>
          </p>
        </div>
      )}
    </div>
  );
};

// Question Editor Component
const QuestionEditor = ({ 
  question, 
  index, 
  onChange, 
  onDelete 
}: { 
  question: Question; 
  index: number;
  onChange: (updated: Question) => void;
  onDelete: () => void;
}) => {
  const hasCorrectAnswer = question.options.some(opt => opt.is_correct);
  const hasEmptyOptions = question.options.some(opt => !opt.text.trim());
  const hasEmptyQuestion = !question.text.trim();

  const handleTextChange = (optionId: string, text: string) => {
    const updatedOptions = question.options.map(opt => 
      opt.id === optionId ? { ...opt, text } : opt
    );
    onChange({ ...question, options: updatedOptions });
  };

  const handleCorrectChange = (optionId: string) => {
    const updatedOptions = question.options.map(opt => ({
      ...opt,
      is_correct: opt.id === optionId
    }));
    onChange({ ...question, options: updatedOptions });
  };

  return (
    <div className={`card mb-4 animate-slideUp transition-all ${
      (!hasCorrectAnswer || hasEmptyOptions || hasEmptyQuestion) 
        ? 'border-amber-300 bg-amber-50/30' 
        : ''
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm ${
            (!hasCorrectAnswer || hasEmptyOptions || hasEmptyQuestion)
              ? 'bg-amber-100 text-amber-600'
              : 'bg-primary-100 text-primary-600'
          }`}>
            {index + 1}
          </span>
          <span className="text-sm text-slate-500">Câu hỏi</span>
          {(!hasCorrectAnswer || hasEmptyOptions || hasEmptyQuestion) && (
            <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle size={12} />
              Chưa hoàn thành
            </span>
          )}
        </div>
        <button
          onClick={onDelete}
          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 size={16} className="text-red-500" />
        </button>
      </div>

      <div className="mb-4">
        <textarea
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          className={`input-field resize-none ${hasEmptyQuestion ? 'border-amber-300' : ''}`}
          rows={2}
          placeholder="Nhập nội dung câu hỏi..."
        />
        {hasEmptyQuestion && (
          <p className="text-amber-600 text-xs mt-1">Vui lòng nhập nội dung câu hỏi</p>
        )}
      </div>

      <div className="space-y-2">
        {question.options.map((option, optIndex) => (
          <div
            key={option.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer
              ${option.is_correct 
                ? 'border-primary-500 bg-primary-50 shadow-sm' 
                : !option.text.trim()
                  ? 'border-amber-300 bg-amber-50/50'
                  : 'border-slate-200 hover:border-slate-300'}`}
            onClick={() => handleCorrectChange(option.id)}
          >
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
              ${option.is_correct 
                ? 'border-primary-500 bg-primary-500' 
                : 'border-slate-300'}`}
            >
              {option.is_correct && <Check size={14} className="text-white" />}
            </div>
            <span className="text-sm font-medium text-slate-500 w-6">
              {String.fromCharCode(65 + optIndex)}.
            </span>
            <input
              type="text"
              value={option.text}
              onChange={(e) => handleTextChange(option.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className={`flex-1 bg-transparent border-none outline-none text-slate-700 ${
                !option.text.trim() ? 'placeholder:text-amber-400' : ''
              }`}
              placeholder={`Đáp án ${String.fromCharCode(65 + optIndex)}`}
            />
          </div>
        ))}
      </div>

      {!hasCorrectAnswer && (
        <p className="text-amber-600 text-xs mt-3 flex items-center gap-1">
          <AlertCircle size={12} />
          Chưa chọn đáp án đúng - Nhấp vào đáp án để chọn
        </p>
      )}
      {hasCorrectAnswer && (
        <p className="text-xs text-slate-400 mt-3">
          💡 Nhấp vào đáp án để chọn làm đáp án đúng
        </p>
      )}
    </div>
  );
};

// Main Create Exam Page
export const CreateExamPage = () => {
  const navigate = useNavigate();
  const { examId } = useParams<{ examId: string }>();
  const [searchParams] = useSearchParams();
  const presetClassId = searchParams.get('classId');
  
  const isEditMode = !!examId;
  const titleInputRef = useRef<HTMLInputElement>(null);
  const questionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  const [step, setStep] = useState<'upload' | 'edit' | 'config'>(isEditMode ? 'edit' : 'upload');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditMode);
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdExamLink, setCreatedExamLink] = useState('');
  const [config, setConfig] = useState<ExamConfig>({
    mode: 'test',
    shuffle_questions: false,
    shuffle_answers: false,
    time_limit: null,
    password: null,
    is_public: presetClassId ? false : true,
    class_id: presetClassId || null
  });

  // Load exam data if in edit mode
  useEffect(() => {
    if (isEditMode && examId) {
      loadExamData();
    }
  }, [examId, isEditMode]);

  const loadExamData = async () => {
    try {
      setLoading(true);
      const response = await examsAPI.getOne(examId!);
      const exam: Exam = response.data;
      
      setTitle(exam.title);
      setDescription(exam.description || '');
      setQuestions(exam.questions);
      setConfig({
        mode: exam.mode as 'practice' | 'test',
        shuffle_questions: exam.shuffle_questions,
        shuffle_answers: exam.shuffle_answers,
        time_limit: exam.time_limit,
        password: null, // Don't load password for security
        is_public: exam.is_public,
        class_id: (exam as any).class_id || null
      });
      setStep('edit');
    } catch (error) {
      toast.error('Không thể tải thông tin đề thi');
      navigate('/exams');
    } finally {
      setLoading(false);
    }
  };

  // Load classes for assignment dropdown
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const response = await classesAPI.getAll();
        setClasses(response.data);
      } catch (error) {
        console.error('Failed to load classes:', error);
      }
    };
    loadClasses();
  }, []);

  // Scroll to element with error
  const scrollToError = (elementRef: HTMLElement | null) => {
    if (elementRef) {
      elementRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
      elementRef.classList.add('ring-2', 'ring-red-500');
      setTimeout(() => {
        elementRef.classList.remove('ring-2', 'ring-red-500');
      }, 3000);
    }
  };

  // Validate questions before going to config step
  const validateBeforeConfig = (): boolean => {
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề đề thi');
      scrollToError(titleInputRef.current);
      return false;
    }
    
    if (questions.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 câu hỏi');
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const questionRef = questionRefs.current[questions[i].id];
      
      if (!questions[i].text.trim()) {
        toast.error(`Câu ${i + 1} chưa có nội dung`);
        scrollToError(questionRef);
        return false;
      }
      
      // Check if all options have text
      const emptyOptions = questions[i].options.filter(opt => !opt.text.trim());
      if (emptyOptions.length > 0) {
        toast.error(`Câu ${i + 1} có đáp án chưa nhập nội dung`);
        scrollToError(questionRef);
        return false;
      }
      
      const hasCorrect = questions[i].options.some(opt => opt.is_correct);
      if (!hasCorrect) {
        toast.error(`Câu ${i + 1} chưa chọn đáp án đúng (nhấp vào đáp án để chọn)`);
        scrollToError(questionRef);
        return false;
      }
    }
    
    return true;
  };

  const handleParsed = (parsed: Question[]) => {
    setQuestions(parsed);
    setStep('edit');
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: `q_${Date.now()}`,
      text: '',
      options: [
        { id: `opt_${Date.now()}_0`, text: '', is_correct: true },
        { id: `opt_${Date.now()}_1`, text: '', is_correct: false },
        { id: `opt_${Date.now()}_2`, text: '', is_correct: false },
        { id: `opt_${Date.now()}_3`, text: '', is_correct: false },
      ]
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updated: Question) => {
    const newQuestions = [...questions];
    newQuestions[index] = updated;
    setQuestions(newQuestions);
  };

  const deleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề đề thi');
      scrollToError(titleInputRef.current);
      return;
    }

    if (questions.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 câu hỏi');
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const questionRef = questionRefs.current[questions[i].id];
      
      if (!questions[i].text.trim()) {
        toast.error(`Câu ${i + 1} chưa có nội dung`);
        scrollToError(questionRef);
        return;
      }
      const hasCorrect = questions[i].options.some(opt => opt.is_correct);
      if (!hasCorrect) {
        toast.error(`Câu ${i + 1} chưa chọn đáp án đúng`);
        scrollToError(questionRef);
        return;
      }
    }

    setSaving(true);
    try {
      // Prepare config - remove null values that might cause issues
      const cleanConfig = {
        ...config,
        password: config.password || undefined,
        time_limit: config.time_limit || undefined,
        class_id: config.class_id || undefined
      };
      
      let response;
      if (isEditMode && examId) {
        // Update existing exam
        response = await examsAPI.update(examId, {
          title: title.trim(),
          description: description.trim() || undefined,
          questions,
          config: cleanConfig
        });
        toast.success('Cập nhật đề thi thành công!');
      } else {
        // Create new exam
        response = await examsAPI.create({
          title: title.trim(),
          description: description.trim() || undefined,
          questions,
          config: cleanConfig
        });
        toast.success('Tạo đề thi thành công!');
      }
      
      // Show success modal with link
      const examPublicId = response.data.public_id;
      const examLink = `${window.location.origin}/exam/${examPublicId}`;
      setCreatedExamLink(examLink);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Save exam error:', error.response?.data);
      const errorDetail = error.response?.data?.detail;
      if (Array.isArray(errorDetail)) {
        // Pydantic validation errors
        const msg = errorDetail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join(', ');
        toast.error(`Lỗi: ${msg}`);
      } else {
        toast.error(errorDetail || (isEditMode ? 'Cập nhật đề thi thất bại' : 'Tạo đề thi thất bại'));
      }
    } finally {
      setSaving(false);
    }
  };

  // Show loading state for edit mode
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto"></div>
          <p className="text-slate-500 mt-4">Đang tải đề thi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          {isEditMode ? 'Chỉnh sửa đề thi' : 'Tạo đề thi mới'}
        </h1>
        <p className="text-slate-500 mt-1">
          {isEditMode 
            ? 'Chỉnh sửa nội dung và cấu hình đề thi'
            : 'Upload file Word/Excel hoặc nhập câu hỏi thủ công'
          }
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-4 mb-6">
        {(isEditMode ? ['edit', 'config'] : ['upload', 'edit', 'config']).map((s, i) => (
          <div 
            key={s}
            onClick={() => {
              // Allow clicking to navigate between completed steps
              if (s === 'edit' || (s === 'upload' && !isEditMode)) {
                setStep(s as 'upload' | 'edit' | 'config');
              } else if (s === 'config' && questions.length > 0) {
                if (validateBeforeConfig()) {
                  setStep('config');
                }
              }
            }}
            className={`flex items-center gap-2 cursor-pointer transition-colors ${
              step === s ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
              ${step === s ? 'bg-primary-500 text-white' : 'bg-slate-200 hover:bg-slate-300'}`}>
              {isEditMode ? i + 1 : i + 1}
            </div>
            <span className="font-medium">
              {s === 'upload' ? 'Tải file' : s === 'edit' ? 'Chỉnh sửa' : 'Cấu hình'}
            </span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === 'upload' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Tải lên file đề thi
          </h2>
          <FileDropzone onParsed={handleParsed} />
          
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-500 mb-3">Hoặc tạo đề thi thủ công</p>
            <button 
              onClick={() => {
                addQuestion();
                setStep('edit');
              }}
              className="btn-secondary flex items-center gap-2"
            >
              <Plus size={18} />
              Nhập câu hỏi thủ công
            </button>
          </div>
        </div>
      )}

      {step === 'edit' && (
        <div>
          {/* Title & Description */}
          <div className="card mb-4">
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tiêu đề đề thi <span className="text-red-500">*</span>
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`input-field ${!title.trim() ? 'border-amber-300' : ''}`}
                  placeholder="Ví dụ: Kiểm tra 15 phút - Chương 1"
                />
                {!title.trim() && (
                  <p className="text-amber-600 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    Bắt buộc nhập tiêu đề
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Mô tả
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field resize-none"
                  rows={2}
                  placeholder="Mô tả về đề thi..."
                />
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              Danh sách câu hỏi ({questions.length})
            </h2>
            <button 
              onClick={addQuestion}
              className="btn-secondary flex items-center gap-2"
            >
              <Plus size={18} />
              Thêm câu hỏi
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="card text-center py-8">
              <FileText size={40} className="mx-auto text-slate-300" />
              <p className="text-slate-500 mt-2">Chưa có câu hỏi nào</p>
            </div>
          ) : (
            questions.map((q, i) => (
              <div 
                key={q.id} 
                ref={(el) => { questionRefs.current[q.id] = el; }}
              >
                <QuestionEditor
                  question={q}
                  index={i}
                  onChange={(updated) => updateQuestion(i, updated)}
                  onDelete={() => deleteQuestion(i)}
                />
              </div>
            ))
          )}

          <div className="flex justify-end gap-3 mt-6">
            {!isEditMode && (
              <button 
                onClick={() => setStep('upload')}
                className="btn-secondary"
              >
                Quay lại
              </button>
            )}
            <button 
              onClick={() => {
                if (validateBeforeConfig()) {
                  setStep('config');
                }
              }}
              disabled={questions.length === 0}
              className="btn-primary"
            >
              Tiếp tục
            </button>
          </div>
        </div>
      )}

      {step === 'config' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">Cấu hình đề thi</h2>
          
          <div className="space-y-6">
            {/* Mode */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Chế độ làm bài
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfig({ ...config, mode: 'test' })}
                  className={`p-4 rounded-lg border-2 text-left transition-all
                    ${config.mode === 'test' 
                      ? 'border-primary-500 bg-primary-50' 
                      : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <FileText size={24} className={config.mode === 'test' ? 'text-primary-500' : 'text-slate-400'} />
                  <p className="font-medium mt-2">Kiểm tra</p>
                  <p className="text-sm text-slate-500">Nộp bài một lần, xem kết quả cuối</p>
                </button>
                <button
                  onClick={() => setConfig({ ...config, mode: 'practice' })}
                  className={`p-4 rounded-lg border-2 text-left transition-all
                    ${config.mode === 'practice' 
                      ? 'border-primary-500 bg-primary-50' 
                      : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <Check size={24} className={config.mode === 'practice' ? 'text-primary-500' : 'text-slate-400'} />
                  <p className="font-medium mt-2">Luyện tập</p>
                  <p className="text-sm text-slate-500">Xem đáp án ngay sau mỗi câu</p>
                </button>
              </div>
            </div>

            {/* Time Limit */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <Clock size={16} className="inline mr-2" />
                Thời gian làm bài (phút)
              </label>
              <input
                type="number"
                value={config.time_limit || ''}
                onChange={(e) => setConfig({ 
                  ...config, 
                  time_limit: e.target.value ? parseInt(e.target.value) : null 
                })}
                className="input-field w-40"
                placeholder="Không giới hạn"
                min={1}
              />
            </div>

            {/* Shuffle Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.shuffle_questions}
                  onChange={(e) => setConfig({ ...config, shuffle_questions: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="flex items-center gap-2">
                  <Shuffle size={16} className="text-slate-500" />
                  Xáo trộn thứ tự câu hỏi
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.shuffle_answers}
                  onChange={(e) => setConfig({ ...config, shuffle_answers: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="flex items-center gap-2">
                  <Shuffle size={16} className="text-slate-500" />
                  Xáo trộn thứ tự đáp án
                </span>
              </label>
            </div>

            {/* Assignment Type - Giao bài linh hoạt */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <Users size={16} className="inline mr-2" />
                Giao bài cho
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                  <input
                    type="radio"
                    name="assignType"
                    checked={config.is_public && !config.class_id}
                    onChange={() => setConfig({ ...config, is_public: true, class_id: null })}
                    className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                  />
                  <div>
                    <span className="flex items-center gap-2 font-medium">
                      <Globe size={16} className="text-slate-500" />
                      Công khai
                    </span>
                    <p className="text-sm text-slate-500">Bất kỳ ai có link đều vào được</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                  <input
                    type="radio"
                    name="assignType"
                    checked={!config.is_public && !config.class_id}
                    onChange={() => setConfig({ ...config, is_public: false, class_id: null })}
                    className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                  />
                  <div>
                    <span className="flex items-center gap-2 font-medium">
                      <Lock size={16} className="text-slate-500" />
                      Chỉ người có mật khẩu
                    </span>
                    <p className="text-sm text-slate-500">Yêu cầu nhập mật khẩu để truy cập</p>
                  </div>
                </label>
                {classes.length > 0 && (
                  <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="assignType"
                      checked={!!config.class_id}
                      onChange={() => setConfig({ ...config, is_public: false, class_id: classes[0]?.id || null })}
                      className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <span className="flex items-center gap-2 font-medium">
                        <Users size={16} className="text-slate-500" />
                        Giao cho lớp cụ thể
                      </span>
                      <p className="text-sm text-slate-500">Chỉ học sinh trong lớp mới truy cập được</p>
                    </div>
                  </label>
                )}
              </div>
              
              {/* Class Selection Dropdown */}
              {config.class_id !== null && classes.length > 0 && (
                <select
                  value={config.class_id || ''}
                  onChange={(e) => setConfig({ ...config, class_id: e.target.value || null })}
                  className="input-field mt-2"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.student_count} học sinh)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Password - Show only when not assigning to class or is public with password protection */}
            {(!config.class_id || !config.is_public) && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <Lock size={16} className="inline mr-2" />
                  Mật khẩu bảo vệ (tùy chọn)
                </label>
                <input
                  type="text"
                  value={config.password || ''}
                  onChange={(e) => setConfig({ ...config, password: e.target.value || null })}
                  className="input-field w-60"
                  placeholder="Để trống nếu không cần"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Học sinh cần nhập đúng mật khẩu để vào làm bài
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-200">
            <button 
              onClick={() => setStep('edit')}
              className="btn-secondary"
              disabled={saving}
            >
              Quay lại
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              {saving ? 'Đang lưu...' : (isEditMode ? 'Cập nhật đề thi' : 'Lưu đề thi')}
            </button>
          </div>
        </div>
      )}

      {/* Success Modal with Link */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              setShowSuccessModal(false);
              navigate('/exams');
            }}
          />
          <div className="relative bg-white rounded-lg shadow-lift w-full max-w-md animate-slideUp">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">
                {isEditMode ? 'Cập nhật thành công!' : 'Tạo đề thi thành công!'}
              </h3>
              <button 
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate('/exams');
                }}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-3">
                Link đề thi của bạn:
              </p>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <input
                  type="text"
                  value={createdExamLink}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-slate-700 outline-none"
                  onClick={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdExamLink);
                    toast.success('Đã sao chép link!');
                  }}
                  className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Sao chép"
                >
                  <Copy size={18} className="text-primary-500" />
                </button>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate('/exams');
                  }}
                  className="btn-secondary flex-1"
                >
                  Đóng
                </button>
                <button
                  onClick={() => window.open(createdExamLink, '_blank')}
                  className="btn-primary flex-1"
                >
                  Xem đề thi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};