import { createClient } from '@/lib/supabase/client'

export interface NoteAttachment {
  name: string
  url: string
  type: 'image' | 'document'
  size: number
  mimeType: string
}

export interface Note {
  id: string
  user_id: string
  note_date: string
  title: string | null
  content: string
  attachments: NoteAttachment[]
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface CreateNoteInput {
  note_date?: string
  title?: string | null
  content: string
  attachments?: NoteAttachment[]
}

export interface UpdateNoteInput {
  title?: string | null
  content?: string
  note_date?: string
  attachments?: NoteAttachment[]
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export async function getNotes(userId: string, from: string, to: string): Promise<Note[]> {
  const { data } = await createClient()
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .gte('note_date', from)
    .lte('note_date', to)
    .order('note_date', { ascending: false })
    .order('created_at', { ascending: false })
  return (data ?? []) as Note[]
}

export async function getAllNotes(userId: string, limit = 100, offset = 0): Promise<Note[]> {
  const { data } = await createClient()
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('note_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  return (data ?? []) as Note[]
}

export async function searchNotes(userId: string, query: string): Promise<Note[]> {
  const { data } = await createClient()
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .order('note_date', { ascending: false })
    .limit(50)
  return (data ?? []) as Note[]
}

export async function getNoteById(id: string): Promise<Note | null> {
  const { data } = await createClient()
    .from('notes')
    .select('*')
    .eq('id', id)
    .single()
  return (data ?? null) as Note | null
}

export async function createNote(userId: string, input: CreateNoteInput): Promise<Note | null> {
  const { data, error } = await createClient()
    .from('notes')
    .insert({
      user_id:     userId,
      note_date:   input.note_date ?? todayISO(),
      title:       input.title ?? null,
      content:     input.content,
      attachments: input.attachments ?? [],
    })
    .select()
    .single()
  if (error) { console.error('createNote:', error); return null }
  return data as Note
}

export async function updateNote(id: string, input: UpdateNoteInput): Promise<Note | null> {
  const payload: Record<string, unknown> = {}
  if (input.title !== undefined)       payload.title = input.title
  if (input.content !== undefined)     payload.content = input.content
  if (input.note_date !== undefined)   payload.note_date = input.note_date
  if (input.attachments !== undefined) payload.attachments = input.attachments

  const { data, error } = await createClient()
    .from('notes')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) { console.error('updateNote:', error); return null }
  return data as Note
}

export async function deleteNote(id: string): Promise<boolean> {
  const { error } = await createClient()
    .from('notes')
    .update({ is_deleted: true })
    .eq('id', id)
  return !error
}
