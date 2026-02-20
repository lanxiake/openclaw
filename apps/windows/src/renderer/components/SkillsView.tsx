/**
 * SkillsView Component - 技能管理视图
 *
 * 显示已安装技能、技能商店和技能详情
 * 支持技能的安装、卸载、启用、禁用和配置管理
 * 包含"我的技能"和"技能商店"两个标签页
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  useSkills,
  type SkillInfo,
  type SkillDetail,
  type SkillStats,
  type SkillConfig
} from '../hooks/useSkills'
import { SkillStoreView } from './SkillStoreView'
import './SkillsView.css'

/**
 * 标签页类型定义
 */
type TabType = 'my-skills' | 'store'

interface SkillsViewProps {
  isConnected: boolean
}

/**
 * 技能分类标签配置
 */
const CATEGORY_LABELS: Record<string, string> = {
  'file-management': '文件管理',
  'system': '系统工具',
  'communication': '通讯',
  'productivity': '效率工具',
  'development': '开发工具',
  'media': '媒体处理',
  'automation': '自动化',
  'custom': '自定义',
}

/**
 * 获取分类标签
 */
function getCategoryLabel(category?: string): string {
  if (!category) return '其他'
  return CATEGORY_LABELS[category] || category
}

/**
 * 获取状态标签
 */
function getStatusLabel(status: string): { label: string; className: string } {
  switch (status) {
    case 'loaded':
      return { label: '已加载', className: 'status-loaded' }
    case 'loading':
      return { label: '加载中', className: 'status-loading' }
    case 'error':
      return { label: '错误', className: 'status-error' }
    case 'disabled':
      return { label: '已禁用', className: 'status-disabled' }
    default:
      return { label: status, className: '' }
  }
}

/**
 * 获取来源标签
 */
function getOriginLabel(origin: string): string {
  switch (origin) {
    case 'builtin':
      return '内置'
    case 'installed':
      return '已安装'
    case 'workspace':
      return '工作区'
    default:
      return origin
  }
}

/**
 * 技能卡片组件
 */
