
import { UserRole, LessonStatus, Lesson, LessonActivity, LessonVideo, Attachment, LessonProgress, LessonSchedule } from '../types.ts';

/**
 * Persist mock data in LocalStorage to simulate a real database.
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
      content: '# 1. Read\n\n## BIBLE TEXT\nLuke 10:25-37\n\n## MEMORY VERSE\n"Love your neighbor as yourself."\n\n# 2. Teach\n\n## BIG PICTURE\nJesus taught that everyone is our neighbor.\n\n## TEACH THE STORY\nOnce a man was traveling and was attacked...',
      category: 'THE GOSPELS',
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
  lesson_activities: [],
  lesson_videos: [],
  attachments: [],
  lesson_progress: [] as LessonProgress[],
  lesson_schedules: [] as LessonSchedule[]
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
      const id = lesson.id && lesson.id !== 'new' ? lesson.id : Math.random().toString(36).substr(2, 9);
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

      saveDB(db);
      return newLesson;
    },
    async delete(id: string) {
      const db = getDB();
      db.lessons = db.lessons.filter((l: Lesson) => l.id !== id);
      saveDB(db);
    }
  },
  schedules: {
    async list() {
      const db = getDB();
      return db.lesson_schedules.map((s: any) => ({
        ...s,
        lesson: db.lessons.find((l: any) => l.id === s.lesson_id)
      }));
    },
    async getForDate(date: string) {
      const db = getDB();
      const sch = db.lesson_schedules.find((s: any) => s.scheduled_date === date);
      if (!sch) return null;
      return {
        ...sch,
        lesson: db.lessons.find((l: any) => l.id === sch.lesson_id)
      };
    },
    async upsert(schedule: { lesson_id: string; scheduled_date: string }) {
      const db = getDB();
      const existingIdx = db.lesson_schedules.findIndex((s: any) => s.scheduled_date === schedule.scheduled_date);
      const newSchedule = {
        id: Math.random().toString(36).substr(2, 9),
        ...schedule
      };
      if (existingIdx >= 0) db.lesson_schedules[existingIdx] = newSchedule;
      else db.lesson_schedules.push(newSchedule);
      saveDB(db);
      return newSchedule;
    },
    async delete(id: string) {
      const db = getDB();
      db.lesson_schedules = db.lesson_schedules.filter((s: any) => s.id !== id);
      saveDB(db);
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
  }
};
