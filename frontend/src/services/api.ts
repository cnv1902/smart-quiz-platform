/**
 * Smart Quiz Platform - API Service
 * 
 * Centralized API client with environment-based configuration
 * Supports separate Frontend/Backend deployment on different subdomains
 * 
 * Environment Variables:
 * - VITE_API_URL: Backend API base URL (e.g., https://api.iamchuong.id.vn)
 */
import axios, { AxiosError } from 'axios';

// ============== Configuration ==============

/**
 * Get API URL from environment variable
 * Falls back to relative /api path for same-domain deployment
 */
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// ============== Utilities ==============

/**
 * Clean object by removing null/undefined values
 * Prevents Pydantic validation errors (422) on backend
 */
const cleanPayload = <T extends object>(data: T): Partial<T> => {
  const cleaned: Partial<T> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Skip null and undefined values
    if (value !== null && value !== undefined) {
      // Recursively clean nested objects (but not arrays)
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        cleaned[key as keyof T] = cleanPayload(value as object) as T[keyof T];
      } else {
        cleaned[key as keyof T] = value as T[keyof T];
      }
    }
  }
  
  return cleaned;
};

/**
 * Format error message from API response
 */
const formatErrorMessage = (error: AxiosError): string => {
  if (error.response?.data) {
    const data = error.response.data as { detail?: string | { msg: string }[] };
    if (typeof data.detail === 'string') {
      return data.detail;
    }
    if (Array.isArray(data.detail)) {
      return data.detail.map(d => d.msg).join(', ');
    }
  }
  return error.message || 'An error occurred';
};

// ============== Interceptors ==============

// Request interceptor: Add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle 401 Unauthorized - redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Don't redirect for public exam pages - they handle auth separately
      const isExamPage = window.location.pathname.startsWith('/exam/');
      const isLoginPage = window.location.pathname.includes('/login');
      
      if (!isExamPage && !isLoginPage) {
        window.location.href = '/login';
      }
    }
    
    // Enhance error with formatted message
    const enhancedError = error as AxiosError & { formattedMessage: string };
    enhancedError.formattedMessage = formatErrorMessage(error);
    
    return Promise.reject(enhancedError);
  }
);

// ============== Auth API ==============

export const authAPI = {
  /**
   * Register new user - returns OTP requirement
   */
  register: (data: { email: string; password: string; full_name?: string }) =>
    api.post('/auth/register', cleanPayload(data)),
  
  /**
   * Verify registration OTP
   */
  verifyRegister: (email: string, otp: string) =>
    api.post('/auth/verify-register', { email, otp }),
  
  /**
   * Resend registration OTP
   */
  resendOtp: (email: string) =>
    api.post('/auth/resend-otp', { email }),
  
  /**
   * Login with email and password
   */
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  
  /**
   * Get current user info
   */
  getMe: () => 
    api.get('/auth/me'),
  
  /**
   * Request password reset OTP
   */
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  
  /**
   * Verify OTP code
   */
  verifyOTP: (email: string, otp: string) =>
    api.post('/auth/verify-otp', { email, otp }),
  
  /**
   * Reset password with OTP
   */
  resetPassword: (email: string, otp: string, new_password: string) =>
    api.post('/auth/reset-password', { email, otp, new_password }),
};

// ============== Classes API ==============

export interface ClassCreateData {
  name: string;
  description?: string | null;
}

export interface ClassUpdateData {
  name?: string;
  description?: string | null;
}

export const classesAPI = {
  /**
   * Get all classes for current user
   */
  getAll: (params?: { skip?: number; limit?: number }) =>
    api.get('/classes', { params }),
  
  /**
   * Get single class by UUID
   */
  getOne: (id: string) => 
    api.get(`/classes/${id}`),
  
  /**
   * Create new class
   */
  create: (data: ClassCreateData) =>
    api.post('/classes', cleanPayload(data)),
  
  /**
   * Update class by UUID
   */
  update: (id: string, data: ClassUpdateData) =>
    api.put(`/classes/${id}`, cleanPayload(data)),
  
  /**
   * Delete class by UUID
   */
  delete: (id: string) => 
    api.delete(`/classes/${id}`),
  
  /**
   * Add student to class via email
   */
  addStudent: (classId: string, email: string) =>
    api.post(`/classes/${classId}/students`, { email }),
  
  /**
   * Remove student from class by UUID
   */
  removeStudent: (classId: string, studentId: string) =>
    api.delete(`/classes/${classId}/students/${studentId}`),
  
  /**
   * Verify class join invitation token
   */
  verifyJoin: (token: string) => 
    api.get(`/classes/join/${token}`),
};

