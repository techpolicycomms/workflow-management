import { useEffect, useMemo, useRef, useState } from 'react'
import { createAction, getActions, getConnectionMode, updateAction } from './lib/actionsApi'
import {
  applyStepDecision,
  buildWorkflow,
  canActOnCurrentStep,
  getAuditDepth,
  getCurrentStep,
  handleUnavailableApprover,
  nextPendingIndex,
} from './lib/workflowEngine'
import type { ActionPriority, ActionStatus, ExecutiveAction, WorkflowStep, WorkflowStepStatus } from './types'
import './App.css'

const statuses: ActionStatus[] = ['Draft', 'In Review', 'Sent Back', 'Approved', 'Rejected', 'Completed']
const priorities: ActionPriority[] = ['High', 'Medium', 'Low']
const actors = [
  'Rahul Jha',
  'Fatima Protocol',
  'Lina Partnerships',
  'Maya Director',
  'Noah Counsel',
  'Ari Finance',
  'Secretary-General Office',
]

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

type SortBy = 'dueAsc' | 'dueDesc' | 'priority' | 'recent'
type UnavailableResolution =
  | 'skip'
  | 'delegate'
  | 'reassign'
  | 'replace_successor'
  | 'replace_role_owner'
  | 'remove'
  | 'escalate'

interface NewActionForm {
  title: string
  owner: string
  due_date: string
  priority: ActionPriority
  background: string
  analysis: string
  recommendation: string
  attachment_name: string
  approverCount: number
  includeFinalAuthority: boolean
  externalImplication: boolean
  institutionalImplication: boolean
}

const defaultForm: NewActionForm = {
  title: '',
  owner: 'Rahul Jha',
  due_date: '',
  priority: 'Medium',
  background: '',
  analysis: '',
  recommendation: '',
  attachment_name: '',
  approverCount: 2,
  includeFinalAuthority: false,
  externalImplication: false,
  institutionalImplication: false,
}

function Icon({ name }: { name: 'kpi' | 'user' | 'calendar' | 'risk' | 'mode' | 'audit' | 'step' | 'search' | 'export' }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }
  switch (name) {
    case 'kpi':
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <path d="m8 14 3-3 3 2 4-5" />
        </svg>
      )
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c2-4 5-6 8-6s6 2 8 6" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4m8-4v4" />
        </svg>
      )
    case 'risk':
      return (
        <svg {...common}>
          <path d="m12 3 9 16H3z" />
          <path d="M12 9v4m0 4h.01" />
        </svg>
      )
    case 'mode':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M7 12h10M12 7v10" />
        </svg>
      )
    case 'audit':
      return (
        <svg {...common}>
          <path d="M7 4h10v16H7z" />
          <path d="M10 8h4m-4 4h4m-4 4h4" />
        </svg>
      )
    case 'step':
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
          <path d="M7 12h3m4 0h3" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3-3" />
        </svg>
      )
    case 'export':
      return (
        <svg {...common}>
          <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
          <path d="M5 21h14" />
        </svg>
      )
  }
}

function composeMemoText(background: string, analysis: string, recommendation: string): string {
  const chunks = [`Background: ${background}`]
  if (analysis.trim()) {
    chunks.push(`Analysis: ${analysis}`)
  }
  chunks.push(`Recommendation: ${recommendation}`)
  return chunks.join('\n')
}

function priorityWeight(priority: ActionPriority): number {
  switch (priority) {
    case 'High':
      return 3
    case 'Medium':
      return 2
    case 'Low':
      return 1
  }
}

function formatDueDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

