import type {
  ActionPriority,
  ActionStatus,
  ExecutiveAction,
  WorkflowEvent,
  WorkflowMode,
  WorkflowStep,
  WorkflowStepStatus,
} from '../types'

interface BuildWorkflowInput {
  title: string
  notes: string
  priority: ActionPriority
  owner: string
  includeFinalAuthority: boolean
  approverCount: number
  externalImplication: boolean
  institutionalImplication: boolean
}

const roleAssignments: Record<string, string> = {
  'director-bureau-x': 'Maya Director',
  'legal-counsel': 'Noah Counsel',
  'chief-finance-officer': 'Ari Finance',
  'sg-office': 'Secretary-General Office',
  'partnerships-head': 'Lina Partnerships',
}

const strictKeywords = ['legal', 'finance', 'hr', 'external', 'compliance', 'procurement', 'mou']

const standardKeywords = ['briefing', 'decision', 'policy', 'partnership', 'review', 'approval']

function createEvent(by: string, type: WorkflowEvent['type'], detail: string): WorkflowEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    by,
    type,
    detail,
  }
}

function countKeywordHits(value: string, keywords: string[]): number {
  const normalized = value.toLowerCase()
  return keywords.filter((keyword) => normalized.includes(keyword)).length
}

export function inferWorkflowMode(input: BuildWorkflowInput): WorkflowMode {
  const content = `${input.title} ${input.notes}`.trim()
  const strictHits = countKeywordHits(content, strictKeywords)
  const standardHits = countKeywordHits(content, standardKeywords)

  const strictSignals =
    strictHits >= 1 ||
    input.externalImplication ||
    input.institutionalImplication ||
    (input.priority === 'High' && input.includeFinalAuthority)

  if (strictSignals) {
    return 'Strict'
  }

  const standardSignals =
    input.priority === 'High' || input.approverCount >= 2 || standardHits >= 1 || input.includeFinalAuthority

  if (standardSignals) {
    return 'Standard'
  }

  return 'Light'
}

function inferStepLabel(index: number, mode: WorkflowMode, isFinal: boolean): string {
  if (isFinal) {
    return 'Final Authority'
  }
  if (index === 0) {
    return 'Primary Review'
  }
  if (mode === 'Strict') {
    return `Control Review ${index + 1}`
  }
  return `Review ${index + 1}`
}

function getDefaultRole(index: number, mode: WorkflowMode): string {
  if (mode === 'Strict') {
    const strictRoles = ['legal-counsel', 'chief-finance-officer', 'director-bureau-x']
    return strictRoles[index % strictRoles.length]
  }
  const standardRoles = ['director-bureau-x', 'partnerships-head']
  return standardRoles[index % standardRoles.length]
}

function resolveRole(roleKey: string): string {
  return roleAssignments[roleKey] ?? roleKey
}

export function buildWorkflow(input: BuildWorkflowInput): {
  mode: WorkflowMode
  workflow_steps: WorkflowStep[]
  current_step_index: number
  status: ActionStatus
  approval_history: WorkflowEvent[]
} {
  const mode = inferWorkflowMode(input)
  const baseSteps = Math.max(1, Math.min(input.approverCount, 4))
  const workflow_steps: WorkflowStep[] = []

  for (let index = 0; index < baseSteps; index += 1) {
    const roleKey = getDefaultRole(index, mode)
    workflow_steps.push({
      id: `step-${Date.now()}-${index}`,
      order: index,
      label: inferStepLabel(index, mode, false),
      approver_kind: 'role',
      approver_key: roleKey,
      approver_display: roleKey.replaceAll('-', ' '),
      resolved_approver: resolveRole(roleKey),
      required: true,
      is_final: false,
      is_observer: false,
      availability: 'Available',
      status: 'Pending',
    })
  }

  if (input.includeFinalAuthority) {
    workflow_steps.push({
      id: `step-${Date.now()}-final`,
      order: workflow_steps.length,
      label: inferStepLabel(workflow_steps.length, mode, true),
      approver_kind: 'role',
      approver_key: 'sg-office',
      approver_display: 'SG Office',
      resolved_approver: resolveRole('sg-office'),
      required: true,
      is_final: true,
      is_observer: false,
      availability: 'Available',
      status: 'Pending',
    })
  }

  const approval_history = [
    createEvent(input.owner, 'memo_created', 'Memo item created.'),
    createEvent('system', 'mode_inferred', `Scenario mode inferred as ${mode}.`),
  ]

  return {
    mode,
    workflow_steps,
    current_step_index: 0,
    status: 'Draft',
    approval_history,
  }
}

