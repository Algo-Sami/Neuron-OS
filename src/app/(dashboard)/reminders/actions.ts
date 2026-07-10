"use server"

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface SubjectDb {
  id: string;
  name: string;
  color: string;
}

interface ReminderDb {
  id: string;
  title: string;
  due_date: string;
  reminder_type: string;
  completed_status: boolean;
  description: string | null;
  priority?: string | null;
  subject_id: string | null;
  subjects: SubjectDb | SubjectDb[] | null;
}

interface ReminderPayload {
  user_id: string;
  title: string;
  due_date: string;
  reminder_type: 'assignment' | 'exam' | 'quiz' | 'presentation' | 'generic';
  completed_status: boolean;
  description: string;
  priority?: 'low' | 'medium' | 'high';
  subject_id: string | null;
}

export async function getReminders() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('reminders')
    .select(`
      id,
      title,
      due_date,
      reminder_type,
      completed_status,
      description,
      priority,
      subject_id,
      subjects (
        id,
        name,
        color
      )
    `)
    .eq('user_id', user.id)
    .order('due_date', { ascending: true })

  if (error) {
    if (error.message.includes('priority')) {
      const retryResult = await supabase
        .from('reminders')
        .select(`
          id,
          title,
          due_date,
          reminder_type,
          completed_status,
          description,
          subject_id,
          subjects (
            id,
            name,
            color
          )
        `)
        .eq('user_id', user.id)
        .order('due_date', { ascending: true })
      if (retryResult.error) throw new Error(retryResult.error.message)
      
      const retryData = (retryResult.data as unknown as ReminderDb[]) || [];
      return retryData.map(r => {
        let subjectsObj: SubjectDb | null = null;
        if (r.subjects) {
          if (Array.isArray(r.subjects)) {
            subjectsObj = r.subjects[0] || null;
          } else {
            subjectsObj = r.subjects;
          }
        }
        return {
          id: r.id,
          title: r.title,
          due_date: r.due_date,
          reminder_type: r.reminder_type as 'assignment' | 'exam' | 'quiz' | 'presentation' | 'generic',
          completed_status: r.completed_status,
          description: r.description,
          subject_id: r.subject_id,
          priority: 'medium' as const,
          subjects: subjectsObj
        };
      })
    }
    throw new Error(error.message)
  }

  const remindersData = (data as unknown as ReminderDb[]) || [];
  return remindersData.map(r => {
    let subjectsObj: SubjectDb | null = null;
    if (r.subjects) {
      if (Array.isArray(r.subjects)) {
        subjectsObj = r.subjects[0] || null;
      } else {
        subjectsObj = r.subjects;
      }
    }
    return {
      id: r.id,
      title: r.title,
      due_date: r.due_date,
      reminder_type: r.reminder_type as 'assignment' | 'exam' | 'quiz' | 'presentation' | 'generic',
      completed_status: r.completed_status,
      description: r.description,
      subject_id: r.subject_id,
      priority: (r.priority || 'medium') as 'low' | 'medium' | 'high',
      subjects: subjectsObj
    };
  })
}

export async function getSubjects() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('subjects')
    .select('id, name, color')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

export async function toggleReminder(id: string, currentStatus: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('reminders')
    .update({ completed_status: !currentStatus })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/reminders')
  revalidatePath('/dashboard')
}

export async function addReminder(
  title: string,
  dueDate: string,
  type: 'assignment' | 'exam' | 'quiz' | 'presentation' | 'generic',
  priority: 'low' | 'medium' | 'high' = 'medium',
  subjectId?: string | null,
  description?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const payload: ReminderPayload = {
    user_id: user.id,
    title,
    due_date: new Date(dueDate).toISOString(),
    reminder_type: type,
    completed_status: false,
    description: description || 'Added manually via Reminders page',
    priority,
    subject_id: subjectId || null
  }

  const { error } = await supabase
    .from('reminders')
    .insert(payload)

  if (error) {
    if (error.message.includes('priority')) {
      const fallbackPayload = { ...payload }
      delete fallbackPayload.priority
      const { error: fallbackError } = await supabase
        .from('reminders')
        .insert(fallbackPayload)
      if (fallbackError) throw new Error(fallbackError.message)
    } else {
      throw new Error(error.message)
    }
  }

  revalidatePath('/reminders')
  revalidatePath('/dashboard')
}

interface ReminderUpdates {
  title?: string
  due_date?: string
  reminder_type?: 'assignment' | 'exam' | 'quiz' | 'presentation' | 'generic'
  priority?: 'low' | 'medium' | 'high'
  subject_id?: string | null
  description?: string
  completed_status?: boolean
}

export async function updateReminder(
  id: string,
  updates: ReminderUpdates
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const payload: Record<string, unknown> = { ...updates }
  if (updates.due_date) {
    payload.due_date = new Date(updates.due_date).toISOString()
  }

  const { error } = await supabase
    .from('reminders')
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    if (error.message.includes('priority')) {
      const fallbackPayload = { ...payload }
      delete fallbackPayload.priority
      const { error: fallbackError } = await supabase
        .from('reminders')
        .update(fallbackPayload)
        .eq('id', id)
        .eq('user_id', user.id)
      if (fallbackError) throw new Error(fallbackError.message)
    } else {
      throw new Error(error.message)
    }
  }

  revalidatePath('/reminders')
  revalidatePath('/dashboard')
}

export async function deleteReminder(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/reminders')
  revalidatePath('/dashboard')
}
