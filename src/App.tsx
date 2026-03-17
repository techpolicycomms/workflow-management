import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { createAction, getActions, getConnectionMode, updateAction } from './lib/actionsApi'
import { createSnapshotWithAI, draftMemoWithAI } from './lib/aiApi'
import { localeDictionaries, type LocaleDictionary } from './i18n'
import { validateLocaleDictionary } from './i18n/validate'
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
type LangCode = 'ar' | 'zh' | 'en' | 'fr' | 'ru' | 'es'
const officialLanguages = [
  { code: 'ar' as LangCode, label: 'عربي', dir: 'rtl' as const },
  { code: 'zh' as LangCode, label: '中文', dir: 'ltr' as const },
  { code: 'en' as LangCode, label: 'English', dir: 'ltr' as const },
  { code: 'fr' as LangCode, label: 'Français', dir: 'ltr' as const },
  { code: 'ru' as LangCode, label: 'Русский', dir: 'ltr' as const },
  { code: 'es' as LangCode, label: 'Español', dir: 'ltr' as const },
]
const actors = [
  'Rahul Jha',
  'Fatima Protocol',
  'Lina Partnerships',
  'Maya Director',
  'Noah Counsel',
  'Ari Finance',
  'Secretary-General Office',
]

const uiText: Record<
  LangCode,
  Record<
    | 'title'
    | 'subtitle'
    | 'exportAudit'
    | 'actingAs'
    | 'adminOverride'
    | 'shortcuts'
    | 'newMemo'
    | 'memoRegister'
    | 'createMemo'
    | 'collapseForm'
    | 'openForm'
    | 'aiDraft'
    | 'aiDrafting'
    | 'search'
    | 'reset'
    | 'openOnly'
    | 'statusAll'
    | 'submit'
    | 'approve'
    | 'sendBack'
    | 'reject'
    | 'done'
    | 'timeline'
    | 'aiSnapshot'
    | 'background'
    | 'analysisOptional'
    | 'recommendation'
    | 'attachmentOptional'
    | 'total'
    | 'open'
    | 'inReview'
    | 'due7'
    | 'completed'
    | 'completion'
    | 'blocked'
    | 'overdueApprovals'
    | 'pendingSubs',
    string
  >