const SkillCard: React.FC<{
  skill: SkillInfo
  onSelect: () => void
  isSelected: boolean
  onToggle: () => void
  isToggling: boolean
}> = ({ skill, onSelect, isSelected, onToggle, isToggling }) => {
  const statusInfo = getStatusLabel(skill.status)

  /**
   * 处理启用/禁用按钮点击
   */
  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation() // 阻止卡片选中
    onToggle()
  }

  return (
    <div
      className={`skill-card ${isSelected ? 'selected' : ''} ${skill.status}`}
      onClick={onSelect}
    >
      <div className="skill-card-icon">
        {skill.icon || '🔧'}
      </div>
      <div className="skill-card-content">
        <div className="skill-card-header">
          <h4 className="skill-name">{skill.name}</h4>
          <span className={`skill-status ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>
        <p className="skill-description">{skill.description}</p>
        <div className="skill-card-footer">
          <span className="skill-category">{getCategoryLabel(skill.category)}</span>
          <span className="skill-origin">{getOriginLabel(skill.origin)}</span>
          {skill.executionCount > 0 && (
            <span className="skill-usage">执行 {skill.executionCount} 次</span>
          )}
        </div>
      </div>
      <div className="skill-card-actions">
        <button
          className={`toggle-button ${skill.status === 'disabled' ? 'enable' : 'disable'}`}
          onClick={handleToggleClick}
          disabled={isToggling || skill.status === 'loading'}
          title={skill.status === 'disabled' ? '启用技能' : '禁用技能'}
        >
          {isToggling ? '⏳' : skill.status === 'disabled' ? '▶️' : '⏸️'}
        </button>
      </div>
    </div>
  )
}

/**
 * 技能详情面板
 */
const SkillDetailPanel: React.FC<{
  skill: SkillDetail | null
  onExecute: (params?: Record<string, unknown>) => void
  onToggle: () => void
  onUninstall: () => void
  isExecuting: boolean
  isToggling: boolean
  isUninstalling: boolean
}> = ({ skill, onExecute, onToggle, onUninstall, isExecuting, isToggling, isUninstalling }) => {
  const [params, setParams] = useState<Record<string, string>>({})

  // 当技能变化时重置参数
  useEffect(() => {
    setParams({})
  }, [skill?.id])

  if (!skill) {
    return (
      <div className="skill-detail-panel empty">
        <div className="empty-icon">📋</div>
        <p>选择一个技能查看详情</p>
      </div>
    )
  }

  const statusInfo = getStatusLabel(skill.status)

  /**
   * 处理执行
   */
  const handleExecute = () => {
    // 将字符串参数转换为适当的类型
    const typedParams: Record<string, unknown> = {}
    if (skill.parameters) {
      for (const param of skill.parameters) {
        const value = params[param.name]
        if (value !== undefined && value !== '') {
          switch (param.type) {
            case 'number':
              typedParams[param.name] = Number(value)
              break
            case 'boolean':
              typedParams[param.name] = value === 'true'
              break
            default:
              typedParams[param.name] = value
          }
        }
      }
    }
    onExecute(Object.keys(typedParams).length > 0 ? typedParams : undefined)
  }

  /**
   * 处理卸载确认
   */
  const handleUninstall = () => {
    if (window.confirm(`确定要卸载技能 "${skill.name}" 吗？此操作不可恢复。`)) {
      onUninstall()
    }
  }

  return (
    <div className="skill-detail-panel">
      <div className="skill-detail-header">
        <div className="skill-detail-icon">{skill.icon || '🔧'}</div>
        <div className="skill-detail-title">
          <h3>{skill.name}</h3>
          <span className="skill-version">v{skill.version}</span>
          <span className={`skill-status ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="skill-detail-body">
        <section className="detail-section">
          <h4>描述</h4>
          <p>{skill.description}</p>
        </section>

        <section className="detail-section">
          <h4>信息</h4>
          <dl className="detail-info">
            <div>
              <dt>来源</dt>
              <dd>{getOriginLabel(skill.origin)}</dd>
            </div>
            <div>
              <dt>运行模式</dt>
              <dd>{skill.runMode === 'local' ? '本地' : skill.runMode === 'server' ? '服务端' : '混合'}</dd>
            </div>
            <div>
              <dt>分类</dt>
              <dd>{getCategoryLabel(skill.category)}</dd>
            </div>
            {skill.executionCount > 0 && (
              <div>
                <dt>执行次数</dt>
                <dd>{skill.executionCount}</dd>
              </div>
            )}
            {skill.lastExecutedAt && (
              <div>
                <dt>最后执行</dt>
                <dd>{new Date(skill.lastExecutedAt).toLocaleString('zh-CN')}</dd>
              </div>
            )}
          </dl>
        </section>

        {skill.triggers && skill.triggers.length > 0 && (
          <section className="detail-section">
            <h4>触发方式</h4>
            <ul className="trigger-list">
              {skill.triggers.map((trigger, index) => (
                <li key={index} className="trigger-item">
                  {trigger.type === 'command' && (
                    <span>命令: <code>/{trigger.command}</code></span>
                  )}
                  {trigger.type === 'keyword' && (
                    <span>关键词: {trigger.keywords?.join(', ')}</span>
                  )}
                  {trigger.type === 'event' && (
                    <span>事件: {trigger.event}</span>
                  )}
                  {trigger.type === 'schedule' && (
                    <span>定时: {trigger.cron}</span>
                  )}
                  {trigger.type === 'ai-invoke' && (
                    <span>AI 调用</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {skill.parameters && skill.parameters.length > 0 && (
          <section className="detail-section">
            <h4>参数</h4>
            <div className="param-form">
              {skill.parameters.map((param) => (
                <div key={param.name} className="param-field">
                  <label htmlFor={`param-${param.name}`}>
                    {param.name}
                    {param.required && <span className="required">*</span>}
                  </label>
                  {param.enum ? (
                    <select
                      id={`param-${param.name}`}
                      value={params[param.name] || ''}
                      onChange={(e) =>
                        setParams((prev) => ({ ...prev, [param.name]: e.target.value }))
                      }
                    >
                      <option value="">请选择</option>
                      {param.enum.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : param.type === 'boolean' ? (
                    <select
                      id={`param-${param.name}`}
                      value={params[param.name] || ''}
                      onChange={(e) =>
                        setParams((prev) => ({ ...prev, [param.name]: e.target.value }))
                      }
                    >
                      <option value="">请选择</option>
                      <option value="true">是</option>
                      <option value="false">否</option>
                    </select>
                  ) : (
                    <input
                      id={`param-${param.name}`}
                      type={param.type === 'number' ? 'number' : 'text'}
                      value={params[param.name] || ''}
                      onChange={(e) =>
                        setParams((prev) => ({ ...prev, [param.name]: e.target.value }))
                      }
                      placeholder={param.description}
                    />
                  )}
                  <span className="param-hint">{param.description}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {skill.error && (
          <section className="detail-section error-section">
            <h4>错误信息</h4>
            <p className="error-message">{skill.error}</p>
          </section>
        )}
      </div>

      <div className="skill-detail-footer">
        <div className="footer-actions">
          <button
            className="execute-button"
            onClick={handleExecute}
            disabled={skill.status !== 'loaded' || isExecuting}
          >
            {isExecuting ? '执行中...' : '执行技能'}
          </button>
          <button
            className={`toggle-button ${skill.status === 'disabled' ? 'enable' : 'disable'}`}
            onClick={onToggle}
            disabled={isToggling || skill.status === 'loading'}
          >
            {isToggling ? '处理中...' : skill.status === 'disabled' ? '启用' : '禁用'}
          </button>
          {skill.origin !== 'builtin' && (
            <button
              className="uninstall-button"
              onClick={handleUninstall}
              disabled={isUninstalling}
            >
              {isUninstalling ? '卸载中...' : '卸载'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 技能统计信息卡片
 */
const StatsCard: React.FC<{ stats: SkillStats | null }> = ({ stats }) => {
  if (!stats) return null

  return (
    <div className="stats-card">
      <div className="stat-item">
        <span className="stat-value">{stats.total}</span>
        <span className="stat-label">总数</span>
      </div>
      <div className="stat-item">
        <span className="stat-value stat-loaded">{stats.loaded}</span>
        <span className="stat-label">已加载</span>
      </div>
      <div className="stat-item">
        <span className="stat-value stat-disabled">{stats.disabled}</span>
        <span className="stat-label">已禁用</span>
      </div>
      {stats.error > 0 && (
        <div className="stat-item">
          <span className="stat-value stat-error">{stats.error}</span>
          <span className="stat-label">错误</span>
        </div>
      )}
    </div>
  )
}

/**
 * 安装技能对话框
 */
const InstallSkillDialog: React.FC<{
  isOpen: boolean
  onClose: () => void
  onInstall: (localPath?: string, sourceUrl?: string) => void
  isInstalling: boolean
}> = ({ isOpen, onClose, onInstall, isInstalling }) => {
  const [installMode, setInstallMode] = useState<'local' | 'url'>('local')
  const [localPath, setLocalPath] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')

  if (!isOpen) return null

  /**
   * 处理选择文件夹
   */
  const handleSelectFolder = async () => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择技能目录'
      })
      if (!result.canceled && result.filePaths.length > 0) {
        setLocalPath(result.filePaths[0])
      }
    } catch (err) {
      console.error('[SkillsView] 选择文件夹失败:', err)
    }
  }

  /**
   * 处理安装
   */
  const handleInstall = () => {
    if (installMode === 'local' && localPath) {
      onInstall(localPath, undefined)
    } else if (installMode === 'url' && sourceUrl) {
      onInstall(undefined, sourceUrl)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content install-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>安装技能</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <div className="dialog-body">
          <div className="install-mode-selector">
            <label>
              <input
                type="radio"
                name="installMode"
                value="local"
                checked={installMode === 'local'}
                onChange={() => setInstallMode('local')}
              />
              从本地安装
            </label>
            <label>
              <input
                type="radio"
                name="installMode"
                value="url"
                checked={installMode === 'url'}
                onChange={() => setInstallMode('url')}
              />
              从 URL 安装
            </label>
          </div>

          {installMode === 'local' ? (
            <div className="install-field">
              <label>技能目录</label>
              <div className="path-input">
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="选择技能目录..."
                  readOnly
                />
                <button onClick={handleSelectFolder}>浏览...</button>
              </div>
              <span className="field-hint">选择包含 skill.json 的技能目录</span>
            </div>
          ) : (
            <div className="install-field">
              <label>技能 URL</label>
              <input
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
              />
              <span className="field-hint">输入技能包的下载地址</span>
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <button className="cancel-button" onClick={onClose}>取消</button>
          <button
            className="confirm-button"
            onClick={handleInstall}
            disabled={isInstalling || (installMode === 'local' ? !localPath : !sourceUrl)}
          >
            {isInstalling ? '安装中...' : '安装'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 技能管理视图
 */
export const SkillsView: React.FC<SkillsViewProps> = ({ isConnected }) => {
  const {
    skills,
    allSkills,
    stats,
    isLoading,
    error,
    loadSkills,
    loadAllSkills,
    getSkillDetail,
    getSkillStats,
    executeSkill,
    installSkill,
    uninstallSkill,
    toggleSkill,
    reloadSkills,
  } = useSkills()

  // 当前激活的标签页
  const [activeTab, setActiveTab] = useState<TabType>('my-skills')

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<SkillDetail | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [isUninstalling, setIsUninstalling] = useState(false)
  const [togglingSkillId, setTogglingSkillId] = useState<string | null>(null)
  const [executionResult, setExecutionResult] = useState<{
    success: boolean
    message?: string
  } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [showAllSkills, setShowAllSkills] = useState(true)
  const [groupByStatus, setGroupByStatus] = useState(true)
  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  /**
   * 初始加载技能列表
   */
  useEffect(() => {
    if (isConnected) {
      loadAllSkills()
      getSkillStats()
    }
  }, [isConnected, loadAllSkills, getSkillStats])

  /**
   * 加载选中技能的详情
   */
  useEffect(() => {
    if (selectedSkillId) {
      getSkillDetail(selectedSkillId).then(setSelectedDetail)
    } else {
      setSelectedDetail(null)
    }
  }, [selectedSkillId, getSkillDetail])

  /**
   * 处理技能执行
   */
  const handleExecute = useCallback(
    async (params?: Record<string, unknown>) => {
      if (!selectedSkillId) return

      setIsExecuting(true)
      setExecutionResult(null)

      try {
        const result = await executeSkill(selectedSkillId, params)
        setExecutionResult({
          success: result.success,
          message: result.success
            ? result.message || '执行成功'
            : result.error || '执行失败',
        })

        // 刷新详情
        const detail = await getSkillDetail(selectedSkillId)
        setSelectedDetail(detail)
      } catch (err) {
        setExecutionResult({
          success: false,
          message: err instanceof Error ? err.message : '执行失败',
        })
      } finally {
        setIsExecuting(false)
      }
    },
    [selectedSkillId, executeSkill, getSkillDetail]
  )

  /**
   * 处理技能启用/禁用
   */
  const handleToggle = useCallback(
    async (skillId: string) => {
      setTogglingSkillId(skillId)
      setIsToggling(true)

      try {
        const result = await toggleSkill(skillId)
        if (result.error) {
          setExecutionResult({
            success: false,
            message: result.error,
          })
        } else {
          setExecutionResult({
            success: true,
            message: result.enabled ? '技能已启用' : '技能已禁用',
          })
        }

        // 刷新详情
        if (selectedSkillId === skillId) {
          const detail = await getSkillDetail(skillId)
          setSelectedDetail(detail)
        }
      } catch (err) {
        setExecutionResult({
          success: false,
          message: err instanceof Error ? err.message : '切换状态失败',
        })
      } finally {
        setIsToggling(false)
        setTogglingSkillId(null)
      }
    },
    [selectedSkillId, toggleSkill, getSkillDetail]
  )

  /**
   * 处理技能卸载
   */
  const handleUninstall = useCallback(async () => {
    if (!selectedSkillId) return

    setIsUninstalling(true)

    try {
      const success = await uninstallSkill(selectedSkillId)
      if (success) {
        setExecutionResult({
          success: true,
          message: '技能已卸载',
        })
        setSelectedSkillId(null)
        setSelectedDetail(null)
      } else {
        setExecutionResult({
          success: false,
          message: '卸载失败',
        })
      }
    } catch (err) {
      setExecutionResult({
        success: false,
        message: err instanceof Error ? err.message : '卸载失败',
      })
    } finally {
      setIsUninstalling(false)
    }
  }, [selectedSkillId, uninstallSkill])

  /**
   * 处理技能安装
   */
  const handleInstall = useCallback(
    async (localPath?: string, sourceUrl?: string) => {
      setIsInstalling(true)

      try {
        const result = await installSkill({ localPath, sourceUrl })
        if (result.success) {
          setExecutionResult({
            success: true,
            message: `技能 ${result.skillId} 安装成功`,
          })
          setShowInstallDialog(false)
        } else {
          setExecutionResult({
            success: false,
            message: result.error || '安装失败',
          })
        }
      } catch (err) {
        setExecutionResult({
          success: false,
          message: err instanceof Error ? err.message : '安装失败',
        })
      } finally {
        setIsInstalling(false)
      }
    },
    [installSkill]
  )

  /**
   * 获取显示的技能列表
   */
  const displaySkills = showAllSkills ? allSkills : skills

  /**
   * 过滤技能列表
   */
  const filteredSkills = displaySkills.filter((skill) => {
    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchName = skill.name.toLowerCase().includes(query)
      const matchDesc = skill.description.toLowerCase().includes(query)
      if (!matchName && !matchDesc) return false
    }
    // 分类过滤
    if (filterCategory && skill.category !== filterCategory) {
      return false
    }
    // 状态过滤
    if (filterStatus && skill.status !== filterStatus) {
      return false
    }
    return true
  })

  /**
   * 按状态分组的技能列表
   */
  const errorSkills = filteredSkills.filter((s) => s.status === 'error')
  const enabledSkills = filteredSkills.filter((s) => s.status === 'loaded')
  const disabledSkills = filteredSkills.filter((s) => s.status === 'disabled')

  /** 仅在启用分组且未按状态筛选时使用分组展示 */
  const useGroupedDisplay = groupByStatus && !filterStatus

  /**
   * 获取所有分类
   */
  const categories = Array.from(new Set(displaySkills.map((s) => s.category).filter(Boolean)))

  /**
   * 处理技能商店安装完成回调
   */
  const handleStoreInstallComplete = useCallback(() => {
    // 刷新我的技能列表
    loadAllSkills()
    getSkillStats()
    // 显示成功提示
    setExecutionResult({
      success: true,
      message: '技能安装成功',
    })
  }, [loadAllSkills, getSkillStats])

  if (!isConnected) {
    return (
      <div className="skills-view disconnected">
        <div className="disconnected-message">
          <span className="icon">🔌</span>
          <p>请先连接 Gateway 以管理技能</p>
        </div>
      </div>
    )
  }

  return (
    <div className="skills-view">
      {/* 标签页导航 */}
      <div className="skills-tabs">
        <button
          className={`tab-button ${activeTab === 'my-skills' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-skills')}
        >
          <span className="tab-icon">📦</span>
          <span className="tab-label">我的技能</span>
          {stats && (
            <span className="tab-badge">{stats.total}</span>
          )}
        </button>
        <button
          className={`tab-button ${activeTab === 'store' ? 'active' : ''}`}
          onClick={() => setActiveTab('store')}
        >
          <span className="tab-icon">🏪</span>
          <span className="tab-label">技能商店</span>
        </button>
      </div>

      {/* 技能商店标签页 */}
      {activeTab === 'store' && (
        <SkillStoreView
          isConnected={isConnected}
          onInstallComplete={handleStoreInstallComplete}
        />
      )}

      {/* 我的技能标签页 */}
      {activeTab === 'my-skills' && (
        <>
          {/* 工具栏 */}
          <div className="skills-toolbar">
            <div className="toolbar-left">
              <h2>我的技能</h2>
              <StatsCard stats={stats} />
            </div>
            <div className="toolbar-right">
              <input
                type="text"
                className="search-input"
                placeholder="搜索技能..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="category-filter"
                value={filterCategory || ''}
                onChange={(e) => setFilterCategory(e.target.value || null)}
              >
                <option value="">全部分类</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {getCategoryLabel(cat)}
                  </option>
                ))}
              </select>
              <select
                className="status-filter"
                value={filterStatus || ''}
                onChange={(e) => setFilterStatus(e.target.value || null)}
              >
                <option value="">全部状态</option>
                <option value="loaded">已加载</option>
                <option value="disabled">已禁用</option>
                <option value="error">错误</option>
              </select>
              <label className="show-all-toggle">
                <input
                  type="checkbox"
                  checked={showAllSkills}
                  onChange={(e) => setShowAllSkills(e.target.checked)}
                />
                显示禁用
              </label>
              <label className="show-all-toggle">
                <input
                  type="checkbox"
                  checked={groupByStatus}
                  onChange={(e) => setGroupByStatus(e.target.checked)}
                />
                分组
              </label>
              <button
                className="install-button"
                onClick={() => setShowInstallDialog(true)}
                title="安装技能"
              >
                ➕ 安装
              </button>
              <button
                className="reload-button"
                onClick={reloadSkills}
                disabled={isLoading}
                title="重新加载技能"
              >
                {isLoading ? '⏳' : '🔄'}
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="error-banner">
              <span>❌ {error}</span>
              <button onClick={loadAllSkills}>重试</button>
            </div>
          )}

          {/* 执行结果提示 */}
          {executionResult && (
            <div className={`result-banner ${executionResult.success ? 'success' : 'error'}`}>
              <span>
                {executionResult.success ? '✅' : '❌'} {executionResult.message}
              </span>
              <button onClick={() => setExecutionResult(null)}>✕</button>
            </div>
          )}

          {/* 主内容区 */}
          <div className="skills-content">
            {/* 技能列表 */}
            <div className="skills-list">
              {isLoading && displaySkills.length === 0 ? (
                <div className="loading-state">
                  <span className="spinner">⏳</span>
                  <p>加载技能中...</p>
                </div>
              ) : filteredSkills.length === 0 ? (
                <div className="empty-state">
                  <span className="icon">📭</span>
                  <p>{searchQuery || filterCategory || filterStatus ? '没有找到匹配的技能' : '暂无技能'}</p>
                </div>
              ) : useGroupedDisplay ? (
                <>
                  {errorSkills.length > 0 && (
                    <div className="skill-group">
                      <h3 className="skill-group-title error-group">
                        ❌ 加载失败 ({errorSkills.length})
                      </h3>
                      {errorSkills.map((skill) => (
                        <SkillCard
                          key={skill.id}
                          skill={skill}
                          isSelected={skill.id === selectedSkillId}
                          onSelect={() => setSelectedSkillId(skill.id)}
                          onToggle={() => handleToggle(skill.id)}
                          isToggling={isToggling && togglingSkillId === skill.id}
                        />
                      ))}
                    </div>
                  )}
                  {enabledSkills.length > 0 && (
                    <div className="skill-group">
                      <h3 className="skill-group-title enabled-group">
                        ▶️ 已启用 ({enabledSkills.length})
                      </h3>
                      {enabledSkills.map((skill) => (
                        <SkillCard
                          key={skill.id}
                          skill={skill}
                          isSelected={skill.id === selectedSkillId}
                          onSelect={() => setSelectedSkillId(skill.id)}
                          onToggle={() => handleToggle(skill.id)}
                          isToggling={isToggling && togglingSkillId === skill.id}
                        />
                      ))}
                    </div>
                  )}
                  {disabledSkills.length > 0 && (
                    <div className="skill-group">
                      <h3 className="skill-group-title disabled-group">
                        ⏸️ 已禁用 ({disabledSkills.length})
                      </h3>
                      {disabledSkills.map((skill) => (
                        <SkillCard
                          key={skill.id}
                          skill={skill}
                          isSelected={skill.id === selectedSkillId}
                          onSelect={() => setSelectedSkillId(skill.id)}
                          onToggle={() => handleToggle(skill.id)}
                          isToggling={isToggling && togglingSkillId === skill.id}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                filteredSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    isSelected={skill.id === selectedSkillId}
                    onSelect={() => setSelectedSkillId(skill.id)}
                    onToggle={() => handleToggle(skill.id)}
                    isToggling={isToggling && togglingSkillId === skill.id}
                  />
                ))
              )}
            </div>

            {/* 技能详情 */}
            <SkillDetailPanel
              skill={selectedDetail}
              onExecute={handleExecute}
              onToggle={() => selectedSkillId && handleToggle(selectedSkillId)}
              onUninstall={handleUninstall}
              isExecuting={isExecuting}
              isToggling={isToggling && togglingSkillId === selectedSkillId}
              isUninstalling={isUninstalling}
            />
          </div>
        </>
      )}

      {/* 安装技能对话框 */}
      <InstallSkillDialog
        isOpen={showInstallDialog}
        onClose={() => setShowInstallDialog(false)}
        onInstall={handleInstall}
        isInstalling={isInstalling}
      />
    </div>
  )
}
