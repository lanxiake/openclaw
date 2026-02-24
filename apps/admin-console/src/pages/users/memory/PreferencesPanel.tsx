/**
 * 用户偏好设置面板
 *
 * 只读展示用户的偏好配置。
 */

import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { useMemoryPreferences } from '@/hooks/useMemory'

interface PreferencesPanelProps {
  userId: string
}

/** 偏好字段中文标签 */
const PREFERENCE_LABELS: Record<string, string> = {
  language: '语言',
  timezone: '时区',
  responseStyle: '回复风格',
  confirmLevel: '确认级别',
  thinkingLevel: '思考级别',
  verboseLevel: '详细级别',
  favoriteSkills: '喜爱技能',
  disabledSkills: '禁用技能',
  notifications: '通知设置',
}

/**
 * 用户偏好面板组件
 */
export default function PreferencesPanel({ userId }: PreferencesPanelProps) {
  const { data, isLoading } = useMemoryPreferences(userId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const prefs = data

  if (!prefs) {
    return <div className="text-center py-8 text-muted-foreground">该用户暂未配置偏好设置</div>
  }

  return (
    <div className="space-y-4">
      {Object.entries(prefs).map(([key, value]) => {
        if (value === undefined || value === null) return null
        const label = PREFERENCE_LABELS[key] ?? key

        return (
          <div key={key} className="flex items-start gap-4 p-3 rounded-lg border">
            <Label className="w-24 shrink-0 pt-0.5 text-muted-foreground">{label}</Label>
            <div className="flex-1">
              <PreferenceValue value={value} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * 渲染偏好值
 */
function PreferenceValue({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return <span className="text-sm">{value || '-'}</span>
  }

  if (typeof value === 'number') {
    return <span className="text-sm font-mono">{value}</span>
  }

  if (typeof value === 'boolean') {
    return <Badge variant={value ? 'success' : 'secondary'}>{value ? '开启' : '关闭'}</Badge>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-sm text-muted-foreground">空</span>
    }
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, i) => (
          <Badge key={i} variant="outline" className="text-xs">
            {String(item)}
          </Badge>
        ))}
      </div>
    )
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-40">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }

  return <span className="text-sm text-muted-foreground">-</span>
}
