import { createClient } from '@supabase/supabase-js'
import { demoActions } from '../data/demoActions'
import { normalizeAction } from './workflowEngine'
import type { ActionStatus, ExecutiveAction } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null

const LOCAL_STORAGE_KEY = 'executive-actions-demo'

function readDemoStore() {
  const saved = window.localStorage.getItem(LOCAL_STORAGE_KEY)
  if (!saved) {
    const normalized = demoActions.map((action) => normalizeAction(action))
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized))
    return normalized
  }

  try {
    return (JSON.parse(saved) as ExecutiveAction[]).map((action) => normalizeAction(action))
  } catch {
    const normalized = demoActions.map((action) => normalizeAction(action))
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized))
    return normalized
  }
}

function writeDemoStore(actions: ExecutiveAction[]) {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(actions))
}

export async function getActions(): Promise<ExecutiveAction[]> {
  if (!supabase) {
    return readDemoStore()
  }

  const { data, error } = await supabase
    .from('executive_actions')
    .select('*')
    .order('due_date', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data as ExecutiveAction[]).map((action) => normalizeAction(action))
}

export async function createAction(
  action: Omit<ExecutiveAction, 'id' | 'created_at'>,
): Promise<ExecutiveAction> {
  const normalizedInput = normalizeAction(action as ExecutiveAction)

  if (!supabase) {
    const current = readDemoStore()
    const created: ExecutiveAction = {
      ...normalizedInput,
      id: String(Date.now()),
      created_at: new Date().toISOString(),
    }
    writeDemoStore([created, ...current])
    return created
  }

  const { data, error } = await supabase
    .from('executive_actions')
    .insert(normalizedInput)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return normalizeAction(data as ExecutiveAction)
}

export async function updateActionStatus(id: string, status: ActionStatus): Promise<void> {
  if (!supabase) {
    const current = readDemoStore()
    const next = current.map((item) => (item.id === id ? { ...item, status } : item))
    writeDemoStore(next)
    return
  }

  const { error } = await supabase.from('executive_actions').update({ status }).eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
}

export async function updateAction(action: ExecutiveAction): Promise<ExecutiveAction> {
  const normalized = normalizeAction(action)

  if (!supabase) {
    const current = readDemoStore()
    const next = current.map((item) => (item.id === normalized.id ? normalized : item))
    writeDemoStore(next)
    return normalized
  }

  const { data, error } = await supabase
    .from('executive_actions')
    .update({
      title: normalized.title,
      owner: normalized.owner,
      due_date: normalized.due_date,
      priority: normalized.priority,
      status: normalized.status,
      notes: normalized.notes,
      initiator: normalized.initiator,
      memo_body: normalized.memo_body,
      memo_background: normalized.memo_background,
      memo_analysis: normalized.memo_analysis,
      memo_recommendation: normalized.memo_recommendation,
      attachment_name: normalized.attachment_name,
      external_implication: normalized.external_implication,
      institutional_implication: normalized.institutional_implication,
      mode: normalized.mode,
      workflow_steps: normalized.workflow_steps,
      current_step_index: normalized.current_step_index,
      approval_history: normalized.approval_history,
    })
    .eq('id', normalized.id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return normalizeAction(data as ExecutiveAction)
}

export function getConnectionMode() {
  return hasSupabaseConfig ? 'supabase' : 'demo'
}