function getDaysUntilDue(dueDate: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(`${dueDate}T00:00:00`)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function isClosed(status: ActionStatus): boolean {
  return status === 'Completed' || status === 'Approved' || status === 'Rejected'
}

function App() {
  const searchRef = useRef<HTMLInputElement | null>(null)
  const titleRef = useRef<HTMLInputElement | null>(null)
  const [actions, setActions] = useState<ExecutiveAction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<ActionStatus | 'All'>('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('dueAsc')
  const [showOpenOnly, setShowOpenOnly] = useState(false)
  const [actingAs, setActingAs] = useState('Rahul Jha')
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [form, setForm] = useState<NewActionForm>(defaultForm)
  const [isSaving, setIsSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedTimelines, setExpandedTimelines] = useState<Record<string, boolean>>({})
  const [workflowComment, setWorkflowComment] = useState<Record<string, string>>({})
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [isMemoFormCollapsed, setIsMemoFormCollapsed] = useState(false)
  const [chainDrafts, setChainDrafts] = useState<Record<string, WorkflowStep[]>>({})
  const connectionMode = getConnectionMode()

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getActions()
        setActions(data)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load items')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  const filteredActions = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    const next = actions.filter((action) => {
      if (selectedStatus !== 'All' && action.status !== selectedStatus) {
        return false
      }
      if (showOpenOnly && isClosed(action.status)) {
        return false
      }
      if (!search) {
        return true
      }
      return (
        action.title.toLowerCase().includes(search) ||
        action.owner.toLowerCase().includes(search) ||
        action.notes.toLowerCase().includes(search) ||
        (action.memo_background ?? '').toLowerCase().includes(search) ||
        (action.memo_analysis ?? '').toLowerCase().includes(search) ||
        (action.memo_recommendation ?? '').toLowerCase().includes(search)
      )
    })
    next.sort((a, b) => {
      switch (sortBy) {
        case 'dueAsc':
          return a.due_date.localeCompare(b.due_date)
        case 'dueDesc':
          return b.due_date.localeCompare(a.due_date)
        case 'priority':
          return priorityWeight(b.priority) - priorityWeight(a.priority)
        case 'recent':
          return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      }
    })
    return next
  }, [actions, searchTerm, selectedStatus, showOpenOnly, sortBy])

  const metrics = useMemo(() => {
    const completed = actions.filter((action) => action.status === 'Completed').length
    const inReview = actions.filter((action) => action.status === 'In Review').length
    const open = actions.filter((action) => !isClosed(action.status)).length
    const dueSoon = actions.filter((action) => {
      const days = getDaysUntilDue(action.due_date)
      return days >= 0 && days <= 7
    }).length
    const completionRate = actions.length === 0 ? 0 : Math.round((completed / actions.length) * 100)
    return { total: actions.length, completed, inReview, open, dueSoon, completionRate }
  }, [actions])

  const workflowHealth = useMemo(() => {
    const blocked = actions.filter((action) => {
      const currentStep = getCurrentStep(action)
      return (
        !isClosed(action.status) &&
        Boolean(currentStep) &&
        (currentStep?.availability === 'Out of Office' || currentStep?.availability === 'Departed')
      )
    }).length
    const overdueApprovals = actions.filter((action) => !isClosed(action.status) && getDaysUntilDue(action.due_date) < 0).length
    const unresolvedSubstitutions = actions.filter((action) =>
      (action.workflow_steps ?? []).some((step) => Boolean(step.substitution_note) && step.status === 'Pending'),
    ).length
    return { blocked, overdueApprovals, unresolvedSubstitutions }
  }, [actions])

  const hasActiveFilters = selectedStatus !== 'All' || searchTerm.trim().length > 0 || showOpenOnly || sortBy !== 'dueAsc'
  const selectedAction = useMemo(
    () => (selectedCardId ? actions.find((action) => action.id === selectedCardId) ?? null : null),
    [actions, selectedCardId],
  )

  const saveAction = async (nextAction: ExecutiveAction, message: string) => {
    const previous = actions
    setError(null)
    setSuccessMessage(null)
    setUpdatingId(nextAction.id)
    setActions((current) => current.map((item) => (item.id === nextAction.id ? nextAction : item)))
    try {
      const persisted = await updateAction(nextAction)
      setActions((current) => current.map((item) => (item.id === persisted.id ? persisted : item)))
      setSuccessMessage(message)
    } catch (updateError) {
      setActions(previous)
      setError(updateError instanceof Error ? updateError.message : 'Failed to save workflow update')
    } finally {
      setUpdatingId(null)
    }
  }

  const onCreateAction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.title || !form.owner || !form.due_date || !form.background || !form.recommendation) {
      setError('Add title, initiator, date, background, and recommendation.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const memoText = composeMemoText(form.background, form.analysis, form.recommendation)
      const built = buildWorkflow({
        title: form.title,
        notes: memoText,
        priority: form.priority,
        owner: form.owner,
        includeFinalAuthority: form.includeFinalAuthority,
        approverCount: form.approverCount,
        externalImplication: form.externalImplication,
        institutionalImplication: form.institutionalImplication,
      })
      const created = await createAction({
        title: form.title,
        owner: form.owner,
        initiator: form.owner,
        due_date: form.due_date,
        priority: form.priority,
        status: built.status,
        notes: memoText,
        memo_body: memoText,
        memo_background: form.background,
        memo_analysis: form.analysis,
        memo_recommendation: form.recommendation,
        attachment_name: form.attachment_name,
        external_implication: form.externalImplication,
        institutional_implication: form.institutionalImplication,
        mode: built.mode,
        workflow_steps: built.workflow_steps,
        current_step_index: built.current_step_index,
        approval_history: built.approval_history,
      })
      setActions((current) => [created, ...current])
      setForm(defaultForm)
      setSuccessMessage(`Created in ${created.mode ?? 'Standard'} mode.`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create item')
    } finally {
      setIsSaving(false)
    }
  }

  const onDecision = async (action: ExecutiveAction, decision: WorkflowStepStatus) => {
    if (!canActOnCurrentStep(action, actingAs, isAdminMode)) {
      setError('You are not the active approver.')
      return
    }
    const comment = workflowComment[action.id] ?? ''
    const updated = applyStepDecision(action, decision, actingAs, comment)
    await saveAction(updated, `${decision} recorded.`)
    setWorkflowComment((current) => ({ ...current, [action.id]: '' }))
  }

  const onSubmitForReview = async (action: ExecutiveAction) => {
    if (!isAdminMode && action.owner !== actingAs) {
      setError('Only initiator or admin can submit.')
      return
    }
    const updated = {
      ...action,
      status: 'In Review' as ActionStatus,
      current_step_index: nextPendingIndex(action.workflow_steps ?? []),
      approval_history: [
        ...(action.approval_history ?? []),
        {
          id: `evt-${Date.now()}`,
          at: new Date().toISOString(),
          by: actingAs,
          type: 'submitted_for_review' as const,
          detail: 'Submitted to approval workflow.',
        },
      ],
    }
    await saveAction(updated, 'Submitted for review.')
  }

  const onManualStatusChange = async (action: ExecutiveAction, status: ActionStatus) => {
    if (!isAdminMode) {
      setError('Manual status changes require admin override.')
      return
    }
    await saveAction({ ...action, status }, `Status changed to ${status}.`)
  }

  const onResolveUnavailable = async (action: ExecutiveAction, resolution: UnavailableResolution) => {
    if (!isAdminMode && action.owner !== actingAs) {
      setError('Only initiator or admin can resolve this.')
      return
    }
    const updated = handleUnavailableApprover(action, resolution, actingAs)
    await saveAction(updated, 'Resolution applied and logged.')
  }

  const updateChainDraft = (
    actionId: string,
    sourceSteps: WorkflowStep[],
    updater: (steps: WorkflowStep[]) => WorkflowStep[],
  ) => {
    setChainDrafts((current) => {
      const base = current[actionId] ?? sourceSteps.map((step) => ({ ...step }))
      return { ...current, [actionId]: updater(base).map((step, index) => ({ ...step, order: index })) }
    })
  }

  const moveStep = (action: ExecutiveAction, index: number, direction: -1 | 1) => {
    updateChainDraft(action.id, action.workflow_steps ?? [], (steps) => {
      const target = index + direction
      if (target < 0 || target >= steps.length) {
        return steps
      }
      const copy = [...steps]
      const [item] = copy.splice(index, 1)
      copy.splice(target, 0, item)
      return copy
    })
  }

  const addStep = (action: ExecutiveAction) => {
    const stepId = `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    updateChainDraft(action.id, action.workflow_steps ?? [], (steps) => [
      ...steps,
      {
        id: stepId,
        order: steps.length,
        label: `Review ${steps.length + 1}`,
        approver_kind: 'role',
        approver_key: 'director-bureau-x',
        approver_display: 'director bureau x',
        resolved_approver: 'Maya Director',
        required: true,
        is_final: false,
        is_observer: false,
        availability: 'Available',
        status: 'Pending',
      },
    ])
  }

  const removeStep = (action: ExecutiveAction, index: number) => {
    updateChainDraft(action.id, action.workflow_steps ?? [], (steps) => {
      if (steps.length <= 1) {
        return steps
      }
      return steps.filter((_, stepIndex) => stepIndex !== index)
    })
  }

  const saveChainChanges = async (action: ExecutiveAction) => {
    const draft = chainDrafts[action.id]
    if (!draft) {
      return
    }
    const ordered = draft.map((step, index) => ({ ...step, order: index }))
    const updated: ExecutiveAction = {
      ...action,
      workflow_steps: ordered,
      current_step_index: nextPendingIndex(ordered),
      status:
        action.status === 'Completed'
          ? 'Completed'
          : ordered.some((step) => step.status === 'Pending')
            ? 'In Review'
            : action.status,
      approval_history: [
        ...(action.approval_history ?? []),
        {
          id: `evt-${Date.now()}`,
          at: new Date().toISOString(),
          by: actingAs,
          type: 'status_changed',
          detail: 'Approval chain sequence/roles/assignees modified.',
        },
      ],
    }
    await saveAction(updated, 'Approval chain updated.')
    setChainDrafts((current) => {
      const next = { ...current }
      delete next[action.id]
      return next
    })
  }

  const exportAuditSummary = () => {
    const lines: string[] = []
    lines.push(`# Executive Workflow Audit Summary`)
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push(`Total items: ${actions.length}`)
    lines.push(`Blocked items: ${workflowHealth.blocked}`)
    lines.push('')

    actions.forEach((action, index) => {
      const currentStep = getCurrentStep(action)
      lines.push(`## ${index + 1}. ${action.title}`)
      lines.push(`- Status: ${action.status}`)
      lines.push(`- Mode: ${action.mode ?? 'Standard'} (${getAuditDepth(action.mode ?? 'Standard')})`)
      lines.push(`- Initiator: ${action.initiator ?? action.owner}`)
      lines.push(`- Due: ${action.due_date}`)
      lines.push(`- Attachment: ${action.attachment_name ?? 'None'}`)
      lines.push(`- Current step: ${currentStep ? `${currentStep.label} / ${currentStep.resolved_approver}` : 'N/A'}`)
      lines.push(`- Latest events:`)
      ;(action.approval_history ?? []).slice(-3).forEach((event) => {
        lines.push(`  - ${event.at} | ${event.by} | ${event.detail}`)
      })
      lines.push('')
    })

    const file = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `executive-workflow-audit-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    setSuccessMessage('Audit summary exported.')
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement
      const typingInField =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
        return
      }

      if (event.altKey && !event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        titleRef.current?.focus()
      }

      if (typingInField) {
        return
      }

      if (!selectedCardId) {
        return
      }

      const targetAction = actions.find((item) => item.id === selectedCardId)
      if (!targetAction) {
        return
      }

      if (event.key.toLowerCase() === 't') {
        event.preventDefault()
        setExpandedTimelines((current) => ({ ...current, [selectedCardId]: !Boolean(current[selectedCardId]) }))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions, selectedCardId])

  return (
    <main className="app-shell">
      <a href="#memo-register" className="skip-link">
        Skip to memo register
      </a>
      <header className="top">
        <div className="title-block">
          <h1>Executive Workflow</h1>
          <p className="subtitle">SG memo and executive decision flow with adaptive governance.</p>
        </div>
        <div className="top-actions">
          <div className={`badge ${connectionMode}`}>{connectionMode === 'supabase' ? 'Live data' : 'Demo data'}</div>
          <button type="button" className="icon-btn" onClick={exportAuditSummary}>
            <Icon name="export" />
            Export audit
          </button>
        </div>
      </header>

      <section className="context-bar">
        <label className="field-inline">
          <Icon name="user" />
          <span>Acting as</span>
          <select value={actingAs} onChange={(event) => setActingAs(event.target.value)}>
            {actors.map((actor) => (
              <option key={actor} value={actor}>
                {actor}
              </option>
            ))}
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={isAdminMode} onChange={(event) => setIsAdminMode(event.target.checked)} />
          Admin override
        </label>
        <p className="shortcut-hint" aria-label="Keyboard shortcuts">
          Shortcuts: `Ctrl/Cmd+K` search, `Alt+N` new memo title, `T` timeline.
        </p>
      </section>

      <section className="metrics">
        <article><span className="metric-icon"><Icon name="kpi" /></span><h2>{metrics.total}</h2><p>Total</p></article>
        <article><span className="metric-icon"><Icon name="step" /></span><h2>{metrics.open}</h2><p>Open</p></article>
        <article><span className="metric-icon"><Icon name="audit" /></span><h2>{metrics.inReview}</h2><p>In review</p></article>
        <article><span className="metric-icon"><Icon name="calendar" /></span><h2>{metrics.dueSoon}</h2><p>Due in 7d</p></article>
        <article><span className="metric-icon"><Icon name="kpi" /></span><h2>{metrics.completed}</h2><p>Completed</p></article>
        <article><span className="metric-icon"><Icon name="kpi" /></span><h2>{metrics.completionRate}%</h2><p>Completion</p></article>
      </section>

      <section className="workspace">
        <aside className="side-column">
          <div className="panel">
            <h3>New Memo</h3>
            <button
              type="button"
              className="mobile-form-toggle ghost"
              onClick={() => setIsMemoFormCollapsed((current) => !current)}
              aria-expanded={!isMemoFormCollapsed}
              aria-controls="new-memo-form"
            >
              {isMemoFormCollapsed ? 'Open form' : 'Collapse form'}
            </button>
            <form
              id="new-memo-form"
              onSubmit={onCreateAction}
              className={`form-grid ${isMemoFormCollapsed ? 'form-collapsed' : ''}`}
              aria-label="Create memo form"
            >
              <label htmlFor="memo-title">Title</label>
              <input
                id="memo-title"
                ref={titleRef}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Decision title"
                aria-required="true"
              />

              <label htmlFor="memo-owner">Initiator</label>
              <select id="memo-owner" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })}>
                {actors.map((actor) => (
                  <option key={actor} value={actor}>{actor}</option>
                ))}
              </select>

              <label htmlFor="memo-date">Target Date</label>
              <input id="memo-date" type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} aria-required="true" />

              <label htmlFor="memo-priority">Risk</label>
              <select id="memo-priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as ActionPriority })}>
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>

              <label htmlFor="memo-approvers">Approvers</label>
              <input id="memo-approvers" type="number" min={1} max={4} value={form.approverCount} onChange={(event) => setForm({ ...form, approverCount: Number(event.target.value) })} />

              <label className="toggle"><input type="checkbox" checked={form.includeFinalAuthority} onChange={(event) => setForm({ ...form, includeFinalAuthority: event.target.checked })} />Final authority</label>
              <label className="toggle"><input type="checkbox" checked={form.externalImplication} onChange={(event) => setForm({ ...form, externalImplication: event.target.checked })} />External implication</label>
              <label className="toggle"><input type="checkbox" checked={form.institutionalImplication} onChange={(event) => setForm({ ...form, institutionalImplication: event.target.checked })} />Institutional implication</label>

              <label htmlFor="memo-background" className="full">Background</label>
              <textarea
                id="memo-background"
                className="full"
                value={form.background}
                onChange={(event) => setForm({ ...form, background: event.target.value })}
                placeholder="Context and rationale."
                rows={3}
                aria-required="true"
              />

              <label htmlFor="memo-analysis" className="full">Analysis (optional)</label>
              <textarea
                id="memo-analysis"
                className="full"
                value={form.analysis}
                onChange={(event) => setForm({ ...form, analysis: event.target.value })}
                placeholder="Assessment, trade-offs, and risks."
                rows={3}
              />

              <label htmlFor="memo-recommendation" className="full">Recommendation</label>
              <textarea
                id="memo-recommendation"
                className="full"
                value={form.recommendation}
                onChange={(event) => setForm({ ...form, recommendation: event.target.value })}
                placeholder="Decision requested."
                rows={3}
                aria-required="true"
              />

              <label htmlFor="memo-attachment">Attachment (optional)</label>
              <input
                id="memo-attachment"
                type="file"
                onChange={(event) => setForm({ ...form, attachment_name: event.target.files?.[0]?.name ?? '' })}
              />
              {form.attachment_name && <p className="file-chip">Attached: {form.attachment_name}</p>}

              <button type="submit" disabled={isSaving} aria-keyshortcuts="Alt+Shift+S">{isSaving ? 'Creating...' : 'Create memo'}</button>
            </form>
          </div>

          <div className="panel health-panel">
            <h3>Workflow Health</h3>
            <div className="health-grid">
              <div><span className="health-value">{workflowHealth.blocked}</span><p>Blocked</p></div>
              <div><span className="health-value">{workflowHealth.overdueApprovals}</span><p>Overdue approvals</p></div>
              <div><span className="health-value">{workflowHealth.unresolvedSubstitutions}</span><p>Pending substitutions</p></div>
            </div>
          </div>
        </aside>

        <div className="panel" id="memo-register">
          <div className="list-header">
            <h3>Memo Register</h3>
            <div className="filters">
              <div className="search-wrap">
                <Icon name="search" />
                <input
                  ref={searchRef}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search"
                  aria-label="Search memos"
                />
              </div>
              <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as ActionStatus | 'All')} aria-label="Filter by status">
                <option value="All">All</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
                <option value="dueAsc">Due soonest</option>
                <option value="dueDesc">Due latest</option>
                <option value="priority">Risk</option>
                <option value="recent">Recent</option>
              </select>
              <label className="toggle"><input type="checkbox" checked={showOpenOnly} onChange={(event) => setShowOpenOnly(event.target.checked)} />Open only</label>
              <button
                type="button"
                className="ghost"
                disabled={!hasActiveFilters}
                onClick={() => {
                  setSelectedStatus('All')
                  setSearchTerm('')
                  setSortBy('dueAsc')
                  setShowOpenOnly(false)
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="sr-status" role="status" aria-live="polite">
            {isLoading && <p className="muted">Loading items...</p>}
            {error && <p className="error">{error}</p>}
            {successMessage && <p className="success">{successMessage}</p>}
          </div>
          {!isLoading && filteredActions.length === 0 && <p className="muted">No matching items.</p>}

          <div className="action-list">
            {filteredActions.map((action) => {
              const currentStep = getCurrentStep(action)
              const daysToDue = getDaysUntilDue(action.due_date)
              const mode = action.mode ?? 'Standard'
              const canAct = canActOnCurrentStep(action, actingAs, isAdminMode)
              const isExpanded = Boolean(expandedTimelines[action.id])
              const hasUnavailableCurrent =
                currentStep?.availability === 'Out of Office' || currentStep?.availability === 'Departed'

              return (
                <article
                  key={action.id}
                  className={`action-card ${selectedCardId === action.id ? 'card-selected' : ''}`}
                  tabIndex={0}
                  onFocus={() => setSelectedCardId(action.id)}
                  onKeyDown={async (event) => {
                    const key = event.key.toLowerCase()
                    if (key === 'a' && canAct && !hasUnavailableCurrent) {
                      event.preventDefault()
                      await onDecision(action, 'Approved')
                    } else if (key === 'b' && canAct && !hasUnavailableCurrent) {
                      event.preventDefault()
                      await onDecision(action, 'Sent Back')
                    } else if (key === 'r' && canAct && !hasUnavailableCurrent) {
                      event.preventDefault()
                      await onDecision(action, 'Rejected')
                    } else if (key === 't') {
                      event.preventDefault()
                      setExpandedTimelines((current) => ({ ...current, [action.id]: !Boolean(current[action.id]) }))
                    }
                  }}
                  aria-label={`Memo item ${action.title}`}
                >
                  <div className="card-top">
                    <h4>{action.title}</h4>
                    <div className="badge-row">
                      <span className={`pill status-${action.status.toLowerCase().replaceAll(' ', '-')}`}>{action.status}</span>
                      <span className={`pill mode-${mode.toLowerCase()}`}>{mode}</span>
                    </div>
                  </div>

                  <div className="memo-sections">
                    <p className="card-body"><strong>Background:</strong> {action.memo_background || 'Not provided.'}</p>
                    {action.memo_analysis && <p className="card-body"><strong>Analysis:</strong> {action.memo_analysis}</p>}
                    <p className="card-body"><strong>Recommendation:</strong> {action.memo_recommendation || action.notes}</p>
                  </div>

                  <div className="meta-grid">
                    <span><Icon name="user" /> {action.initiator ?? action.owner}</span>
                    <span><Icon name="calendar" /> {formatDueDate(action.due_date)}</span>
                    <span><Icon name="risk" /> <span className={`pill priority-${action.priority.toLowerCase()}`}>{action.priority}</span></span>
                    <span><Icon name="audit" /> {getAuditDepth(mode)}</span>
                    <span><Icon name="step" /> {currentStep ? `${currentStep.label}: ${currentStep.resolved_approver}` : 'No pending step'}</span>
                    <span>
                      <Icon name="calendar" />{' '}
                      <span className={`pill ${daysToDue < 0 ? 'urgency-overdue' : daysToDue <= 3 ? 'urgency-soon' : 'urgency-normal'}`}>
                        {daysToDue < 0 ? `${Math.abs(daysToDue)} overdue` : daysToDue === 0 ? 'Due today' : `${daysToDue} days`}
                      </span>
                    </span>
                    {action.attachment_name && <span className="attachment-pill" title={action.attachment_name}>Attachment: {action.attachment_name}</span>}
                  </div>

                  <div className="workflow-row">
                    <input
                      value={workflowComment[action.id] ?? ''}
                      onChange={(event) => setWorkflowComment((current) => ({ ...current, [action.id]: event.target.value }))}
                      placeholder="Comment (optional)"
                    />
                    <button type="button" className="compact" disabled={updatingId === action.id || action.status !== 'Draft'} onClick={() => onSubmitForReview(action)}>Submit</button>
                    <button type="button" className="compact" disabled={updatingId === action.id || !canAct || hasUnavailableCurrent} onClick={() => onDecision(action, 'Approved')}>Approve</button>
                    <button type="button" className="compact warn" disabled={updatingId === action.id || !canAct || hasUnavailableCurrent} onClick={() => onDecision(action, 'Sent Back')}>Send back</button>
                    <button type="button" className="compact danger" disabled={updatingId === action.id || !canAct || hasUnavailableCurrent} onClick={() => onDecision(action, 'Rejected')}>Reject</button>
                    {!isClosed(action.status) && (
                      <button type="button" className="compact" disabled={updatingId === action.id} onClick={() => onManualStatusChange(action, 'Completed')}>Done</button>
                    )}
                    <button
                      type="button"
                      className="ghost compact"
                      onClick={() => setExpandedTimelines((current) => ({ ...current, [action.id]: !Boolean(current[action.id]) }))}
                    >
                      {isExpanded ? 'Hide' : 'Timeline'}
                    </button>
                  </div>

                  {hasUnavailableCurrent && currentStep && (
                    <div className="availability-alert">
                      <strong>Blocked:</strong> {currentStep.resolved_approver} is {currentStep.availability}.
                      {currentStep.availability === 'Out of Office' && mode === 'Light' && (
                        <button type="button" className="compact" onClick={() => onResolveUnavailable(action, 'skip')}>Skip</button>
                      )}
                      {currentStep.availability === 'Out of Office' && mode === 'Standard' && (
                        <button type="button" className="compact" onClick={() => onResolveUnavailable(action, 'delegate')}>Delegate</button>
                      )}
                      {currentStep.availability === 'Out of Office' && mode === 'Strict' && (
                        <button type="button" className="compact" onClick={() => onResolveUnavailable(action, 'reassign')}>Reassign</button>
                      )}
                      {currentStep.availability === 'Departed' && (
                        <>
                          <button type="button" className="compact" onClick={() => onResolveUnavailable(action, 'replace_successor')}>Successor</button>
                          <button type="button" className="compact" onClick={() => onResolveUnavailable(action, 'replace_role_owner')}>Role owner</button>
                          <button type="button" className="compact" onClick={() => onResolveUnavailable(action, 'remove')}>Remove</button>
                          <button type="button" className="compact danger" onClick={() => onResolveUnavailable(action, 'escalate')}>Escalate</button>
                        </>
                      )}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="timeline">
                      <h5>Approval Steps</h5>
                      {(chainDrafts[action.id] ?? action.workflow_steps ?? []).map((step, stepIndex) => (
                        <div key={step.id} className="timeline-step">
                          <span className={`pill step-${step.status.toLowerCase().replaceAll(' ', '-')}`}>{step.status}</span>
                          <span>{step.label} - {step.resolved_approver} {step.approver_kind === 'role' ? '(role)' : '(person)'}</span>
                          {step.delegation_note && <span className="muted">Delegated</span>}
                          {step.substitution_note && <span className="muted">Substituted</span>}
                          {(isAdminMode || action.owner === actingAs) && (
                            <div className="chain-editor">
                                  <button type="button" className="compact" onClick={() => moveStep(action, stepIndex, -1)}>Up</button>
                                  <button type="button" className="compact" onClick={() => moveStep(action, stepIndex, 1)}>Down</button>
                              <select
                                value={step.approver_kind}
                                onChange={(event) => {
                                      updateChainDraft(action.id, action.workflow_steps ?? [], (steps) =>
                                    steps.map((entry, index) =>
                                      index === stepIndex
                                        ? { ...entry, approver_kind: event.target.value as WorkflowStep['approver_kind'] }
                                        : entry,
                                    ),
                                  )
                                }}
                                aria-label="Approver type"
                              >
                                <option value="role">Role</option>
                                <option value="person">Person</option>
                              </select>
                              <input
                                value={step.approver_kind === 'role' ? step.approver_key : step.resolved_approver}
                                onChange={(event) => {
                                      updateChainDraft(action.id, action.workflow_steps ?? [], (steps) =>
                                    steps.map((entry, index) =>
                                      index === stepIndex
                                        ? step.approver_kind === 'role'
                                          ? {
                                              ...entry,
                                              approver_key: event.target.value,
                                              approver_display: event.target.value,
                                              resolved_approver: event.target.value,
                                            }
                                          : {
                                              ...entry,
                                              approver_key: event.target.value,
                                              approver_display: event.target.value,
                                              resolved_approver: event.target.value,
                                            }
                                        : entry,
                                    ),
                                  )
                                }}
                                placeholder={step.approver_kind === 'role' ? 'Role key' : 'Person name'}
                                aria-label="Approver assignment"
                              />
                              <button type="button" className="compact danger" onClick={() => removeStep(action, stepIndex)}>Remove</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {(isAdminMode || action.owner === actingAs) && (
                        <div className="chain-controls">
                          <button type="button" className="compact" onClick={() => addStep(action)}>
                            Add step
                          </button>
                          <button type="button" className="compact" onClick={() => saveChainChanges(action)}>
                            Save chain
                          </button>
                        </div>
                      )}
                      <h5>Recent Events</h5>
                      {(action.approval_history ?? [])
                        .slice()
                        .reverse()
                        .slice(0, mode === 'Light' ? 3 : 10)
                        .map((event) => (
                          <div key={event.id} className="timeline-event">
                            <span className="muted">{new Date(event.at).toLocaleString()}</span>
                            <span>{event.by}: {event.detail}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {selectedAction && (
        <section className="mobile-quick-bar" aria-label="Quick workflow actions">
          <button type="button" className="compact" onClick={() => onSubmitForReview(selectedAction)} disabled={selectedAction.status !== 'Draft'}>
            Submit
          </button>
          <button
            type="button"
            className="compact"
            onClick={() => onDecision(selectedAction, 'Approved')}
            disabled={!canActOnCurrentStep(selectedAction, actingAs, isAdminMode)}
          >
            Approve
          </button>
          <button
            type="button"
            className="compact warn"
            onClick={() => onDecision(selectedAction, 'Sent Back')}
            disabled={!canActOnCurrentStep(selectedAction, actingAs, isAdminMode)}
          >
            Send back
          </button>
          <button
            type="button"
            className="compact danger"
            onClick={() => onDecision(selectedAction, 'Rejected')}
            disabled={!canActOnCurrentStep(selectedAction, actingAs, isAdminMode)}
          >
            Reject
          </button>
          <button
            type="button"
            className="ghost compact"
            onClick={() => setExpandedTimelines((current) => ({ ...current, [selectedAction.id]: !Boolean(current[selectedAction.id]) }))}
          >
            Timeline
          </button>
        </section>
      )}
    </main>
  )
}

export default App
