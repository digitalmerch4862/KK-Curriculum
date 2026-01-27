
export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher'
}

export enum LessonStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published'
}

export type FrequencyType = 'DAILY' | 'WEEKLY' | 'MONTHLY';

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
  content: string; 
  category: string;
  series: string;
  grade_min: number;
  grade_max: number;
  tags: string[];
  status: LessonStatus;
  published_at?: string;
  created_by: string;
  updated_at: string;
  activities?: LessonActivity[];
  videos?: LessonVideo[];
  attachments?: Attachment[];
  progress?: LessonProgress;
}

export interface PlannerConfig {
  category: string;
  start_date: string; // ISO Date
  frequency: FrequencyType;
  is_active: boolean;
  updated_at: string;
}

export interface LessonOccurrence {
  id: string;
  category: string;
  scheduled_date: string; // ISO Date (replaces scheduled_month for granularity)
  lesson_id?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'SKIPPED' | 'CANCELLED';
  lesson?: {
    title: string;
    summary: string;
  };
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

export type AuthUser = Profile | null;