> = {
  en: {
    title: 'Executive Workflow',
    subtitle: 'SG memo and executive decision flow with adaptive governance.',
    exportAudit: 'Export audit',
    actingAs: 'Acting as',
    adminOverride: 'Admin override',
    shortcuts: 'Shortcuts: Ctrl/Cmd+K search, Alt+N new memo title, T timeline.',
    newMemo: 'New Memo',
    memoRegister: 'Memo Register',
    createMemo: 'Create memo',
    collapseForm: 'Collapse form',
    openForm: 'Open form',
    aiDraft: 'AI draft sections',
    aiDrafting: 'AI drafting...',
    search: 'Search',
    reset: 'Reset',
    openOnly: 'Open only',
    statusAll: 'All',
    submit: 'Submit',
    approve: 'Approve',
    sendBack: 'Send back',
    reject: 'Reject',
    done: 'Done',
    timeline: 'Timeline',
    aiSnapshot: 'AI snapshot',
    background: 'Background',
    analysisOptional: 'Analysis (optional)',
    recommendation: 'Recommendation',
    attachmentOptional: 'Attachment (optional)',
    total: 'Total',
    open: 'Open',
    inReview: 'In review',
    due7: 'Due in 7d',
    completed: 'Completed',
    completion: 'Completion',
    blocked: 'Blocked',
    overdueApprovals: 'Overdue approvals',
    pendingSubs: 'Pending substitutions',
  },
  ar: {
    title: 'سير العمل التنفيذي',
    subtitle: 'مذكرات الأمين العام وسير قرارات التنفيذ مع حوكمة تكيفية.',
    exportAudit: 'تصدير التدقيق',
    actingAs: 'الدور الحالي',
    adminOverride: 'تجاوز المسؤول',
    shortcuts: 'الاختصارات: Ctrl/Cmd+K للبحث، Alt+N لعنوان مذكرة جديدة، T للمخطط الزمني.',
    newMemo: 'مذكرة جديدة',
    memoRegister: 'سجل المذكرات',
    createMemo: 'إنشاء مذكرة',
    collapseForm: 'طي النموذج',
    openForm: 'فتح النموذج',
    aiDraft: 'صياغة بالذكاء الاصطناعي',
    aiDrafting: 'جارٍ الصياغة...',
    search: 'بحث',
    reset: 'إعادة تعيين',
    openOnly: 'المفتوحة فقط',
    statusAll: 'الكل',
    submit: 'إرسال',
    approve: 'موافقة',
    sendBack: 'إعادة',
    reject: 'رفض',
    done: 'تم',
    timeline: 'الخط الزمني',
    aiSnapshot: 'ملخص ذكاء اصطناعي',
    background: 'الخلفية',
    analysisOptional: 'التحليل (اختياري)',
    recommendation: 'التوصية',
    attachmentOptional: 'مرفق (اختياري)',
    total: 'الإجمالي',
    open: 'مفتوح',
    inReview: 'قيد المراجعة',
    due7: 'مستحق خلال 7 أيام',
    completed: 'مكتمل',
    completion: 'نسبة الإنجاز',
    blocked: 'معلّق',
    overdueApprovals: 'موافقات متأخرة',
    pendingSubs: 'استبدالات معلقة',
  },
  zh: {
    title: '执行工作流',
    subtitle: '秘书长备忘录与执行决策流程，支持自适应治理。',
    exportAudit: '导出审计',
    actingAs: '当前身份',
    adminOverride: '管理员覆盖',
    shortcuts: '快捷键：Ctrl/Cmd+K 搜索，Alt+N 新备忘录标题，T 时间线。',
    newMemo: '新备忘录',
    memoRegister: '备忘录列表',
    createMemo: '创建备忘录',
    collapseForm: '收起表单',
    openForm: '打开表单',
    aiDraft: 'AI 起草',
    aiDrafting: 'AI 起草中...',
    search: '搜索',
    reset: '重置',
    openOnly: '仅显示未关闭',
    statusAll: '全部',
    submit: '提交',
    approve: '批准',
    sendBack: '退回',
    reject: '拒绝',
    done: '完成',
    timeline: '时间线',
    aiSnapshot: 'AI 摘要',
    background: '背景',
    analysisOptional: '分析（可选）',
    recommendation: '建议',
    attachmentOptional: '附件（可选）',
    total: '总计',
    open: '进行中',
    inReview: '审核中',
    due7: '7天内到期',
    completed: '已完成',
    completion: '完成率',
    blocked: '受阻',
    overdueApprovals: '逾期审批',
    pendingSubs: '待处理替代',
  },
  fr: {
    title: 'Flux Exécutif',
    subtitle: 'Flux de mémos SG et de décisions exécutives avec gouvernance adaptative.',
    exportAudit: 'Exporter l’audit',
    actingAs: 'Rôle actif',
    adminOverride: 'Override admin',
    shortcuts: 'Raccourcis : Ctrl/Cmd+K recherche, Alt+N nouveau titre, T chronologie.',
    newMemo: 'Nouveau mémo',
    memoRegister: 'Registre des mémos',
    createMemo: 'Créer le mémo',
    collapseForm: 'Réduire le formulaire',
    openForm: 'Ouvrir le formulaire',
    aiDraft: 'Brouillon IA',
    aiDrafting: 'Rédaction IA...',
    search: 'Recherche',
    reset: 'Réinitialiser',
    openOnly: 'Ouverts seulement',
    statusAll: 'Tous',
    submit: 'Soumettre',
    approve: 'Approuver',
    sendBack: 'Renvoyer',
    reject: 'Rejeter',
    done: 'Terminé',
    timeline: 'Chronologie',
    aiSnapshot: 'Synthèse IA',
    background: 'Contexte',
    analysisOptional: 'Analyse (optionnelle)',
    recommendation: 'Recommandation',
    attachmentOptional: 'Pièce jointe (optionnelle)',
    total: 'Total',
    open: 'Ouvert',
    inReview: 'En revue',
    due7: 'Échéance 7j',
    completed: 'Terminé',
    completion: 'Taux',
    blocked: 'Bloqué',
    overdueApprovals: 'Approbations en retard',
    pendingSubs: 'Substitutions en attente',
  },
  ru: {
    title: 'Исполнительный поток',
    subtitle: 'Поток служебных записок SG и решений с адаптивным управлением.',
    exportAudit: 'Экспорт аудита',
    actingAs: 'Текущая роль',
    adminOverride: 'Админ-override',
    shortcuts: 'Горячие клавиши: Ctrl/Cmd+K поиск, Alt+N заголовок, T таймлайн.',
    newMemo: 'Новая записка',
    memoRegister: 'Реестр записок',
    createMemo: 'Создать записку',
    collapseForm: 'Свернуть форму',
    openForm: 'Открыть форму',
    aiDraft: 'Черновик ИИ',
    aiDrafting: 'ИИ пишет...',
    search: 'Поиск',
    reset: 'Сброс',
    openOnly: 'Только открытые',
    statusAll: 'Все',
    submit: 'Отправить',
    approve: 'Одобрить',
    sendBack: 'Вернуть',
    reject: 'Отклонить',
    done: 'Готово',
    timeline: 'Таймлайн',
    aiSnapshot: 'Сводка ИИ',
    background: 'Фон',
    analysisOptional: 'Анализ (опц.)',
    recommendation: 'Рекомендация',
    attachmentOptional: 'Вложение (опц.)',
    total: 'Всего',
    open: 'Открыто',
    inReview: 'На рассмотрении',
    due7: 'Срок 7д',
    completed: 'Завершено',
    completion: 'Процент',
    blocked: 'Блокировано',
    overdueApprovals: 'Просроченные согласования',
    pendingSubs: 'Ожидающие замены',
  },
  es: {
    title: 'Flujo Ejecutivo',
    subtitle: 'Flujo de memorandos SG y decisiones ejecutivas con gobernanza adaptativa.',
    exportAudit: 'Exportar auditoría',
    actingAs: 'Actuando como',
    adminOverride: 'Override admin',
    shortcuts: 'Atajos: Ctrl/Cmd+K buscar, Alt+N nuevo título, T línea de tiempo.',
    newMemo: 'Nuevo memo',
    memoRegister: 'Registro de memos',
    createMemo: 'Crear memo',
    collapseForm: 'Colapsar formulario',
    openForm: 'Abrir formulario',
    aiDraft: 'Borrador IA',
    aiDrafting: 'IA redactando...',
    search: 'Buscar',
    reset: 'Restablecer',
    openOnly: 'Solo abiertos',
    statusAll: 'Todos',
    submit: 'Enviar',
    approve: 'Aprobar',
    sendBack: 'Devolver',
    reject: 'Rechazar',
    done: 'Hecho',
    timeline: 'Línea de tiempo',
    aiSnapshot: 'Resumen IA',
    background: 'Antecedentes',
    analysisOptional: 'Análisis (opcional)',
    recommendation: 'Recomendación',
    attachmentOptional: 'Adjunto (opcional)',
    total: 'Total',
    open: 'Abierto',
    inReview: 'En revisión',
    due7: 'Vence en 7d',
    completed: 'Completado',
    completion: 'Cumplimiento',
    blocked: 'Bloqueado',
    overdueApprovals: 'Aprobaciones vencidas',
    pendingSubs: 'Sustituciones pendientes',
  },
}

