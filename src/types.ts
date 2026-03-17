export type ActionStatus =
  | 'Draft'
  | 'In Review'
  | 'Sent Back'
  | 'Approved'
  | 'Rejected'
  | 'Completed'
  | 'Not Started'
  | 'In Progress'
  | 'At Risk'

export type ActionPriority = 'High' | 'Medium' | 'Low'

export type WorkflowMode = 'Light' | 'Standard' | 'Strict'

export type WorkflowStepStatus = 'Pending' | 'Approved' | 'Rejected' | 'Sent Back' | 'Skipped'

export type ApproverAvailability = 'Available' | 'Out of Office' | 'Departed'

export type ApproverKind = 'person' | 'role'

export type WorkflowEventType =
  | 'memo_created'
  | 'mode_inferred'
  | 'submitted_for_review'
  | 'approved'
  | 'rejected'
  | 'sent_back'
  | 'delegated'
  | 'substituted'
  | 'step_removed'
  | 'escalated'
  | 'status_changed'

export interface WorkflowStep {
  id: string
  order: number
  label: string
  approver_kind: ApproverKind
  approver_key: string
  approver_display: string
  resolved_approver: string
  required: boolean
  is_final: boolean
  is_observer: boolean
  availability: ApproverAvailability
  status: WorkflowStepStatus
  acted_by?: string
  acted_at?: string
  delegation_note?: string
  substitution_note?: string
}

export interface WorkflowEvent {
  id: string
  at: string
  by: string
  type: WorkflowEventType
  detail: string
}

export interface ExecutiveAction {
  id: string
  title: string
  owner: string
  due_date: string
  priority: ActionPriority
  status: ActionStatus
  notes: string
  created_at?: string
  initiator?: string
  memo_body?: string
  memo_background?: string
  memo_analysis?: string
  memo_recommendation?: string
  attachment_name?: string
  external_implication?: boolean
  institutional_implication?: boolean
  mode?: WorkflowMode
  workflow_steps?: WorkflowStep[]
  current_step_index?: number
  approval_history?: WorkflowEvent[]
}
