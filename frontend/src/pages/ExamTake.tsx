import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Lock, 
  FileText, 
  Check, 
  ChevronRight,
  Trophy,
  Timer,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { examsAPI } from '../services/api';
import { ExamPublic, ExamTake, ExamResult, LeaderboardEntry } from '../types';
import { useAuthStore } from '../store/authStore';
import { useConfirmDialog } from '../components/ConfirmDialog';

// Password Modal
const PasswordModal = ({ 
  onSubmit, 
  loading 
}: { 
  onSubmit: (password: string) => void; 
  loading: boolean;
}) => {
  const [password, setPassword] = useState('');

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lift p-6 w-full max-w-sm mx-4 animate-slideUp">
        <div className="text-center mb-4">
          <Lock size={40} className="mx-auto text-primary-500 mb-3" />
          <h3 className="text-lg font-semibold text-slate-800">Đề thi được bảo vệ</h3>
          <p className="text-sm text-slate-500 mt-1">Nhập mật khẩu để tiếp tục</p>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field mb-4"
          placeholder="Mật khẩu"
          autoFocus
        />
        <button
          onClick={() => onSubmit(password)}
          disabled={loading || !password}
          className="btn-primary w-full"
        >
          {loading ? 'Đang xác thực...' : 'Vào thi'}
        </button>
      </div>
    </div>
  );
};

