
import { supabase } from '../lib/supabaseClient';
import { UserRole, LessonStatus, Lesson, LessonActivity, LessonVideo, Attachment, LessonProgress } from '../types';

export const db = {
  lessons: {
    async list(role: UserRole) {
      let query = supabase
        .from('lessons')
        .select('*')
        .order('created_at', { ascending: false });

      if (role === UserRole.TEACHER) {
        query = query.eq('status', LessonStatus.PUBLISHED);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Lesson[];
    },

    async get(id: string) {
      const { data: lesson, error: lError } = await supabase
        .from('lessons')
        .select(`
          *,
          activities:lesson_activities(*),
          videos:lesson_videos(*),
          attachments:attachments(*)
        `)
        .eq('id', id)
        .single();

      if (lError) return null;
      return lesson as Lesson;
    },

    async upsert(
      lesson: Partial<Lesson>, 
      activities?: Partial<LessonActivity>[], 
      videos?: Partial<LessonVideo>[]
    ) {
      const { data: lessonData, error: lError } = await supabase
        .from('lessons')
        .upsert({
          ...lesson,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (lError) throw lError;

      if (activities && lessonData) {
        await supabase.from('lesson_activities').delete().eq('lesson_id', lessonData.id);
        const activitiesToInsert = activities.map((a, i) => ({
          ...a,
          lesson_id: lessonData.id,
          sort_order: i
        }));
        if (activitiesToInsert.length > 0) {
          const { error } = await supabase.from('lesson_activities').insert(activitiesToInsert);
          if (error) throw error;
        }
      }

      if (videos && lessonData) {
        await supabase.from('lesson_videos').delete().eq('lesson_id', lessonData.id);
        const videosToInsert = videos.map((v, i) => ({
          ...v,
          lesson_id: lessonData.id,
          sort_order: i
        }));
        if (videosToInsert.length > 0) {
          const { error } = await supabase.from('lesson_videos').insert(videosToInsert);
          if (error) throw error;
        }
      }

      return lessonData;
    },

    async delete(id: string) {
      const { error } = await supabase.from('lessons').delete().eq('id', id);
      if (error) throw error;
    }
  },

  attachments: {
    async add(attachment: Omit<Attachment, 'id' | 'created_at'>) {
      const { data, error } = await supabase
        .from('attachments')
        .insert(attachment)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async remove(id: string, storagePath: string) {
      await supabase.storage.from('lesson-assets').remove([storagePath]);
      const { error } = await supabase.from('attachments').delete().eq('id', id);
      if (error) throw error;
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
      
      if (error) return null;
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
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lesson_progress')
          .insert({
            lesson_id: lessonId,
            teacher_id: teacherId,
            completed: true,
            completed_at: new Date().toISOString()
          });
        if (error) throw error;
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
      
      if (error) throw error;
      return data;
    },

    async getSignedUrl(path: string) {
      const { data, error } = await supabase.storage
        .from('lesson-assets')
        .createSignedUrl(path, 3600);
      
      if (error) throw error;
      return data.signedUrl;
    }
  }
};
