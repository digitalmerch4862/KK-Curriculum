
import { supabase } from '../lib/supabaseClient.ts';
import { UserRole, LessonStatus, Lesson, LessonActivity, LessonVideo, Attachment, LessonProgress, LessonSchedule } from '../types.ts';

/**
 * Enhanced error handler that returns true if the error is a "missing entity" warning
 * (allowing the caller to return a safe default) or throws if it's a fatal error.
 */
const handleSupabaseError = (error: any, context: string): boolean => {
  // Check for common schema mismatch codes or messages
  if (error.code === '42P01' || // undefined_table
      error.code === '42703' || // undefined_column
      error.message?.includes('Could not find the table') || 
      error.message?.includes('cache') || 
      error.message?.includes('column')) {
    console.warn(`Supabase Warning [${context}]: Entity or column missing in schema. Falling back to mock/local behavior.`);
    return true; // isMissing
  }
  console.error(`Supabase Error [${context}]:`, error);
  const message = error.message || error.details || JSON.stringify(error);
  throw new Error(`${message} (Context: ${context})`);
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

      if (error) {
        if (handleSupabaseError(error, 'fetching lessons')) return [];
      }
      return (data || []) as Lesson[];
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

      if (error) {
        if (handleSupabaseError(error, 'fetching lesson details')) return null;
      }
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
        published_at: _pa,
        ...lessonPayload 
      } = lesson;

      const payload = id && id !== 'new' ? { id, ...lessonPayload } : lessonPayload;

      const { data: lessonData, error: lError } = await supabase
        .from('lessons')
        .upsert({
          ...payload,
          updated_at: new Date().toISOString()
        })
        .select();

      if (lError) handleSupabaseError(lError, 'saving lesson');
      
      const savedLesson = lessonData?.[0];

      if (activities && savedLesson) {
        const { error: dError } = await supabase.from('lesson_activities').delete().eq('lesson_id', savedLesson.id);
        if (dError) handleSupabaseError(dError, 'cleaning up old activities');

        if (activities.length > 0) {
          const activitiesToInsert = activities.map((a, i) => {
            const { id: _, lesson_id: __, ...rest } = a;
            return {
              ...rest,
              lesson_id: savedLesson.id,
              sort_order: i
            };
          });
          const { error: aError } = await supabase.from('lesson_activities').insert(activitiesToInsert);
          if (aError) handleSupabaseError(aError, 'saving activities');
        }
      }

      if (videos && savedLesson) {
        const { error: dvError } = await supabase.from('lesson_videos').delete().eq('lesson_id', savedLesson.id);
        if (dvError) handleSupabaseError(dvError, 'cleaning up old videos');

        if (videos.length > 0) {
          const videosToInsert = videos.map((v, i) => {
            const { id: _, lesson_id: __, ...rest } = v;
            return {
              ...rest,
              lesson_id: savedLesson.id,
              sort_order: i
            };
          });
          const { error: vError } = await supabase.from('lesson_videos').insert(videosToInsert);
          if (vError) handleSupabaseError(vError, 'saving videos');
        }
      }

      if (attachments && savedLesson) {
        const { error: daError } = await supabase.from('attachments').delete().eq('lesson_id', savedLesson.id);
        if (daError) handleSupabaseError(daError, 'cleaning up old attachments');

        if (attachments.length > 0) {
          const attachmentsToInsert = attachments.map((at) => {
            return {
              name: at.name,
              storage_path: at.storage_path,
              lesson_id: savedLesson.id
            };
          });
          const { error: atError } = await supabase.from('attachments').insert(attachmentsToInsert);
          if (atError) handleSupabaseError(atError, 'saving attachments');
        }
      }

      return savedLesson;
    },

    async delete(id: string) {
      const { error } = await supabase.from('lessons').delete().eq('id', id);
      if (error) handleSupabaseError(error, 'deleting lesson');
    }
  },

  schedules: {
    async list() {
      // Fetch raw schedules from 'schedules' table
      const { data: rawSchedules, error: sError } = await supabase
        .from('schedules')
        .select('*')
        .order('date', { ascending: true });
      
      if (sError) {
        if (handleSupabaseError(sError, 'fetching raw schedules')) return [];
      }

      if (!rawSchedules || rawSchedules.length === 0) return [];

      // Manually fetch lessons for these schedules using 'lesson_id'
      const lessonIds = [...new Set(rawSchedules.map(s => s.lesson_id))];
      const { data: relatedLessons, error: lError } = await supabase
        .from('lessons')
        .select('*')
        .in('id', lessonIds);
      
      if (lError) handleSupabaseError(lError, 'fetching related lessons for schedules');

      const lessonsMap = new Map((relatedLessons || []).map(l => [l.id, l]));

      return rawSchedules.map(sch => ({
        ...sch,
        lesson: lessonsMap.get(sch.lesson_id)
      })) as LessonSchedule[];
    },

    async getForDate(date: string) {
      const { data: schData, error: sError } = await supabase
        .from('schedules')
        .select('*')
        .eq('date', date)
        .maybeSingle();
      
      if (sError) {
        if (handleSupabaseError(sError, 'fetching schedule for date')) return null;
      }

      if (!schData) return null;

      // Fetch lesson details separately using 'lesson_id'
      const lesson = await db.lessons.get(schData.lesson_id);
      return { ...schData, lesson } as LessonSchedule;
    },

    async upsert(schedule: Partial<LessonSchedule>) {
      const cleanSchedule = Object.fromEntries(
        Object.entries(schedule).filter(([_, v]) => v !== undefined)
      );

      // CRITICAL: Extract 'lesson' object to avoid sending it to Supabase as a column, which causes errors
      const { lesson, ...dbPayload } = cleanSchedule as any;

      const { data, error } = await supabase
        .from('schedules')
        .upsert(dbPayload)
        .select();
      
      if (error) {
        // Fallback Logic: If DB write fails due to schema issues, return a temp object so UI updates anyway
        if (handleSupabaseError(error, 'saving schedule')) {
          return { 
            ...schedule, 
            id: schedule.id || 'temp-id-' + Date.now().toString() 
          } as LessonSchedule;
        }
        return null;
      }
      return (data?.[0] || null) as LessonSchedule;
    },

    async delete(id: string) {
      // If it's a temp ID (fallback mode), we don't need to call DB
      if (id.startsWith('temp-id-')) return; 

      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) handleSupabaseError(error, 'deleting schedule');
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
      
      if (error) {
        if (handleSupabaseError(error, 'fetching progress')) return null;
      }
      return data as LessonProgress;
    },

    async toggle(lessonId: string, teacherId: string) {
      const existing = await this.get(lessonId, teacherId);
      if (existing) {
        const { error } = await supabase
          .from('lesson_progress')
          .update({ 
            completed: !existing.completed,
            completed_at: !existing.completed ? new Date().toISOString() : null
          })
          .eq('id', existing.id);
        if (error) handleSupabaseError(error, 'updating progress');
      } else {
        const { error } = await supabase
          .from('lesson_progress')
          .insert({
            lesson_id: lessonId,
            teacher_id: teacherId,
            completed: true,
            completed_at: new Date().toISOString()
          });
        if (error) handleSupabaseError(error, 'creating progress');
      }
    }
  }
};
