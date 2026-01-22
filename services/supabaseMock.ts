
import { UserRole, LessonStatus, Lesson, LessonActivity, LessonVideo, Attachment, LessonProgress, Profile } from '../types';

/**
 * Since we don't have a real Supabase backend in this demo,
 * we use LocalStorage to persist data and simulate DB operations.
 * This is easily swappable with real Supabase JS client.
 */

const STORAGE_KEY = 'kingdomkids_db';

const initialData = {
  profiles: [
    { id: '1', role: UserRole.ADMIN, name: 'Admin User', created_at: new Date().toISOString() },
    { id: '2', role: UserRole.TEACHER, name: 'Teacher Sarah', created_at: new Date().toISOString() }
  ],
  lessons: [
    {
      id: 'L1',
      title: 'The Good Samaritan',
      summary: 'A story about kindness and loving your neighbor.',
      content: '# The Parable of the Good Samaritan\n\nOne day, a man was walking down a dangerous road...',
      category: 'Parables',
      series: 'Jesus Teaches',
      grade_min: 1,
      grade_max: 5,
      tags: ['kindness', 'jesus'],
      status: LessonStatus.PUBLISHED,
      published_at: new Date().toISOString(),
      created_by: '1',
      updated_at: new Date().toISOString()
    }
  ],
  lesson_activities: [
    {
      id: 'A1',
      lesson_id: 'L1',
      title: 'First Aid Kit Craft',
      supplies: ['Red paper', 'White paper', 'Glue', 'Markers'],
      instructions: '1. Cut a cross shape...\n2. Glue to the red paper...',
      duration_minutes: 20,
      sort_order: 1
    }
  ],
  lesson_videos: [
    {
      id: 'V1',
      lesson_id: 'L1',
      title: 'Story Animation',
      url: 'https://www.youtube.com/watch?v=osfQg4yKtq8',
      provider: 'youtube',
      sort_order: 1
    }
  ],
  attachments: [],
  lesson_progress: [] as LessonProgress[]
};

const getDB = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : initialData;
};

const saveDB = (db: any) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

export const supabase = {
  lessons: {
    async list(role: UserRole) {
      const db = getDB();
      if (role === UserRole.TEACHER) {
        return db.lessons.filter((l: Lesson) => l.status === LessonStatus.PUBLISHED);
      }
      return db.lessons;
    },
    async get(id: string) {
      const db = getDB();
      const lesson = db.lessons.find((l: Lesson) => l.id === id);
      if (!lesson) return null;
      
      return {
        ...lesson,
        activities: db.lesson_activities.filter((a: LessonActivity) => a.lesson_id === id),
        videos: db.lesson_videos.filter((v: LessonVideo) => v.lesson_id === id),
        attachments: db.attachments.filter((at: Attachment) => at.lesson_id === id)
      };
    },
    async upsert(lesson: Partial<Lesson>, activities?: Partial<LessonActivity>[]) {
      const db = getDB();
      const id = lesson.id || Math.random().toString(36).substr(2, 9);
      const existingIdx = db.lessons.findIndex((l: Lesson) => l.id === id);
      
      const newLesson = {
        ...lesson,
        id,
        updated_at: new Date().toISOString(),
        created_by: lesson.created_by || '1',
        status: lesson.status || LessonStatus.DRAFT
      };

      if (existingIdx >= 0) db.lessons[existingIdx] = { ...db.lessons[existingIdx], ...newLesson };
      else db.lessons.push(newLesson);

      if (activities) {
        db.lesson_activities = db.lesson_activities.filter((a: LessonActivity) => a.lesson_id !== id);
        activities.forEach((act, idx) => {
          db.lesson_activities.push({
            ...act,
            id: Math.random().toString(36).substr(2, 9),
            lesson_id: id,
            sort_order: idx
          });
        });
      }

      saveDB(db);
      return newLesson;
    }
  },
  progress: {
    async get(lessonId: string, teacherId: string) {
      const db = getDB();
      return db.lesson_progress.find((p: LessonProgress) => p.lesson_id === lessonId && p.teacher_id === teacherId);
    },
    async toggle(lessonId: string, teacherId: string) {
      const db = getDB();
      const idx = db.lesson_progress.findIndex((p: LessonProgress) => p.lesson_id === lessonId && p.teacher_id === teacherId);
      
      if (idx >= 0) {
        db.lesson_progress[idx].completed = !db.lesson_progress[idx].completed;
        db.lesson_progress[idx].completed_at = db.lesson_progress[idx].completed ? new Date().toISOString() : undefined;
      } else {
        db.lesson_progress.push({
          id: Math.random().toString(36).substr(2, 9),
          lesson_id: lessonId,
          teacher_id: teacherId,
          completed: true,
          completed_at: new Date().toISOString()
        });
      }
      saveDB(db);
    }
  },
  storage: {
    async upload(file: File) {
      // Mock storage: just return a fake path
      return { path: `lesson-assets/${file.name}` };
    },
    getPublicUrl(path: string) {
      return `https://picsum.photos/800/600?random=${path}`; // Placeholder for images
    }
  }
};