const statusLabels: Record<LangCode, Record<ActionStatus, string>> = {
  en: {
    Draft: 'Draft',
    'In Review': 'In Review',
    'Sent Back': 'Sent Back',
    Approved: 'Approved',
    Rejected: 'Rejected',
    Completed: 'Completed',
    'Not Started': 'Not Started',
    'In Progress': 'In Progress',
    'At Risk': 'At Risk',
  },
  ar: {
    Draft: 'مسودة',
    'In Review': 'قيد المراجعة',
    'Sent Back': 'معاد',
    Approved: 'موافق عليه',
    Rejected: 'مرفوض',
    Completed: 'مكتمل',
    'Not Started': 'لم يبدأ',
    'In Progress': 'قيد التنفيذ',
    'At Risk': 'معرّض للخطر',
  },
  zh: {
    Draft: '草稿',
    'In Review': '审核中',
    'Sent Back': '已退回',
    Approved: '已批准',
    Rejected: '已拒绝',
    Completed: '已完成',
    'Not Started': '未开始',
    'In Progress': '进行中',
    'At Risk': '有风险',
  },
  fr: {
    Draft: 'Brouillon',
    'In Review': 'En revue',
    'Sent Back': 'Renvoyé',
    Approved: 'Approuvé',
    Rejected: 'Rejeté',
    Completed: 'Terminé',
    'Not Started': 'Non démarré',
    'In Progress': 'En cours',
    'At Risk': 'À risque',
  },
  ru: {
    Draft: 'Черновик',
    'In Review': 'На рассмотрении',
    'Sent Back': 'Возвращено',
    Approved: 'Одобрено',
    Rejected: 'Отклонено',
    Completed: 'Завершено',
    'Not Started': 'Не начато',
    'In Progress': 'В работе',
    'At Risk': 'Риск',
  },
  es: {
    Draft: 'Borrador',
    'In Review': 'En revisión',
    'Sent Back': 'Devuelto',
    Approved: 'Aprobado',
    Rejected: 'Rechazado',
    Completed: 'Completado',
    'Not Started': 'No iniciado',
    'In Progress': 'En progreso',
    'At Risk': 'En riesgo',
  },
}

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
  const [isAIDrafting, setIsAIDrafting] = useState(false)
  const [aiSnapshotLoadingById, setAiSnapshotLoadingById] = useState<Record<string, boolean>>({})
  const [activeLanguage, setActiveLanguage] = useState(officialLanguages[2].code)
  const [localeOverrides, setLocaleOverrides] =
    useState<Record<LangCode, LocaleDictionary>>(localeDictionaries as Record<LangCode, LocaleDictionary>)
  const translationImportRef = useRef<HTMLInputElement | null>(null)
  const connectionMode = getConnectionMode()
  const activeLocale = localeOverrides[activeLanguage as LangCode]
  const t = activeLocale?.ui ?? uiText[activeLanguage as LangCode]
  const localizedStatusLabels =
    activeLocale?.statusLabels ?? statusLabels[activeLanguage as LangCode]

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

  const onAIDraftMemo = async () => {
    if (!form.title) {
      setError('Enter a memo title before using AI draft.')
      return
    }

    setIsAIDrafting(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const drafted = await draftMemoWithAI({
        title: form.title,
        background: form.background,
        analysis: form.analysis,
        recommendation: form.recommendation,
        priority: form.priority,
      })

      setForm((current) => ({
        ...current,
        background: drafted.background || current.background,
        analysis: drafted.analysis || current.analysis,
        recommendation: drafted.recommendation || current.recommendation,
        priority: drafted.suggested_priority || current.priority,
        approverCount: Math.max(1, Math.min(4, drafted.suggested_approver_count || current.approverCount)),
        includeFinalAuthority:
          typeof drafted.include_final_authority === 'boolean'
            ? drafted.include_final_authority
            : current.includeFinalAuthority,
        externalImplication:
          typeof drafted.external_implication === 'boolean'
            ? drafted.external_implication
            : current.externalImplication,
        institutionalImplication:
          typeof drafted.institutional_implication === 'boolean'
            ? drafted.institutional_implication
            : current.institutionalImplication,
        attachment_name: drafted.attachment_hint || current.attachment_name,
      }))
      setSuccessMessage('AI draft generated locally via your machine.')
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : 'Failed to generate AI draft.')
    } finally {
      setIsAIDrafting(false)
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

  const onAISnapshot = async (action: ExecutiveAction) => {
    setAiSnapshotLoadingById((current) => ({ ...current, [action.id]: true }))
    setError(null)
    try {
      const snapshot = await createSnapshotWithAI({
        title: action.title,
        background: action.memo_background ?? '',
        analysis: action.memo_analysis ?? '',
        recommendation: action.memo_recommendation ?? action.notes,
        status: action.status,
        mode: action.mode ?? 'Standard',
      })
      const combined = [snapshot.snapshot, `Decision: ${snapshot.decision_prompt}`, ...snapshot.top_risks]
        .filter(Boolean)
        .join(' | ')
      setWorkflowComment((current) => ({ ...current, [action.id]: combined }))
      setSuccessMessage('AI approver snapshot generated.')
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : 'Failed to create AI snapshot.')
    } finally {
      setAiSnapshotLoadingById((current) => ({ ...current, [action.id]: false }))
    }
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

  const exportTranslations = () => {
    const language = activeLanguage as LangCode
    const payload = {
      language,
      dictionary: localeOverrides[language],
    }
    const file = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `translations-${language}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    setSuccessMessage(`Exported ${language} translation dictionary.`)
  }

  const importTranslations = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw) as {
        language: LangCode
        dictionary: LocaleDictionary
      }
      if (!parsed.language || !parsed.dictionary?.ui || !parsed.dictionary?.statusLabels) {
        throw new Error('Invalid translation file structure.')
      }
      const validation = validateLocaleDictionary(parsed.dictionary)
      if (!validation.isValid) {
        const parts = [
          validation.missingUIKeys.length
            ? `Missing UI: ${validation.missingUIKeys.join(', ')}`
            : '',
          validation.extraUIKeys.length ? `Extra UI: ${validation.extraUIKeys.join(', ')}` : '',
          validation.missingStatusKeys.length
            ? `Missing status labels: ${validation.missingStatusKeys.join(', ')}`
            : '',
          validation.extraStatusKeys.length
            ? `Extra status labels: ${validation.extraStatusKeys.join(', ')}`
            : '',
        ].filter(Boolean)
        throw new Error(`Translation schema mismatch. ${parts.join(' | ')}`)
      }
      setLocaleOverrides((current) => ({
        ...current,
        [parsed.language]: parsed.dictionary,
      }))
      setSuccessMessage(`Imported dictionary for ${parsed.language}.`)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Failed to import translation.')
    } finally {
      event.target.value = ''
    }
  }

  const exportI18nValidationReport = () => {
    const lines: string[] = []
    lines.push('I18N VALIDATION REPORT')
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push('')
    ;(Object.keys(localeOverrides) as LangCode[]).forEach((language) => {
      const validation = validateLocaleDictionary(localeOverrides[language])
      lines.push(`Language: ${language}`)
      lines.push(`Valid: ${validation.isValid ? 'YES' : 'NO'}`)
      if (validation.missingUIKeys.length) {
        lines.push(`  Missing UI keys: ${validation.missingUIKeys.join(', ')}`)
      }
      if (validation.extraUIKeys.length) {
        lines.push(`  Extra UI keys: ${validation.extraUIKeys.join(', ')}`)
      }
      if (validation.missingStatusKeys.length) {
        lines.push(`  Missing status keys: ${validation.missingStatusKeys.join(', ')}`)
      }
      if (validation.extraStatusKeys.length) {
        lines.push(`  Extra status keys: ${validation.extraStatusKeys.join(', ')}`)
      }
      lines.push('')
    })

    const file = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `i18n-validation-report-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    setSuccessMessage('Exported i18n validation report.')
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

  useEffect(() => {
    const selected = officialLanguages.find((lang) => lang.code === activeLanguage) ?? officialLanguages[2]
    document.documentElement.lang = selected.code
    document.documentElement.dir = selected.dir
  }, [activeLanguage])

  return (
    <main className="app-shell">
      <a href="#memo-register" className="skip-link">
        Skip to memo register
      </a>
      <header className="top">
        <div className="title-block">
          <h1>{t.title}</h1>
          <p className="subtitle">{t.subtitle}</p>
          <p className="itu-brand-text">International Telecommunication Union (ITU)</p>
        </div>
        <div className="top-actions">
          <div className={`badge ${connectionMode}`}>{connectionMode === 'supabase' ? 'Live data' : 'Demo data'}</div>
          <button type="button" className="icon-btn" onClick={exportAuditSummary}>
            <Icon name="export" />
            {t.exportAudit}
          </button>
        </div>
      </header>

      <nav className="language-bar" aria-label="Official UN languages">
        {officialLanguages.map((language) => (
          <button
            key={language.code}
            type="button"
            className={`lang-chip ${activeLanguage === language.code ? 'active' : ''}`}
            onClick={() => setActiveLanguage(language.code)}
            aria-pressed={activeLanguage === language.code}
          >
            {language.label}
          </button>
        ))}
        <button type="button" className="lang-chip" onClick={exportTranslations}>
          Export i18n
        </button>
        <button type="button" className="lang-chip" onClick={() => translationImportRef.current?.click()}>
          Import i18n
        </button>
        <button type="button" className="lang-chip" onClick={exportI18nValidationReport}>
          i18n report
        </button>
        <input
          ref={translationImportRef}
          type="file"
          accept="application/json"
          onChange={importTranslations}
          className="translation-import"
          aria-label="Import translation file"
        />
      </nav>

      <section className="context-bar">
        <label className="field-inline">
          <Icon name="user" />
          <span>{t.actingAs}</span>
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
          {t.adminOverride}
        </label>
        <p className="shortcut-hint" aria-label="Keyboard shortcuts">
          {t.shortcuts}
        </p>
      </section>

      <section className="metrics">
        <article><span className="metric-icon"><Icon name="kpi" /></span><h2>{metrics.total}</h2><p>{t.total}</p></article>
        <article><span className="metric-icon"><Icon name="step" /></span><h2>{metrics.open}</h2><p>{t.open}</p></article>
        <article><span className="metric-icon"><Icon name="audit" /></span><h2>{metrics.inReview}</h2><p>{t.inReview}</p></article>
        <article><span className="metric-icon"><Icon name="calendar" /></span><h2>{metrics.dueSoon}</h2><p>{t.due7}</p></article>
        <article><span className="metric-icon"><Icon name="kpi" /></span><h2>{metrics.completed}</h2><p>{t.completed}</p></article>
        <article><span className="metric-icon"><Icon name="kpi" /></span><h2>{metrics.completionRate}%</h2><p>{t.completion}</p></article>
      </section>

      <section className="workspace">
        <aside className="side-column">
          <div className="panel">
            <h3>{t.newMemo}</h3>
            <button
              type="button"
              className="mobile-form-toggle ghost"
              onClick={() => setIsMemoFormCollapsed((current) => !current)}
              aria-expanded={!isMemoFormCollapsed}
              aria-controls="new-memo-form"
            >
              {isMemoFormCollapsed ? t.openForm : t.collapseForm}
            </button>
            <button type="button" className="ghost ai-draft-btn" onClick={onAIDraftMemo} disabled={isAIDrafting}>
              {isAIDrafting ? t.aiDrafting : t.aiDraft}
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

              <label htmlFor="memo-background" className="full">{t.background}</label>
              <textarea
                id="memo-background"
                className="full"
                value={form.background}
                onChange={(event) => setForm({ ...form, background: event.target.value })}
                placeholder="Context and rationale."
                rows={3}
                aria-required="true"
              />

              <label htmlFor="memo-analysis" className="full">{t.analysisOptional}</label>
              <textarea
                id="memo-analysis"
                className="full"
                value={form.analysis}
                onChange={(event) => setForm({ ...form, analysis: event.target.value })}
                placeholder="Assessment, trade-offs, and risks."
                rows={3}
              />

              <label htmlFor="memo-recommendation" className="full">{t.recommendation}</label>
              <textarea
                id="memo-recommendation"
                className="full"
                value={form.recommendation}
                onChange={(event) => setForm({ ...form, recommendation: event.target.value })}
                placeholder="Decision requested."
                rows={3}
                aria-required="true"
              />

              <label htmlFor="memo-attachment">{t.attachmentOptional}</label>
              <input
                id="memo-attachment"
                type="file"
                onChange={(event) => setForm({ ...form, attachment_name: event.target.files?.[0]?.name ?? '' })}
              />
              {form.attachment_name && <p className="file-chip">Attached: {form.attachment_name}</p>}

              <button type="submit" disabled={isSaving} aria-keyshortcuts="Alt+Shift+S">{isSaving ? '...' : t.createMemo}</button>
            </form>
          </div>

          <div className="panel health-panel">
            <h3>Workflow Health</h3>
            <div className="health-grid">
              <div><span className="health-value">{workflowHealth.blocked}</span><p>{t.blocked}</p></div>
              <div><span className="health-value">{workflowHealth.overdueApprovals}</span><p>{t.overdueApprovals}</p></div>
              <div><span className="health-value">{workflowHealth.unresolvedSubstitutions}</span><p>{t.pendingSubs}</p></div>
            </div>
          </div>
        </aside>

        <div className="panel" id="memo-register">
          <div className="list-header">
            <h3>{t.memoRegister}</h3>
            <div className="filters">
              <div className="search-wrap">
                <Icon name="search" />
                <input
                  ref={searchRef}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t.search}
                  aria-label="Search memos"
                />
              </div>
              <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as ActionStatus | 'All')} aria-label="Filter by status">
                <option value="All">{t.statusAll}</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {localizedStatusLabels[status] ?? status}
                  </option>
                ))}
              </select>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
                <option value="dueAsc">Due soonest</option>
                <option value="dueDesc">Due latest</option>
                <option value="priority">Risk</option>
                <option value="recent">Recent</option>
              </select>
              <label className="toggle"><input type="checkbox" checked={showOpenOnly} onChange={(event) => setShowOpenOnly(event.target.checked)} />{t.openOnly}</label>
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
                {t.reset}
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
                      <span className={`pill status-${action.status.toLowerCase().replaceAll(' ', '-')}`}>
                        {localizedStatusLabels[action.status] ?? action.status}
                      </span>
                      <span className={`pill mode-${mode.toLowerCase()}`}>{mode}</span>
                    </div>
                  </div>

                  <div className="memo-sections">
                    <p className="card-body"><strong>{t.background}:</strong> {action.memo_background || 'Not provided.'}</p>
                    {action.memo_analysis && <p className="card-body"><strong>{t.analysisOptional}:</strong> {action.memo_analysis}</p>}
                    <p className="card-body"><strong>{t.recommendation}:</strong> {action.memo_recommendation || action.notes}</p>
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
                    <button type="button" className="compact" disabled={updatingId === action.id || action.status !== 'Draft'} onClick={() => onSubmitForReview(action)}>{t.submit}</button>
                    <button type="button" className="compact" disabled={updatingId === action.id || !canAct || hasUnavailableCurrent} onClick={() => onDecision(action, 'Approved')}>{t.approve}</button>
                    <button type="button" className="compact warn" disabled={updatingId === action.id || !canAct || hasUnavailableCurrent} onClick={() => onDecision(action, 'Sent Back')}>{t.sendBack}</button>
                    <button type="button" className="compact danger" disabled={updatingId === action.id || !canAct || hasUnavailableCurrent} onClick={() => onDecision(action, 'Rejected')}>{t.reject}</button>
                    {!isClosed(action.status) && (
                      <button type="button" className="compact" disabled={updatingId === action.id} onClick={() => onManualStatusChange(action, 'Completed')}>{t.done}</button>
                    )}
                    <button
                      type="button"
                      className="ghost compact"
                      onClick={() => setExpandedTimelines((current) => ({ ...current, [action.id]: !Boolean(current[action.id]) }))}
                    >
                      {t.timeline}
                    </button>
                    <button
                      type="button"
                      className="ghost compact"
                      onClick={() => onAISnapshot(action)}
                      disabled={Boolean(aiSnapshotLoadingById[action.id])}
                    >
                      {aiSnapshotLoadingById[action.id] ? 'AI...' : t.aiSnapshot}
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
            {t.submit}
          </button>
          <button
            type="button"
            className="compact"
            onClick={() => onDecision(selectedAction, 'Approved')}
            disabled={!canActOnCurrentStep(selectedAction, actingAs, isAdminMode)}
          >
            {t.approve}
          </button>
          <button
            type="button"
            className="compact warn"
            onClick={() => onDecision(selectedAction, 'Sent Back')}
            disabled={!canActOnCurrentStep(selectedAction, actingAs, isAdminMode)}
          >
            {t.sendBack}
          </button>
          <button
            type="button"
            className="compact danger"
            onClick={() => onDecision(selectedAction, 'Rejected')}
            disabled={!canActOnCurrentStep(selectedAction, actingAs, isAdminMode)}
          >
            {t.reject}
          </button>
          <button
            type="button"
            className="ghost compact"
            onClick={() => setExpandedTimelines((current) => ({ ...current, [selectedAction.id]: !Boolean(current[selectedAction.id]) }))}
          >
            {t.timeline}
          </button>
        </section>
      )}
    </main>
  )
}

export default App
