export type UiStatus = 'idle' | 'working' | 'error' | 'success'
export type InstanceStatus = 'running' | 'paused' | 'failed' | 'success'

export type SquadSummary = {
  id?: string
  slug?: string
  name: string
  project_path?: string
  universe?: string | null
  agents_count?: number
  instances_active?: number
  instances_total?: number
}

export type SquadAgent = {
  character_name: string
  role_title?: string | null
  charter?: string | null
  model_tier?: string | null
  status: UiStatus
  is_lead?: boolean
  is_qa?: boolean
  current_task?: string | null
}

export type SquadInstance = {
  id: string
  issue_ref?: string | null
  branch_name?: string | null
  status: InstanceStatus
  worktree_path?: string | null
}

export type SquadDecision = {
  id: string
  title: string
  timestamp: string
}

export type SquadCardModel = {
  id: string
  slug: string
  name: string
  project_path: string
  universe: string
  color: string
  status: UiStatus
  unread_count: number
  agents: SquadAgent[]
  instances: SquadInstance[]
  recent_decisions: SquadDecision[]
}

export type FeedEntry = {
  id: number
  type: string
  title: string
  body?: string | null
  created_at: string
  read_at?: string | null
  squad_slug?: string | null
  instance_id?: string | null
  task_id?: string | null
  source_ref?: string | null
  source_type?: string | null
}

export type WikiPageSummary = {
  path: string
  title: string
}

export type WikiTreeNode = {
  id: string
  label: string
  path?: string
  children: WikiTreeNode[]
}

export function normalizeAgentStatus(status?: string | null): UiStatus {
  const value = (status ?? '').toLowerCase()
  if (['error', 'failed', 'failure', 'cancelled', 'aborted'].some((token) => value.includes(token))) return 'error'
  if (['success', 'completed', 'done', 'healthy'].some((token) => value.includes(token))) return 'success'
  if (['working', 'running', 'active', 'queued', 'pending', 'in_progress', 'processing'].some((token) => value.includes(token))) return 'working'
  return 'idle'
}

export function normalizeInstanceStatus(status?: string | null): InstanceStatus {
  const value = (status ?? '').toLowerCase()
  if (['failed', 'error', 'aborted', 'cancelled'].some((token) => value.includes(token))) return 'failed'
  if (['success', 'completed', 'merged'].some((token) => value.includes(token))) return 'success'
  if (['pause', 'idle'].some((token) => value.includes(token))) return 'paused'
  return 'running'
}

export function universeColor(universe?: string | null): string {
  switch ((universe ?? '').toLowerCase()) {
    case 'gi joe':
      return '#5fff87'
    case 'thundercats':
      return '#ffd000'
    case 'a-team':
      return '#ff6b35'
    case 'ghostbusters':
      return '#c4a7ff'
    default:
      return '#00d9ff'
  }
}

export function instanceStatusColor(status: InstanceStatus): string {
  switch (status) {
    case 'failed':
      return '#ff3864'
    case 'success':
      return '#5fff87'
    case 'paused':
      return '#8a8a99'
    default:
      return '#00d9ff'
  }
}

export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function titleizeSlug(value?: string | null): string {
  return (value ?? 'io')
    .replace(/[_/]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\.[^.]+$/, '')
    .replace(/\w/g, (match) => match.toUpperCase())
}

export function formatRelativeTime(value?: string | null): string {
  if (!value) return 'just now'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const diff = date.getTime() - Date.now()
  const past = diff <= 0
  const distance = Math.abs(diff)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  let amount = 0
  let label = 'm'

  if (distance < hour) {
    amount = Math.max(1, Math.round(distance / minute))
    label = 'm'
  } else if (distance < day) {
    amount = Math.round(distance / hour)
    label = 'h'
  } else {
    amount = Math.round(distance / day)
    label = 'd'
  }

  return past ? `${amount}${label} ago` : `in ${amount}${label}`
}

export function categorizeSkill(name: string, path?: string): string {
  const haystack = `${name} ${path ?? ''}`.toLowerCase()
  if (/(read|write|edit|glob|file|path|fs)/.test(haystack)) return 'File System'
  if (/(grep|search|code|analy|lint|semantic|test|debug)/.test(haystack)) return 'Code Intelligence'
  if (/(git|branch|commit|pr|issue|ci|build|release)/.test(haystack)) return 'Git & CI'
  return 'Communication'
}

export function buildWikiTree(pages: WikiPageSummary[]): WikiTreeNode[] {
  const root: WikiTreeNode[] = []

  for (const page of pages) {
    const parts = page.path.split('/').filter(Boolean)
    let level = root
    let trail = ''

    for (const [index, part] of parts.entries()) {
      trail = trail ? `${trail}/${part}` : part
      let node = level.find((entry) => entry.id === trail)
      if (!node) {
        node = {
          id: trail,
          label: index === parts.length - 1 ? page.title : titleizeSlug(part),
          path: index === parts.length - 1 ? page.path : undefined,
          children: [],
        }
        level.push(node)
      }
      level = node.children
    }
  }

  return root
}

export function summarizeSquadStatus(agents: SquadAgent[], summary?: SquadSummary): UiStatus {
  if (agents.some((agent) => agent.status === 'error')) return 'error'
  if (agents.some((agent) => agent.status === 'working')) return 'working'
  if (agents.some((agent) => agent.status === 'success')) return 'success'
  if ((summary?.instances_active ?? 0) > 0) return 'working'
  return 'idle'
}