export function normalizeAction(action: ExecutiveAction): ExecutiveAction {
  if (action.mode && action.workflow_steps && action.approval_history) {
    return action
  }

  const contentForInference = [
    action.notes,
    action.memo_body,
    action.memo_background,
    action.memo_analysis,
    action.memo_recommendation,
  ]
    .filter(Boolean)
    .join(' ')

  const generated = buildWorkflow({
    title: action.title,
    notes: contentForInference,
    priority: action.priority,
    owner: action.owner,
    includeFinalAuthority: action.priority === 'High',
    approverCount: action.priority === 'Low' ? 1 : 2,
    externalImplication: Boolean(action.external_implication),
    institutionalImplication: Boolean(action.institutional_implication),
  })

  return {
    ...action,
    initiator: action.initiator ?? action.owner,
    memo_body: action.memo_body ?? action.notes,
    memo_background: action.memo_background ?? action.memo_body ?? action.notes,
    memo_analysis: action.memo_analysis ?? '',
    memo_recommendation: action.memo_recommendation ?? action.notes,
    external_implication: Boolean(action.external_implication),
    institutional_implication: Boolean(action.institutional_implication),
    mode: generated.mode,
    workflow_steps: generated.workflow_steps,
    current_step_index: generated.current_step_index,
    approval_history: generated.approval_history,
    status: action.status === 'Completed' ? 'Completed' : generated.status,
  }
}

export function nextPendingIndex(steps: WorkflowStep[]): number {
  const index = steps.findIndex((step) => step.status === 'Pending' && !step.is_observer)
  return index === -1 ? steps.length : index
}

export function getCurrentStep(action: ExecutiveAction): WorkflowStep | null {
  const steps = action.workflow_steps ?? []
  const pointer = action.current_step_index ?? 0
  return steps[pointer] ?? null
}

export function updateCurrentPointer(action: ExecutiveAction): ExecutiveAction {
  const steps = action.workflow_steps ?? []
  const current_step_index = nextPendingIndex(steps)
  return {
    ...action,
    current_step_index,
  }
}

export function deriveWorkflowStatus(action: ExecutiveAction): ActionStatus {
  const steps = action.workflow_steps ?? []
  if (action.status === 'Completed') {
    return 'Completed'
  }
  if (steps.some((step) => step.status === 'Rejected')) {
    return 'Rejected'
  }
  if (steps.some((step) => step.status === 'Sent Back')) {
    return 'Sent Back'
  }
  if (steps.length > 0 && steps.every((step) => step.status === 'Approved' || step.is_observer)) {
    return 'Approved'
  }
  if (steps.some((step) => step.status === 'Approved')) {
    return 'In Review'
  }
  return 'Draft'
}

export function applyStepDecision(
  action: ExecutiveAction,
  decision: WorkflowStepStatus,
  actor: string,
  comment: string,
): ExecutiveAction {
  const currentStep = getCurrentStep(action)
  if (!currentStep) {
    return action
  }

  const updatedSteps = (action.workflow_steps ?? []).map((step) =>
    step.id === currentStep.id
      ? {
          ...step,
          status: decision,
          acted_at: new Date().toISOString(),
          acted_by: actor,
        }
      : step,
  )

  const eventType =
    decision === 'Approved' ? 'approved' : decision === 'Rejected' ? 'rejected' : 'sent_back'

  const history = [
    ...(action.approval_history ?? []),
    createEvent(actor, eventType, `${currentStep.label}: ${decision}${comment ? ` - ${comment}` : ''}`),
  ]

  const withUpdated = updateCurrentPointer({
    ...action,
    workflow_steps: updatedSteps,
    approval_history: history,
  })

  return {
    ...withUpdated,
    status: deriveWorkflowStatus(withUpdated),
  }
}

