
import { supabase } from '../lib/supabaseClient.ts';
import { UserRole, LessonStatus, Lesson, LessonActivity, LessonVideo, Attachment, LessonProgress, LessonSchedule } from '../types.ts';

/**
 * Robust LocalStorage fallback for schedules if the table doesn't exist yet.
 */
const LOCAL_SCHEDULE_KEY = 'kk_local_schedules';

const getLocalSchedules = (): LessonSchedule[] => {
  try {
    const data = localStorage.getItem(LOCAL_SCHEDULE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

const saveLocalSchedules = (schedules: LessonSchedule[]) => {
  localStorage.setItem(LOCAL_SCHEDULE_KEY, JSON.stringify(schedules));
};

const handleSupabaseError = (error: any, context: string) => {
  console.error(`Supabase Error [${context}]:`, error);
  const message = error.message || error.details || JSON.stringify(error);
  // We throw unless it's a "table not found" error which we handle in specific methods
  throw new Error(`${message} (Context: ${context})`);
};

const isTableNotFoundError = (error: any) => {
  return error?.message?.includes('Could not find the table') || error?.code === 'PGRST116';
};

export const db = {
  lessons: {
    async list(role: UserRole) {
      let query = supabase
        .from('lessons')
        .select(`
          *,
          videos:lesson_videos(*)
        `)
        .order('created_at', { ascending: false });

      if (role === UserRole.TEACHER) {
        query = query.eq('status', LessonStatus.PUBLISHED);
      }

      const { data, error } = await query;
      if (error) handleSupabaseError(error, 'fetching lessons');
      return data as Lesson[];
    },

    async get(id: string) {
      const { data, error } = await supabase
        .from('lessons')
        .select(`
          *,
          activities:lesson_activities(*),
          videos:lesson_videos(*),
          attachments:attachments(*)
        `)
        .eq('id', id)
        .single();

      if (error) handleSupabaseError(error, 'fetching lesson details');
      return data as Lesson;
    },

    async upsert(
      lesson: Partial<Lesson>, 
      activities?: Partial<LessonActivity>[], 
      videos?: Partial<LessonVideo>[],
      attachments?: Partial<Attachment>[]
    ) {
      const { 
        id, 
        activities: _a, 
        videos: _v, 
        attachments: _at, 
        progress: _p,
        ...lessonPayload 
      } = lesson;

      const payload = id && id !== 'new' ? { id, ...lessonPayload } : lessonPayload;

      const { data: lessonData, error: lError } = await supabase
        .from('lessons')
        .upsert({
          ...payload,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (lError) handleSupabaseError(lError, 'saving lesson');

      if (activities && lessonData) {
        await supabase.from('lesson_activities').delete().eq('lesson_id', lessonData.id);
        if (activities.length > 0) {
          const activitiesToInsert = activities.map((a, i) => {
            const { id: _, lesson_id: __, ...rest } = a;
            return { ...rest, lesson_id: lessonData.id, sort_order: i };
          });
          await supabase.from('lesson_activities').insert(activitiesToInsert);
        }
      }

      if (videos && lessonData) {
        await supabase.from('lesson_videos').delete().eq('lesson_id', lessonData.id);
        if (videos.length > 0) {
          const videosToInsert = videos.map((v, i) => {
            const { id: _, lesson_id: __, ...rest } = v;
            return { ...rest, lesson_id: lessonData.id, sort_order: i };
          });
          await supabase.from('lesson_videos').insert(videosToInsert);
        }
      }

      if (attachments && lessonData) {
        await supabase.from('attachments').delete().eq('lesson_id', lessonData.id);
        if (attachments.length > 0) {
          const attachmentsToInsert = attachments.map((at) => ({
            name: at.name,
            storage_path: at.storage_path,
            lesson_id: lessonData.id
          }));
          await supabase.from('attachments').insert(attachmentsToInsert);
        }
      }

      return lessonData;
    },

    async delete(id: string) {
      const { error } = await supabase.from('lessons').delete().eq('id', id);
      if (error) handleSupabaseError(error, 'deleting lesson');
    }
  },

  schedules: {
    async list() {
      const { data, error } = await supabase
        .from('lesson_schedules')
        .select('*, lesson:lessons(*)')
        .order('scheduled_date', { ascending: true });

      if (error) {
        if (isTableNotFoundError(error)) {
          console.warn("Table 'lesson_schedules' not found. Falling back to LocalStorage.");
          const locals = getLocalSchedules();
          // To populate lesson details for local storage we need to fetch them
          const lessons = await db.lessons.list(UserRole.ADMIN);
          return locals.map(l => ({ ...l, lesson: lessons.find(less => less.id === l.lesson_id) }));
        }
        handleSupabaseError(error, 'fetching schedules');
      }
      return data as LessonSchedule[];
    },

    async getForDate(date: string) {
      const { data, error } = await supabase
        .from('lesson_schedules')
        .select('*, lesson:lessons(*)')
        .eq('scheduled_date', date)
        .maybeSingle();

      if (error) {
        if (isTableNotFoundError(error)) {
          const locals = getLocalSchedules();
          const match = locals.find(l => l.scheduled_date === date);
          if (!match) return null;
          const lesson = await db.lessons.get(match.lesson_id);
          return { ...match, lesson };
        }
        handleSupabaseError(error, 'fetching schedule for date');
      }
      return data as LessonSchedule;
    },

    async upsert(schedule: { lesson_id: string; scheduled_date: string }) {
      const { data, error } = await supabase
        .from('lesson_schedules')
        .upsert(schedule, { onConflict: 'scheduled_date' })
        .select()
        .single();

      if (error) {
        if (isTableNotFoundError(error)) {
          const locals = getLocalSchedules();
          const existingIdx = locals.findIndex(l => l.scheduled_date === schedule.scheduled_date);
          const newItem = { id: Math.random().toString(36).substr(2, 9), ...schedule };
          if (existingIdx >= 0) locals[existingIdx] = newItem;
          else locals.push(newItem);
          saveLocalSchedules(locals);
          return newItem;
        }
        handleSupabaseError(error, 'upserting schedule');
      }
      return data;
    },

    async delete(id: string) {
      const { error } = await supabase.from('lesson_schedules').delete().eq('id', id);
      if (error) {
        if (isTableNotFoundError(error)) {
          const locals = getLocalSchedules();
          saveLocalSchedules(locals.filter(l => l.id !== id));
          return;
        }
        handleSupabaseError(error, 'deleting schedule');
      }
    }
  },

  progress: {
    async get(lessonId: string, teacherId: string) {
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('teacher_id', teacherId)
        .maybeSingle();
      
      if (error) handleSupabaseError(error, 'fetching progress');
      return data as LessonProgress;
    },

    async toggle(lessonId: string, teacherId: string) {
      const existing = await this.get(lessonId, teacherId);
      if (existing) {
        await supabase
          .from('lesson_progress')
          .update({ 
            completed: !existing.completed,
            completed_at: !existing.completed ? new Date().toISOString() : null
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('lesson_progress')
          .insert({
            lesson_id: lessonId,
            teacher_id: teacherId,
            completed: true,
            completed_at: new Date().toISOString()
          });
      }
    }
  }
};