// ============== Exams API ==============

export interface ExamConfig {
  mode: 'practice' | 'test';
  shuffle_questions: boolean;
  shuffle_answers: boolean;
  time_limit?: number | null;
  password?: string | null;
  is_public: boolean;
  class_id?: string | null;
}

export interface ExamCreateData {
  title: string;
  description?: string | null;
  questions: {
    id: string;
    text: string;
    options: { id: string; text: string; is_correct: boolean }[];
    explanation?: string;
  }[];
  config: ExamConfig;
}

export interface ExamUpdateData {
  title?: string;
  description?: string | null;
  questions?: ExamCreateData['questions'];
  config?: Partial<ExamConfig>;
}

export interface ExamSubmitData {
  answers: { question_id: string; selected_option_id: string }[];
  time_taken?: number | null;
  guest_name?: string | null;
  guest_email?: string | null;
}

export const examsAPI = {
  /**
   * Get all exams for current user
   */
  getAll: (params?: { skip?: number; limit?: number }) =>
    api.get('/exams', { params }),
  
  /**
   * Get single exam by UUID (creator only)
   */
  getOne: (id: string) => 
    api.get(`/exams/${id}`),
  
  /**
   * Create new exam
   */
  create: (data: ExamCreateData) => {
    // Clean config to remove null values
    const cleanedData = {
      ...data,
      config: cleanPayload(data.config) as ExamConfig,
    };
    return api.post('/exams', cleanedData);
  },
  
  /**
   * Update exam by UUID
   */
  update: (id: string, data: ExamUpdateData) => {
    const cleanedData = {
      ...data,
      ...(data.config && { config: cleanPayload(data.config) }),
    };
    return api.put(`/exams/${id}`, cleanPayload(cleanedData));
  },
  
  /**
   * Delete exam by UUID
   */
  delete: (id: string) => 
    api.delete(`/exams/${id}`),
  
  /**
   * Parse uploaded file (Word/Excel) to extract questions
   */
  parseFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/exams/parse', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // 60 second timeout for file uploads
    });
  },
  
  // ===== Public Exam Endpoints =====
  
  /**
   * Get public exam info (without questions/answers)
   */
  getPublic: (publicId: string) => 
    api.get(`/exams/public/${publicId}`),
  
  /**
   * Start taking an exam - returns questions without correct answers
   */
  startExam: (publicId: string, password?: string) =>
    api.post(`/exams/public/${publicId}/start`, null, {
      params: password ? { password } : undefined,
    }),
  
  /**
   * Submit exam answers and get results
   */
  submitExam: (publicId: string, data: ExamSubmitData) => {
    // Clean payload to remove null values (avoid 422 errors)
    return api.post(`/exams/public/${publicId}/submit`, cleanPayload(data));
  },
  
  /**
   * Get exam leaderboard
   */
  getLeaderboard: (publicId: string) =>
    api.get(`/exams/public/${publicId}/leaderboard`),
  
  // ===== Exam Management =====
  
  /**
   * Get all results for an exam (creator only)
   */
  getResults: (examId: string) => 
    api.get(`/exams/${examId}/results`),
  
  /**
   * Assign exam to a class
   */
  assignToClass: (examId: string, classId: string) =>
    api.post(`/exams/${examId}/assign-class/${classId}`),
};

// ============== Dashboard API ==============

export const dashboardAPI = {
  /**
   * Get dashboard statistics and traffic data
   */
  getData: (period: 'day' | 'week' | 'month' | 'year' = 'day') => 
    api.get('/dashboard', { params: { period } }),
};

// ============== Export ==============

export default api;

/**
 * Export API URL for debugging/display purposes
 */
export const getApiUrl = () => API_URL;