export function handleUnavailableApprover(
  action: ExecutiveAction,
  resolution: 'skip' | 'delegate' | 'reassign' | 'replace_successor' | 'replace_role_owner' | 'remove' | 'escalate',
  actor: string,
): ExecutiveAction {
  const currentStep = getCurrentStep(action)
  if (!currentStep) {
    return action
  }

  const updatedSteps: WorkflowStep[] = (action.workflow_steps ?? []).map((step) => {
    if (step.id !== currentStep.id) {
      return step
    }

    switch (resolution) {
      case 'skip':
        return {
          ...step,
          status: 'Skipped' as WorkflowStepStatus,
          acted_at: new Date().toISOString(),
          acted_by: actor,
        }
      case 'delegate':
        return {
          ...step,
          resolved_approver: `${step.resolved_approver} Delegate`,
          availability: 'Available',
          delegation_note: 'Delegated during OOO',
        }
      case 'reassign':
        return {
          ...step,
          resolved_approver: `${step.resolved_approver} (Reassigned)`,
          availability: 'Available',
          substitution_note: 'Strict mode reassignment with reason captured',
        }
      case 'replace_successor':
        return {
          ...step,
          resolved_approver: `${step.resolved_approver} Successor`,
          availability: 'Available',
          substitution_note: 'Replaced with successor after departure',
        }
      case 'replace_role_owner':
        return {
          ...step,
          resolved_approver: resolveRole(step.approver_key),
          availability: 'Available',
          substitution_note: 'Replaced with current role owner',
        }
      case 'remove':
        return step.required
          ? step
          : {
              ...step,
              status: 'Skipped' as WorkflowStepStatus,
              acted_by: actor,
              acted_at: new Date().toISOString(),
            }
      case 'escalate':
        return step
    }
  })

  const detailMap: Record<typeof resolution, string> = {
    skip: 'OOO step skipped after timeout (Light mode).',
    delegate: 'OOO step delegated (Standard mode).',
    reassign: 'OOO step reassigned with reason (Strict mode).',
    replace_successor: 'Departed approver replaced by successor.',
    replace_role_owner: 'Departed approver replaced by role owner.',
    remove: 'Non-essential step removed after departure.',
    escalate: 'Issue escalated to workflow admin.',
  }

  const typeMap: Record<typeof resolution, WorkflowEvent['type']> = {
    skip: 'status_changed',
    delegate: 'delegated',
    reassign: 'substituted',
    replace_successor: 'substituted',
    replace_role_owner: 'substituted',
    remove: 'step_removed',
    escalate: 'escalated',
  }

  const withPointer = updateCurrentPointer({
    ...action,
    workflow_steps: updatedSteps,
    approval_history: [...(action.approval_history ?? []), createEvent(actor, typeMap[resolution], detailMap[resolution])],
  })

  return {
    ...withPointer,
    status: deriveWorkflowStatus(withPointer),
  }
}

export function canActOnCurrentStep(action: ExecutiveAction, actor: string, isAdmin: boolean): boolean {
  if (isAdmin) {
    return true
  }
  const currentStep = getCurrentStep(action)
  if (!currentStep) {
    return false
  }
  return currentStep.resolved_approver === actor
}

export function getAuditDepth(mode: WorkflowMode): string {
  switch (mode) {
    case 'Light':
      return 'Minimal'
    case 'Standard':
      return 'Full timeline'
    case 'Strict':
      return 'Immutable log'
  }
}
