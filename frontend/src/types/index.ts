// User types
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  is_verified: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
  email: string;
  requires_otp: boolean;
}

// Class types
export interface ClassStudent {
  id: string;
  student_email: string;
  is_verified: boolean;
  joined_at: string;
}

export interface Class {
  id: string;
  name: string;
  description: string | null;
  teacher_id: string;
  created_at: string;
  students: ClassStudent[];
  exams: ExamListItem[];
}

export interface ClassListItem {
  id: string;
  name: string;
  description: string | null;
  student_count: number;
  created_at: string;
  role?: 'teacher' | 'student';
}

// Question types
export interface QuestionOption {
  id: string;
  text: string;
  is_correct: boolean;
}

export interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
  explanation?: string;
}

// Exam types
export interface ExamConfig {
  mode: 'practice' | 'test';
  shuffle_questions: boolean;
  shuffle_answers: boolean;
  time_limit: number | null;
  password: string | null;
  is_public: boolean;
  class_id: string | null;  // Assign to specific class
}

export interface Exam {
  id: string;
  public_id: string;
  title: string;
  description: string | null;
  creator_id: string;
  mode: string;
  shuffle_questions: boolean;
  shuffle_answers: boolean;
  time_limit: number | null;
  is_public: boolean;
  has_password: boolean;
  questions: Question[];
  total_attempts: number;
  created_at: string;
}

export interface ExamListItem {
  id: string;
  public_id: string;
  title: string;
  description: string | null;
  mode: string;
  time_limit: number | null;
  is_public: boolean;
  has_password: boolean;
  question_count: number;
  total_attempts: number;
  created_at: string;
}

export interface ExamPublic {
  public_id: string;
  title: string;
  description: string | null;
  mode: string;
  time_limit: number | null;
  has_password: boolean;
  requires_auth: boolean;
  question_count: number;
}

export interface ExamTake {
  public_id: string;
  title: string;
  description: string | null;
  mode: string;
  time_limit: number | null;
  questions: {
    id: string;
    text: string;
    options: { id: string; text: string }[];
  }[];
}

// Result types
export interface ExamResult {
  id: string;
  exam_id: string;
  score: number;
  correct_count: number;
  total_questions: number;
  time_taken: number | null;
  completed_at: string;
  user_name?: string;
  answers?: {
    question_id: string;
    question_text: string;
    selected_option_id: string | null;
    correct_option_id: string | null;
    is_correct: boolean;
  }[];
}

export interface LeaderboardEntry {
  rank: number;
  user_name: string;
  score: number;
  time_taken: number | null;
  completed_at: string;
}

// Dashboard types
export interface DashboardStats {
  total_exams: number;
  total_classes: number;
  total_students: number;
  total_attempts: number;
}

export interface TrafficData {
  hour: string;
  count: number;
}

export interface DashboardData {
  stats: DashboardStats;
  traffic_24h: TrafficData[];
}

// Parse types
export interface ParsedQuestion {
  id: string;
  text: string;
  options: {
    id: string;
    text: string;
    is_correct: boolean;
  }[];
}

export interface ParseResponse {
  success: boolean;
  questions: ParsedQuestion[];
  error?: string;
  total_parsed: number;
}
