# Smart Quiz Platform

Nền tảng thi trắc nghiệm thông minh với khả năng phân tích tự động đề thi từ file Word/Excel.

## 🚀 Tính năng chính

- **Phân tích đề thi tự động**: Upload file Word (.docx) hoặc Excel (.xlsx), hệ thống tự động nhận diện câu hỏi, đáp án và đáp án đúng (text in đậm).
- **Quản lý lớp học**: Tạo lớp, thêm học sinh qua email với xác thực.
- **Chế độ thi đa dạng**: Kiểm tra (nộp 1 lần) hoặc Luyện tập (xem đáp án ngay).
- **Bảng xếp hạng**: Xem thứ hạng theo điểm số và thời gian.
- **Bảo mật**: Đề thi có thể đặt mật khẩu, giới hạn người làm bài.

## 🛠 Tech Stack

- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL (NeonDB)
- **Email**: Brevo API

## 📦 Cài đặt

### Backend

```bash
cd backend

# Tạo virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# hoặc: venv\Scripts\activate  # Windows

# Cài dependencies
pip install -r requirements.txt

# Cấu hình environment
cp .env.example .env
# Sửa file .env với thông tin database và API keys của bạn

# Chạy server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Cài dependencies
npm install

# Chạy development server
npm run dev
```

## 🎯 Sử dụng

### 1. Tạo đề thi từ file Word

Định dạng file Word được hỗ trợ:
```
Câu 1: Nội dung câu hỏi ở đây?
a. Đáp án A
b. **Đáp án B (in đậm = đáp án đúng)**
c. Đáp án C
d. Đáp án D

Câu 2: Câu hỏi tiếp theo?
...
```

### 2. Tạo đề thi từ file Excel

| Câu hỏi | Đáp án A | Đáp án B | Đáp án C | Đáp án D | Đáp án đúng |
|---------|----------|----------|----------|----------|-------------|
| Nội dung câu 1? | A | B | C | D | B |
| Nội dung câu 2? | A | B | C | D | A |

### 3. API Endpoints

- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `POST /api/exams/parse` - Parse file đề thi
- `POST /api/exams` - Tạo đề thi
- `GET /api/exams/public/{id}` - Xem thông tin đề thi
- `POST /api/exams/public/{id}/start` - Bắt đầu làm bài
- `POST /api/exams/public/{id}/submit` - Nộp bài

## 📁 Cấu trúc dự án

```
smart-quiz-platform/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   └── routes/
│   │   │       ├── auth.py
│   │   │       ├── classes.py
│   │   │       ├── exams.py
│   │   │       └── dashboard.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── security.py
│   │   ├── models/
│   │   │   └── models.py
│   │   ├── schemas/
│   │   │   └── schemas.py
│   │   ├── services/
│   │   │   ├── parser.py      # File parser magic!
│   │   │   └── email.py
│   │   └── main.py
│   ├── requirements.txt
│   └── .env
│
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── services/
    │   ├── store/
    │   ├── types/
    │   ├── App.tsx
    │   └── main.tsx
    ├── package.json
    └── tailwind.config.js
```

## 🎨 Design System

- **Background**: Pure White (#FFFFFF)
- **Accent**: Sky Blue (#0EA5E9)
- **Text**: Dark Slate (#334155)
- **Borders**: Thin, subtle (1px #E2E8F0)
- **Shadows**: Soft, minimal
- **Animations**: Subtle 0.2s transitions

## 📝 License

MIT License
