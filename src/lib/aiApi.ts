interface DraftMemoInput {
  title: string
  background: string
  analysis: string
  recommendation: string
  priority: string
}

interface DraftMemoOutput {
  background: string
  analysis: string
  recommendation: string
  suggested_priority: 'High' | 'Medium' | 'Low'
  suggested_approver_count: number
  include_final_authority: boolean
  external_implication: boolean
  institutional_implication: boolean
  attachment_hint: string
}

interface SnapshotInput {
  title: string
  background: string
  analysis: string
  recommendation: string
  status: string
  mode: string
}

interface SnapshotOutput {
  snapshot: string
  top_risks: string[]
  decision_prompt: string
}

const AI_BASE_URL = import.meta.env.VITE_AI_BASE_URL ?? 'http://127.0.0.1:8787'

async function postJSON<TResponse>(path: string, payload: unknown): Promise<TResponse> {
  const response = await fetch(`${AI_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`AI request failed: ${text}`)
  }

  return (await response.json()) as TResponse
}

export async function draftMemoWithAI(input: DraftMemoInput): Promise<DraftMemoOutput> {
  return postJSON<DraftMemoOutput>('/api/ai/draft-memo', input)
}

export async function createSnapshotWithAI(input: SnapshotInput): Promise<SnapshotOutput> {
  return postJSON<SnapshotOutput>('/api/ai/snapshot', input)
}
