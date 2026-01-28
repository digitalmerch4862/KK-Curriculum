
export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher'
}

export enum LessonStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published'
}

export interface Profile {
  id: string;
  role: UserRole;
  name: string;
  created_at: string;
}

export interface LessonSubSection {
  id: string;
  title: string;
  content: string;
}

export interface LessonContentStructure {
  read: LessonSubSection[];
  teach: LessonSubSection[];
  engage: LessonSubSection[];
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  content: string; // Stored as Markdown, parsed to Structure in UI
  category: string;
  series: string;
  grade_min: number;
  grade_max: number;
  tags: string[];
  status: LessonStatus;
  published_at?: string;
  created_by: string;
  updated_at: string;
  // Join fields
  activities?: LessonActivity[];
  videos?: LessonVideo[];
  attachments?: Attachment[];
  progress?: LessonProgress;
}

export interface LessonActivity {
  id: string;
  lesson_id: string;
  title: string;
  supplies: string[];
  instructions: string;
  duration_minutes: number;
  sort_order: number;
}

export interface LessonVideo {
  id: string;
  lesson_id: string;
  title?: string;
  url: string;
  provider: 'youtube' | 'vimeo' | 'other';
  sort_order: number;
}

export interface Attachment {
  id: string;
  lesson_id: string;
  name: string;
  type: 'pdf' | 'image' | 'video' | 'audio' | 'doc';
  storage_path: string;
  size_bytes?: number;
  sort_order?: number;
  created_at: string;
}

export interface LessonProgress {
  id: string;
  lesson_id: string;
  teacher_id: string;
  completed: boolean;
  completed_at?: string;
}

export interface LessonSchedule {
  id: string;
  lesson_id: string;
  scheduled_date: string; // YYYY-MM-DD
  lesson?: Lesson;
}

export type AuthUser = Profile | null;
