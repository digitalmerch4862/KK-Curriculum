
import { supabase } from '../lib/supabaseClient.ts';
import { UserRole, LessonStatus, Lesson, LessonActivity, LessonVideo, Attachment, LessonProgress } from '../types.ts';

const handleSupabaseError = (error: any, context: string) => {
  console.error(`Supabase Error [${context}]:`, error);
  const message = error.message || error.details || JSON.stringify(error);
  throw new Error(`${message} (Context: ${context})`);
};

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

      // If id is 'new', we let Supabase generate a UUID
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
        const { error: dError } = await supabase.from('lesson_activities').delete().eq('lesson_id', lessonData.id);
        if (dError) handleSupabaseError(dError, 'cleaning up old activities');

        if (activities.length > 0) {
          const activitiesToInsert = activities.map((a, i) => {
            const { id: _, lesson_id: __, ...rest } = a;
            return {
              ...rest,
              lesson_id: lessonData.id,
              sort_order: i
            };
          });
          const { error: aError } = await supabase.from('lesson_activities').insert(activitiesToInsert);
          if (aError) handleSupabaseError(aError, 'saving activities');
        }
      }

      if (videos && lessonData) {
        const { error: dvError } = await supabase.from('lesson_videos').delete().eq('lesson_id', lessonData.id);
        if (dvError) handleSupabaseError(dvError, 'cleaning up old videos');

        if (videos.length > 0) {
          const videosToInsert = videos.map((v, i) => {
            const { id: _, lesson_id: __, ...rest } = v;
            return {
              ...rest,
              lesson_id: lessonData.id,
              sort_order: i
            };
          });
          const { error: vError } = await supabase.from('lesson_videos').insert(videosToInsert);
          if (vError) handleSupabaseError(vError, 'saving videos');
        }
      }

      if (attachments && lessonData) {
        const { error: daError } = await supabase.from('attachments').delete().eq('lesson_id', lessonData.id);
        if (daError) handleSupabaseError(daError, 'cleaning up old attachments');

        if (attachments.length > 0) {
          const attachmentsToInsert = attachments.map((at) => {
            // Strictly include ONLY the fields that exist in the schema
            return {
              name: at.name,
              storage_path: at.storage_path,
              lesson_id: lessonData.id
              // Explicitly omitting: sort_order, size_bytes, type, created_at, id
            };
          });
          const { error: atError } = await supabase.from('attachments').insert(attachmentsToInsert);
          if (atError) handleSupabaseError(atError, 'saving attachments');
        }
      }

      return lessonData;
    },

    async delete(id: string) {
      const { error } = await supabase.from('lessons').delete().eq('id', id);
      if (error) handleSupabaseError(error, 'deleting lesson');
    }
  },

  attachments: {
    async add(attachment: Omit<Attachment, 'id' | 'created_at'>) {
      // Stripping all invalid fields from payload
      const payload = {
        name: attachment.name,
        storage_path: attachment.storage_path,
        lesson_id: attachment.lesson_id
      };
      const { data, error } = await supabase
        .from('attachments')
        .insert(payload)
        .select()
        .single();
      if (error) handleSupabaseError(error, 'adding attachment record');
      return data;
    },
    async remove(id: string, storagePath: string) {
      if (storagePath && !storagePath.startsWith('http')) {
        const { error: sError } = await supabase.storage.from('lesson-assets').remove([storagePath]);
        if (sError) console.warn("Storage removal failed", sError);
      }
      
      const { error: dError } = await supabase.from('attachments').delete().eq('id', id);
      if (dError) handleSupabaseError(dError, 'removing attachment record');
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
