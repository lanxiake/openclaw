/**
 * 敏感操作确认对话框组件
 *
 * 当 AI 助手需要执行敏感操作时，显示确认对话框让用户批准或拒绝
 * 支持不同风险等级的视觉提示
 */

import React from 'react'

/**
 * 确认请求的数据结构
 */
export interface ConfirmRequest {
  /** 唯一请求 ID */
  requestId: string
  /** 操作名称 */
  action: string
  /** 操作描述 */
  description: string
  /** 风险等级 */
  level: 'low' | 'medium' | 'high'
  /** 超时时间 (毫秒) */
  timeoutMs: number
}

interface ConfirmDialogProps {
  /** 确认请求数据 */
  request: ConfirmRequest
  /** 用户响应回调 */
  onResponse: (requestId: string, approved: boolean) => void
}

/**
 * 根据风险等级获取样式类名
 */
function getLevelClass(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low':
      return 'confirm-level-low'
    case 'medium':
      return 'confirm-level-medium'
    case 'high':
      return 'confirm-level-high'
    default:
      return 'confirm-level-medium'
  }
}

/**
 * 根据风险等级获取图标
 */
function getLevelIcon(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low':
      return '✓'
    case 'medium':
      return '⚠'
    case 'high':
      return '⛔'
    default:
      return '⚠'
  }
}

/**
 * 根据风险等级获取标题
 */
function getLevelTitle(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low':
      return '操作确认'
    case 'medium':
      return '需要确认'
    case 'high':
      return '高风险操作'
    default:
      return '需要确认'
  }
}

/**
 * 敏感操作确认对话框
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ request, onResponse }) => {
  const [countdown, setCountdown] = React.useState(Math.ceil(request.timeoutMs / 1000))
  const [isResponding, setIsResponding] = React.useState(false)

  // 倒计时效果
  React.useEffect(() => {
    if (countdown <= 0) {
      // 超时自动拒绝
      console.log('[ConfirmDialog] 确认请求超时，自动拒绝:', request.requestId)
      onResponse(request.requestId, false)
      return
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [countdown, request.requestId, onResponse])

  /**
   * 处理用户响应
   */
  const handleResponse = async (approved: boolean) => {
    if (isResponding) {
      return
    }

    setIsResponding(true)
    console.log('[ConfirmDialog] 用户响应:', { requestId: request.requestId, approved })

    try {
      onResponse(request.requestId, approved)
    } catch (error) {
      console.error('[ConfirmDialog] 响应失败:', error)
      setIsResponding(false)
    }
  }

  const levelClass = getLevelClass(request.level)
  const levelIcon = getLevelIcon(request.level)
  const levelTitle = getLevelTitle(request.level)

  return (
    <div className="confirm-dialog-overlay">
      <div className={`confirm-dialog ${levelClass}`}>
        {/* 头部 */}
        <div className="confirm-dialog-header">
          <span className="confirm-dialog-icon">{levelIcon}</span>
          <h3 className="confirm-dialog-title">{levelTitle}</h3>
        </div>

        {/* 内容 */}
        <div className="confirm-dialog-content">
          <div className="confirm-dialog-action">
            <span className="confirm-dialog-label">操作:</span>
            <span className="confirm-dialog-value">{request.action}</span>
          </div>
          <div className="confirm-dialog-description">
            <span className="confirm-dialog-label">详情:</span>
            <p className="confirm-dialog-text">{request.description}</p>
          </div>
        </div>

        {/* 倒计时 */}
        <div className="confirm-dialog-countdown">
          <span className="confirm-dialog-countdown-text">
            {countdown > 0 ? `${countdown} 秒后自动拒绝` : '处理中...'}
          </span>
          <div className="confirm-dialog-countdown-bar">
            <div
              className="confirm-dialog-countdown-progress"
              style={{
                width: `${(countdown / Math.ceil(request.timeoutMs / 1000)) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* 按钮 */}
        <div className="confirm-dialog-actions">
          <button
            className="confirm-dialog-btn confirm-dialog-btn-reject"
            onClick={() => handleResponse(false)}
            disabled={isResponding}
          >
            拒绝
          </button>
          <button
            className="confirm-dialog-btn confirm-dialog-btn-approve"
            onClick={() => handleResponse(true)}
            disabled={isResponding}
          >
            批准
          </button>
        </div>
      </div>
    </div>
  )
}