// Exam Info Page (before starting)
export const ExamInfoPage = () => {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [exam, setExam] = useState<ExamPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [starting, setStarting] = useState(false);
  const [guestInfo, setGuestInfo] = useState({ name: '', email: '' });
  const [autoStarted, setAutoStarted] = useState(false);

  useEffect(() => {
    loadExam();
  }, [publicId]);

  const loadExam = async () => {
    try {
      const response = await examsAPI.getPublic(publicId!);
      setExam(response.data);
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Không tìm thấy đề thi';
      toast.error(message);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  // Auto-start exam after login if requires_auth and user just authenticated
  useEffect(() => {
    if (exam && isAuthenticated && exam.requires_auth && !autoStarted && !loading) {
      // Check if user just came from login (has session flag)
      const shouldAutoStart = sessionStorage.getItem(`auto_start_exam_${publicId}`);
      if (shouldAutoStart) {
        sessionStorage.removeItem(`auto_start_exam_${publicId}`);
        setAutoStarted(true);
        handleStart();
      }
    }
  }, [exam, isAuthenticated, loading]);

  const handleStart = async (password?: string) => {
    // If requires auth and not authenticated, redirect to login
    if (exam?.requires_auth && !isAuthenticated) {
      toast.error('Bạn cần đăng nhập để làm bài thi này');
      // Set flag to auto-start after login
      sessionStorage.setItem(`auto_start_exam_${publicId}`, 'true');
      navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    
    if (exam?.has_password && !password) {
      setShowPassword(true);
      return;
    }

    setStarting(true);
    try {
      const response = await examsAPI.startExam(publicId!, password);
      // Store exam data and navigate to take page
      sessionStorage.setItem(`exam_${publicId}`, JSON.stringify(response.data));
      sessionStorage.setItem(`exam_guest_${publicId}`, JSON.stringify(guestInfo));
      sessionStorage.setItem(`exam_start_${publicId}`, Date.now().toString());
      navigate(`/exam/${publicId}/take`);
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error('Bạn cần đăng nhập để làm bài thi này');
        // Set flag to auto-start after login
        sessionStorage.setItem(`auto_start_exam_${publicId}`, 'true');
        // Redirect to login with return URL
        navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`);
      } else if (error.response?.status === 403) {
        const message = error.response?.data?.detail || 'Mật khẩu không đúng';
        toast.error(message, { duration: 5000 });
      } else {
        toast.error(error.response?.data?.detail || 'Không thể bắt đầu bài thi');
      }
    } finally {
      setStarting(false);
      setShowPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!exam) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-6 lg:py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="card animate-slideUp p-4 lg:p-6">
          {/* Exam Header */}
          <div className="text-center pb-4 lg:pb-6 border-b border-slate-200">
            <div className="w-14 h-14 lg:w-16 lg:h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3 lg:mb-4">
              <FileText size={28} className="text-primary-500" />
            </div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-800">{exam.title}</h1>
            {exam.description && (
              <p className="text-sm lg:text-base text-slate-500 mt-2">{exam.description}</p>
            )}
          </div>

          {/* Exam Info */}
          <div className="py-4 lg:py-6 space-y-3 lg:space-y-4">
            <div className="flex items-center justify-between text-sm lg:text-base">
              <span className="text-slate-500">Số câu hỏi</span>
              <span className="font-medium text-slate-700">{exam.question_count} câu</span>
            </div>
            <div className="flex items-center justify-between text-sm lg:text-base">
              <span className="text-slate-500">Thời gian</span>
              <span className="font-medium text-slate-700">
                {exam.time_limit ? `${exam.time_limit} phút` : 'Không giới hạn'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm lg:text-base">
              <span className="text-slate-500">Chế độ</span>
              <span className={`px-2 py-0.5 rounded text-xs lg:text-sm ${
                exam.mode === 'practice' 
                  ? 'bg-green-50 text-green-600' 
                  : 'bg-blue-50 text-blue-600'
              }`}>
                {exam.mode === 'practice' ? 'Luyện tập' : 'Kiểm tra'}
              </span>
            </div>
            {exam.has_password && (
              <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 p-2 lg:p-3 rounded-lg">
                <Lock size={16} />
                <span className="text-xs lg:text-sm">Đề thi được bảo vệ bằng mật khẩu</span>
              </div>
            )}
          </div>

          {/* Guest Info (if not logged in and not requires auth) */}
          {!isAuthenticated && !exam.requires_auth && (
            <div className="py-4 border-t border-slate-200">
              <p className="text-xs lg:text-sm text-slate-500 mb-3">Thông tin người làm bài (tùy chọn)</p>
              <div className="space-y-3">
                <input
                  type="text"
                  value={guestInfo.name}
                  onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                  className="input-field text-sm lg:text-base"
                  placeholder="Họ và tên"
                />
                <input
                  type="email"
                  value={guestInfo.email}
                  onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                  className="input-field text-sm lg:text-base"
                  placeholder="Email"
                />
              </div>
            </div>
          )}

          {/* Start Button */}
          <div className="pt-4 border-t border-slate-200">
            <button
              onClick={() => handleStart()}
              disabled={starting}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {starting ? 'Đang tải...' : 'Bắt đầu làm bài'}
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* View Leaderboard */}
        <button
          onClick={() => navigate(`/exam/${publicId}/leaderboard`)}
          className="mt-4 w-full btn-secondary flex items-center justify-center gap-2"
        >
          <Trophy size={18} />
          Xem bảng xếp hạng
        </button>
      </div>

      {/* Password Modal */}
      {showPassword && (
        <PasswordModal 
          onSubmit={handleStart} 
          loading={starting}
        />
      )}
    </div>
  );
};

// Exam Taking Page
export const ExamTakePage = () => {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [exam, setExam] = useState<ExamTake | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [practiceResult, setPracticeResult] = useState<{ correct: boolean; correctId: string } | null>(null);
  const timerRef = useRef<number | null>(null);
  const autoNextTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Load exam data from session storage
    const examData = sessionStorage.getItem(`exam_${publicId}`);
    if (!examData) {
      toast.error('Phiên làm bài không hợp lệ');
      navigate(`/exam/${publicId}`);
      return;
    }
    
    const parsed = JSON.parse(examData) as ExamTake;
    setExam(parsed);
    
    // Start timer if time limit exists
    if (parsed.time_limit) {
      setTimeLeft(parsed.time_limit * 60);
    }
  }, [publicId, navigate]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft !== null]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (questionId: string, optionId: string) => {
    if (exam?.mode === 'practice' && practiceResult) return; // Already answered
    
    setAnswers({ ...answers, [questionId]: optionId });

    // In practice mode, show result immediately
    if (exam?.mode === 'practice') {
      const question = exam.questions.find(q => q.id === questionId);
      const selectedOption = question?.options.find(opt => opt.id === optionId);
      const correctOption = question?.options.find(opt => (opt as any).is_correct);
      
      setPracticeResult({ 
        correct: selectedOption?.id === correctOption?.id,
        correctId: correctOption?.id || ''
      });
      
      // Auto advance after 3 seconds
      autoNextTimerRef.current = window.setTimeout(() => {
        handleNextQuestion();
      }, 3000);
    }
  };

  const handleNextQuestion = () => {
    // Clear auto-next timer if exists
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    
    setPracticeResult(null);
    if (currentIndex < (exam?.questions.length || 0) - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (!exam) return;
    
    if (!autoSubmit) {
      const unanswered = exam.questions.length - Object.keys(answers).length;
      if (unanswered > 0) {
        const unansweredNumbers = exam.questions
          .map((q, i) => !answers[q.id] ? i + 1 : null)
          .filter(n => n !== null);
        
        const message = `Bạn còn ${unanswered} câu chưa trả lời:\n\nCác câu: ${unansweredNumbers.join(', ')}\n\nBạn có chắc muốn nộp bài?`;
        
        const confirmed = await confirm(message, { variant: 'warning' });
        if (!confirmed) {
          return;
        }
      }
    }

    setSubmitting(true);
    
    try {
      const guestInfo = JSON.parse(sessionStorage.getItem(`exam_guest_${publicId}`) || '{}');
      const startTime = parseInt(sessionStorage.getItem(`exam_start_${publicId}`) || '0');
      const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : null;

      const response = await examsAPI.submitExam(publicId!, {
        answers: Object.entries(answers).map(([question_id, selected_option_id]) => ({
          question_id,
          selected_option_id
        })),
        time_taken: timeTaken ?? undefined,
        guest_name: guestInfo.name || undefined,
        guest_email: guestInfo.email || undefined
      });

      setResult(response.data);
      
      // Clean up session storage
      sessionStorage.removeItem(`exam_${publicId}`);
      sessionStorage.removeItem(`exam_guest_${publicId}`);
      sessionStorage.removeItem(`exam_start_${publicId}`);
      
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Nộp bài thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  if (!exam) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  // Show result screen
  if (result) {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="card text-center animate-slideUp">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4
              ${result.score >= 5 ? 'bg-green-100' : 'bg-red-100'}`}>
              {result.score >= 5 ? (
                <Trophy size={40} className="text-green-500" />
              ) : (
                <AlertCircle size={40} className="text-red-500" />
              )}
            </div>
            
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              {result.score >= 5 ? 'Chúc mừng!' : 'Hoàn thành!'}
            </h1>
            
            <div className="text-5xl font-bold text-primary-500 my-6">
              {result.score.toFixed(1)}/10
            </div>
            
            <div className="grid grid-cols-2 gap-4 py-4 border-t border-slate-200">
              <div>
                <p className="text-sm text-slate-500">Số câu đúng</p>
                <p className="text-xl font-semibold text-green-600">
                  {result.correct_count}/{result.total_questions}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Thời gian</p>
                <p className="text-xl font-semibold text-slate-700">
                  {result.time_taken ? formatTime(result.time_taken) : '--:--'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => navigate(`/exam/${publicId}/leaderboard`)}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <Trophy size={18} />
                Bảng xếp hạng
              </button>
              <button
                onClick={() => navigate(`/exam/${publicId}`)}
                className="btn-primary flex-1"
              >
                Làm lại
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = exam.questions[currentIndex];

  // Render for test mode (all questions at once)
  if (exam.mode === 'test') {
    return (
      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar - Question Navigation */}
        <aside className="hidden lg:block w-64 bg-white border-r border-slate-200 fixed left-0 top-0 bottom-0 overflow-y-auto">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">Danh sách câu hỏi</h2>
            <p className="text-xs text-slate-500 mt-1">
              {Object.keys(answers).length}/{exam.questions.length} đã trả lời
            </p>
          </div>
          
          <div className="p-4">
            <div className="grid grid-cols-5 gap-2">
              {exam.questions.map((question, qIndex) => {
                const isAnswered = answers[question.id];
                
                return (
                  <button
                    key={question.id}
                    onClick={() => {
                      const element = document.getElementById(`question-${qIndex}`);
                      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className={`aspect-square rounded-lg border-2 flex items-center justify-center text-sm font-semibold transition-all
                      ${isAnswered 
                        ? 'border-primary-500 bg-primary-500 text-white' 
                        : 'border-slate-300 text-slate-600 hover:border-primary-300 hover:bg-primary-50'}`}
                  >
                    {qIndex + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 lg:ml-64">
          {/* Header */}
          <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
              <h1 className="font-semibold text-slate-800 truncate text-sm lg:text-base max-w-[200px] lg:max-w-none">{exam.title}</h1>
              
              {timeLeft !== null && (
                <div className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg
                  ${timeLeft < 60 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'}`}>
                  <Timer size={16} />
                  <span className="font-mono font-medium text-sm lg:text-base">{formatTime(timeLeft)}</span>
                </div>
              )}
            </div>
          </header>

          {/* All Questions */}
          <main className="max-w-3xl mx-auto px-4 py-4 lg:py-6">
            {/* Progress */}
            <div className="mb-4 lg:mb-6">
              <div className="flex items-center justify-between text-xs lg:text-sm text-slate-500 mb-2">
                <span>{exam.questions.length} câu hỏi</span>
                <span>{Object.keys(answers).length} đã trả lời</span>
              </div>
              <div className="h-1.5 lg:h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${(Object.keys(answers).length / exam.questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Mobile Question Grid (shown on small screens) */}
            <div className="lg:hidden mb-4">
              <div className="card p-3">
                <p className="text-xs font-medium text-slate-600 mb-2">Danh sách câu hỏi</p>
                <div className="grid grid-cols-10 gap-1.5">
                  {exam.questions.map((question, qIndex) => {
                    const isAnswered = answers[question.id];
                    
                    return (
                      <button
                        key={question.id}
                        onClick={() => {
                          const element = document.getElementById(`question-${qIndex}`);
                          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className={`aspect-square rounded text-xs font-semibold transition-all
                          ${isAnswered 
                            ? 'bg-primary-500 text-white' 
                            : 'bg-slate-200 text-slate-600'}`}
                      >
                        {qIndex + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* All Question Cards */}
            <div className="space-y-4 lg:space-y-6">
              {exam.questions.map((question, qIndex) => (
                <div key={question.id} id={`question-${qIndex}`} className="card p-4 lg:p-6 scroll-mt-24">
                  <div className="flex items-start gap-2 lg:gap-3 mb-4 lg:mb-6">
                    <span className="w-7 h-7 lg:w-8 lg:h-8 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center font-semibold text-xs lg:text-sm flex-shrink-0">
                      {qIndex + 1}
                    </span>
                    <p className="text-base lg:text-lg text-slate-800">{question.text}</p>
                  </div>

                  <div className="space-y-2 lg:space-y-3">
                    {question.options.map((option, optIndex) => {
                      const isSelected = answers[question.id] === option.id;
                      
                      return (
                        <button
                          key={option.id}
                          onClick={() => setAnswers({ ...answers, [question.id]: option.id })}
                          className={`w-full flex items-center gap-2 lg:gap-3 p-3 lg:p-4 rounded-lg border-2 text-left transition-all
                            ${isSelected 
                              ? 'border-primary-500 bg-primary-50' 
                              : 'border-slate-200 hover:border-slate-300'}`}
                        >
                          <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
                            ${isSelected 
                              ? 'border-primary-500 bg-primary-500' 
                              : 'border-slate-300'}`}>
                            {isSelected && <Check size={12} className="text-white" />}
                          </div>
                          <span className="text-xs lg:text-sm font-medium text-slate-500 w-5 lg:w-6">
                            {String.fromCharCode(65 + optIndex)}.
                          </span>
                          <span className="flex-1 text-sm lg:text-base text-slate-700">{option.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Submit Button */}
            <div className="mt-6 sticky bottom-4">
              <button
                onClick={() => handleSubmit()}
                disabled={submitting}
                className="btn-primary w-full py-3 text-base lg:text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Đang nộp...' : 'Nộp bài'}
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Render for practice mode (one question at a time)
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-semibold text-slate-800 truncate text-sm lg:text-base max-w-[200px] lg:max-w-none">{exam.title}</h1>
          
          {timeLeft !== null && (
            <div className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg
              ${timeLeft < 60 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'}`}>
              <Timer size={16} />
              <span className="font-mono font-medium text-sm lg:text-base">{formatTime(timeLeft)}</span>
            </div>
          )}
        </div>
      </header>

      {/* Question */}
      <main className="max-w-3xl mx-auto px-4 py-4 lg:py-6">
        {/* Progress */}
        <div className="mb-4 lg:mb-6">
          <div className="flex items-center justify-between text-xs lg:text-sm text-slate-500 mb-2">
            <span>Câu {currentIndex + 1}/{exam.questions.length}</span>
            <span>{Object.keys(answers).length} đã trả lời</span>
          </div>
          <div className="h-1.5 lg:h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / exam.questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="card mb-4 lg:mb-6 animate-fadeIn p-4 lg:p-6">
          <div className="flex items-start gap-2 lg:gap-3 mb-4 lg:mb-6">
            <span className="w-7 h-7 lg:w-8 lg:h-8 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center font-semibold text-xs lg:text-sm flex-shrink-0">
              {currentIndex + 1}
            </span>
            <p className="text-base lg:text-lg text-slate-800">{currentQuestion.text}</p>
          </div>

          <div className="space-y-2 lg:space-y-3">
            {currentQuestion.options.map((option, optIndex) => {
              const isSelected = answers[currentQuestion.id] === option.id;
              const isCorrect = (option as any).is_correct;
              const showResult = exam.mode === 'practice' && practiceResult;
              
              // Determine style based on practice mode result
              let buttonStyle = '';
              if (showResult) {
                if (isCorrect) {
                  buttonStyle = 'border-green-500 bg-green-50';
                } else if (isSelected && !isCorrect) {
                  buttonStyle = 'border-red-500 bg-red-50';
                } else {
                  buttonStyle = 'border-slate-200';
                }
              } else if (isSelected) {
                buttonStyle = 'border-primary-500 bg-primary-50';
              } else {
                buttonStyle = 'border-slate-200 hover:border-slate-300';
              }
              
              return (
                <button
                  key={option.id}
                  onClick={() => handleAnswer(currentQuestion.id, option.id)}
                  disabled={!!showResult}
                  className={`w-full flex items-center gap-2 lg:gap-3 p-3 lg:p-4 rounded-lg border-2 text-left transition-all ${buttonStyle}`}
                >
                  <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    ${
                      showResult && isCorrect
                        ? 'border-green-500 bg-green-500'
                        : showResult && isSelected && !isCorrect
                        ? 'border-red-500 bg-red-500'
                        : isSelected
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-slate-300'
                    }`}>
                    {(isSelected || (showResult && isCorrect)) && <Check size={12} className="text-white" />}
                  </div>
                  <span className="text-xs lg:text-sm font-medium text-slate-500 w-5 lg:w-6">
                    {String.fromCharCode(65 + optIndex)}.
                  </span>
                  <span className="flex-1 text-sm lg:text-base text-slate-700">{option.text}</span>
                  {showResult && isCorrect && (
                    <Check size={18} className="text-green-500" />
                  )}
                </button>
              );
            })}
            
            {/* Practice mode result message */}
            {exam.mode === 'practice' && practiceResult && (
              <div className={`mt-4 p-3 rounded-lg ${practiceResult.correct ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <p className="font-medium">
                  {practiceResult.correct ? '✓ Chính xác!' : '✗ Chưa đúng'}
                </p>
                <p className="text-sm mt-1">Tự động chuyển câu tiếp theo sau 3 giây...</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation for Practice Mode */}
        <div className="flex justify-end gap-3">
          {practiceResult && currentIndex < exam.questions.length - 1 && (
            <button
              onClick={handleNextQuestion}
              className="btn-secondary flex items-center gap-2 w-full lg:w-auto justify-center"
            >
              Bỏ qua chờ
              <ChevronRight size={18} />
            </button>
          )}
          {currentIndex < exam.questions.length - 1 ? (
            <button
              onClick={handleNextQuestion}
              disabled={!answers[currentQuestion.id] || !practiceResult}
              className="btn-primary flex items-center gap-2 w-full lg:w-auto justify-center"
            >
              Câu tiếp theo
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={() => handleSubmit()}
              disabled={submitting || !answers[currentQuestion.id]}
              className="btn-primary w-full lg:w-auto"
            >
              {submitting ? 'Đang nộp...' : 'Hoàn thành'}
            </button>
          )}
        </div>
      </main>
      
      <ConfirmDialogComponent />
    </div>
  );
};

// Leaderboard Page
export const LeaderboardPage = () => {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const { ConfirmDialogComponent } = useConfirmDialog();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, [publicId]);

  const loadLeaderboard = async () => {
    try {
      const response = await examsAPI.getLeaderboard(publicId!);
      setLeaderboard(response.data);
    } catch (error) {
      toast.error('Không thể tải bảng xếp hạng');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 lg:py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => navigate(`/exam/${publicId}`)}
          className="text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1 text-sm lg:text-base"
        >
          ← Quay lại
        </button>

        <div className="card">
          <div className="flex items-center gap-3 mb-4 lg:mb-6">
            <Trophy size={24} className="text-yellow-500" />
            <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Bảng xếp hạng</h1>
          </div>

          {leaderboard.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Chưa có ai làm bài thi này
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div 
                  key={entry.rank}
                  className={`flex items-center gap-3 lg:gap-4 p-3 lg:p-4 rounded-lg
                    ${entry.rank <= 3 ? 'bg-yellow-50 border border-yellow-200' : 'bg-slate-50'}`}
                >
                  <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-full flex items-center justify-center font-bold text-sm lg:text-base
                    ${entry.rank === 1 ? 'bg-yellow-400 text-white' :
                      entry.rank === 2 ? 'bg-slate-400 text-white' :
                      entry.rank === 3 ? 'bg-orange-400 text-white' :
                      'bg-slate-200 text-slate-600'}`}>
                    {entry.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm lg:text-base truncate">{entry.user_name}</p>
                    <p className="text-xs lg:text-sm text-slate-500">
                      {new Date(entry.completed_at).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg lg:text-xl font-bold text-primary-600">{entry.score.toFixed(1)}</p>
                    <p className="text-xs lg:text-sm text-slate-500">{formatTime(entry.time_taken)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <ConfirmDialogComponent />
    </div>
  );
};
