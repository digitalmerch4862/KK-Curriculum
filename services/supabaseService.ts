
import { supabase } from '../lib/supabaseClient.ts';
import { UserRole, LessonStatus, Lesson, LessonActivity, LessonVideo, Attachment, LessonProgress, LessonOccurrence, PlannerConfig, FrequencyType } from '../types.ts';

/**
 * Custom error class to help the UI distinguish between 
 * data errors and structural (schema) errors.
 */
export class DatabaseError extends Error {
  isSchemaError: boolean;
  code?: string;
  constructor(message: string, isSchemaError: boolean = false, code?: string) {
    super(message);
    this.name = 'DatabaseError';
    this.isSchemaError = isSchemaError;
    this.code = code;
  }
}

const handleSupabaseError = (error: any, context: string) => {
  console.error(`Supabase Error [${context}]:`, error);
  
  const message = error.message || error.details || JSON.stringify(error);
  const code = error.code;
  
  // Detect Schema Cache issues (PGRST200)
  const isSchemaError = 
    code === 'PGRST200' || 
    code === '42P01' || 
    message.toLowerCase().includes('schema cache') || 
    message.toLowerCase().includes('not found in the schema cache');

  if (isSchemaError) {
    throw new DatabaseError(message, true, code);
  }

  throw new DatabaseError(`${message} (Context: ${context})`, false, code);
};

export const db = {
  lessons: {
    async list(role: UserRole) {
      let query = supabase.from('lessons').select(`*, videos:lesson_videos(*)`).order('created_at', { ascending: false });
      if (role === UserRole.TEACHER) query = query.eq('status', LessonStatus.PUBLISHED);
      const { data, error } = await query;
      if (error) handleSupabaseError(error, 'fetching lessons');
      return data as Lesson[];
    },
    async get(id: string) {
      const { data, error } = await supabase.from('lessons')
        .select(`*, activities:lesson_activities(*), videos:lesson_videos(*), attachments:attachments(*)`)
        .eq('id', id).single();
      if (error) handleSupabaseError(error, 'fetching lesson details');
      return data as Lesson;
    },
    async upsert(lesson: Partial<Lesson>, activities?: Partial<LessonActivity>[], videos?: Partial<LessonVideo>[], attachments?: Partial<Attachment>[]) {
      const { id, activities: _a, videos: _v, attachments: _at, progress: _p, ...payload } = lesson;
      const { data, error } = await supabase.from('lessons').upsert({ ...payload, id: id === 'new' ? undefined : id, updated_at: new Date().toISOString() }).select().single();
      if (error) handleSupabaseError(error, 'saving lesson');

      if (activities && data) {
        await supabase.from('lesson_activities').delete().eq('lesson_id', data.id);
        if (activities.length > 0) {
          const acts = activities.map((a, i) => ({ ...a, lesson_id: data.id, sort_order: i }));
          await supabase.from('lesson_activities').insert(acts);
        }
      }

      if (videos && data) {
        await supabase.from('lesson_videos').delete().eq('lesson_id', data.id);
        if (videos.length > 0) {
          const vids = videos.map((v, i) => ({ ...v, lesson_id: data.id, sort_order: i }));
          await supabase.from('lesson_videos').insert(vids);
        }
      }

      if (attachments && data) {
        await supabase.from('attachments').delete().eq('lesson_id', data.id);
        if (attachments.length > 0) {
          const atts = attachments.map(at => ({ name: at.name, storage_path: at.storage_path, lesson_id: data.id }));
          await supabase.from('attachments').insert(atts);
        }
      }

      return data;
    },
    async delete(id: string) {
      const { error } = await supabase.from('lessons').delete().eq('id', id);
      if (error) handleSupabaseError(error, 'deleting lesson');
    }
  },

  plannerConfigs: {
    async get(category: string) {
      const { data, error } = await supabase.from('planner_configs').select('*').eq('category', category).maybeSingle();
      if (error) handleSupabaseError(error, 'fetching config');
      return data as PlannerConfig;
    },
    async upsert(config: Partial<PlannerConfig>) {
      const { error } = await supabase.from('planner_configs').upsert(config);
      if (error) handleSupabaseError(error, 'saving config');
    }
  },

  plannerOccurrences: {
    async generateBatch(category: string, frequency: FrequencyType, count: number, startDateStr?: string) {
      const config = await db.plannerConfigs.get(category);
      const baseDate = startDateStr ? new Date(startDateStr) : (config ? new Date(config.start_date) : new Date());
      const slotsToGenerate: string[] = [];

      for (let i = 0; i < count; i++) {
        let d = new Date(baseDate);
        if (frequency === 'DAILY') {
          d.setDate(baseDate.getDate() + i);
        } else if (frequency === 'WEEKLY') {
          d.setDate(baseDate.getDate() + (i * 7));
        } else if (frequency === 'MONTHLY') {
          d.setMonth(baseDate.getMonth() + i);
          d.setDate(1); 
        }
        slotsToGenerate.push(d.toISOString().split('T')[0]);
      }

      if (slotsToGenerate.length > 0) {
        const payloads = slotsToGenerate.map(date => ({
          category,
          scheduled_date: date,
          status: 'SCHEDULED'
        }));
        const { error } = await supabase.from('planner_occurrences').upsert(payloads, { onConflict: 'category,scheduled_date' });
        if (error) handleSupabaseError(error, 'generating slots');
      }
    },

    async upsertOccurrence(category: string, date: string, lessonId: string) {
      const { error } = await supabase.from('planner_occurrences').upsert({
        category,
        scheduled_date: date,
        lesson_id: lessonId,
        status: 'SCHEDULED'
      }, { onConflict: 'category,scheduled_date' });
      if (error) handleSupabaseError(error, 'dispatching targeted mission');
    },

    async wipeCategory(category: string) {
      const { error } = await supabase.from('planner_occurrences').delete().eq('category', category);
      if (error) handleSupabaseError(error, 'wiping timeline');
    },

    async getNextForTeacher(category: string = 'HISTORY') {
      const now = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('planner_occurrences')
        .select(`*, lesson:lessons!lesson_id(title, summary)`)
        .eq('category', category)
        .gte('scheduled_date', now)
        .eq('status', 'SCHEDULED')
        .not('lesson_id', 'is', null)
        .order('scheduled_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) handleSupabaseError(error, 'fetching next mission');
      return data as LessonOccurrence;
    },

    async list(category: string) {
      const { data, error } = await supabase
        .from('planner_occurrences')
        .select(`*, lesson:lessons!lesson_id(title, summary)`)
        .eq('category', category)
        .order('scheduled_date', { ascending: true })
        .limit(150);

      if (error) handleSupabaseError(error, 'fetching schedule');
      return data as LessonOccurrence[];
    },

    async assignLesson(occurrenceId: string, lessonId: string) {
      const { error } = await supabase.from('planner_occurrences').update({ lesson_id: lessonId }).eq('id', occurrenceId);
      if (error) handleSupabaseError(error, 'assigning lesson');
    },

    async deleteOccurrence(id: string) {
      const { error } = await supabase.from('planner_occurrences').delete().eq('id', id);
      if (error) handleSupabaseError(error, 'deleting slot');
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
  },

  storage: {
    async upload(file: File) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('lesson-assets')
        .upload(fileName, file);
      
      if (error) handleSupabaseError(error, 'uploading file');
      return data;
    },

    async getSignedUrl(path: string) {
      const { data, error } = await supabase.storage
        .from('lesson-assets')
        .createSignedUrl(path, 3600);
      
      if (error) handleSupabaseError(error, 'generating download link');
      return data.signedUrl;
    }
  }
};
