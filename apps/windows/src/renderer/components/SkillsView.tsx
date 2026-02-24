/**
 * SkillsView Component - 技能管理视图
 *
 * 显示用户从技能商店安装的技能，支持启用/禁用/卸载操作
 * 包含"我的技能"和"技能商店"两个标签页
 * 数据源：REST API（/api/store/skills/installed）
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  useSkills,
  type InstalledSkillInfo,
  type SkillStats,
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
 * 获取来源类型标签
 */
function getSourceTypeLabel(sourceType: string): string {
  switch (sourceType) {
    case 'system':
      return '官方'
    case 'user':
      return '社区'
    default:
      return sourceType
  }
}

/**
 * 格式化日期显示
 */
function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return dateStr
  }
}

/**
 * 技能卡片组件 - 展示已安装技能信息
 */
const SkillCard: React.FC<{
  skill: InstalledSkillInfo
  onSelect: () => void
  isSelected: boolean
  onToggle: () => void
  onUninstall: () => void
  isToggling: boolean
}> = ({ skill, onSelect, isSelected, onToggle, onUninstall, isToggling }) => {
  /**
   * 处理启用/禁用按钮点击
   */
  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggle()
  }

  /**
   * 处理卸载按钮点击
   */
  const handleUninstallClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm(`确定要卸载技能 "${skill.skill.name}" 吗？`)) {
      onUninstall()
    }
  }

  return (
    <div
      className={`skill-card ${isSelected ? 'selected' : ''} ${skill.isEnabled ? 'status-loaded' : 'status-disabled'}`}
      onClick={onSelect}
    >
      <div className="skill-card-icon">
        {skill.skill.iconUrl ? (
          <img src={skill.skill.iconUrl} alt={skill.skill.name} className="skill-icon-img" />
        ) : (
          '🔧'
        )}
      </div>
      <div className="skill-card-content">
        <div className="skill-card-header">
          <h4 className="skill-name">{skill.skill.name}</h4>
          <span className={`skill-status ${skill.isEnabled ? 'status-loaded' : 'status-disabled'}`}>
            {skill.isEnabled ? '已启用' : '已禁用'}
          </span>
        </div>
        <p className="skill-description">
          {skill.skill.description || '暂无描述'}
        </p>
        <div className="skill-card-footer">
          <span className="skill-origin">{getSourceTypeLabel(skill.skill.sourceType)}</span>
          <span className="skill-version">v{skill.installedVersion}</span>
          {skill.skill.downloadCount > 0 && (
            <span className="skill-usage">下载 {skill.skill.downloadCount} 次</span>
          )}
          {skill.skill.tags && skill.skill.tags.length > 0 && (
            <span className="skill-tags">
              {skill.skill.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="skill-tag">{tag}</span>
              ))}
            </span>
          )}
        </div>
      </div>
      <div className="skill-card-actions">
        <button
          className={`toggle-button ${skill.isEnabled ? 'disable' : 'enable'}`}
          onClick={handleToggleClick}
          disabled={isToggling}
          title={skill.isEnabled ? '禁用技能' : '启用技能'}
        >
          {isToggling ? '...' : skill.isEnabled ? '禁用' : '启用'}
        </button>
        <button
          className="uninstall-button"
          onClick={handleUninstallClick}
          title="卸载技能"
        >
          卸载
        </button>
      </div>
    </div>
  )
}

/**
 * 技能详情面板 - 显示选中技能的详细信息
 */
const SkillDetailPanel: React.FC<{
  skill: InstalledSkillInfo | null
  onToggle: () => void
  onUninstall: () => void
  isToggling: boolean
  isUninstalling: boolean
}> = ({ skill, onToggle, onUninstall, isToggling, isUninstalling }) => {
  if (!skill) {
    return (
      <div className="skill-detail-panel empty">
        <div className="empty-icon">📋</div>
        <p>选择一个技能查看详情</p>
      </div>
    )
  }

  /**
   * 处理卸载确认
   */
  const handleUninstall = () => {
    if (window.confirm(`确定要卸载技能 "${skill.skill.name}" 吗？此操作不可恢复。`)) {
      onUninstall()
    }
  }

  return (
    <div className="skill-detail-panel">
      <div className="skill-detail-header">
        <div className="skill-detail-icon">
          {skill.skill.iconUrl ? (
            <img src={skill.skill.iconUrl} alt={skill.skill.name} className="skill-icon-img" />
          ) : (
            '🔧'
          )}
        </div>
        <div className="skill-detail-title">
          <h3>{skill.skill.name}</h3>
          <span className="skill-version">v{skill.installedVersion}</span>
          <span className={`skill-status ${skill.isEnabled ? 'status-loaded' : 'status-disabled'}`}>
            {skill.isEnabled ? '已启用' : '已禁用'}
          </span>
        </div>
      </div>

      <div className="skill-detail-body">
        <section className="detail-section">
          <h4>描述</h4>
          <p>{skill.skill.description || '暂无描述'}</p>
        </section>

        <section className="detail-section">
          <h4>信息</h4>
          <dl className="detail-info">
            <div>
              <dt>来源</dt>
              <dd>{getSourceTypeLabel(skill.skill.sourceType)}</dd>
            </div>
            {skill.skill.authorName && (
              <div>
                <dt>作者</dt>
                <dd>{skill.skill.authorName}</dd>
              </div>
            )}
            <div>
              <dt>安装版本</dt>
              <dd>{skill.installedVersion}</dd>
            </div>
            <div>
              <dt>最新版本</dt>
              <dd>{skill.skill.version}</dd>
            </div>
            <div>
              <dt>安装时间</dt>
              <dd>{formatDate(skill.installedAt)}</dd>
            </div>
            {skill.lastUsedAt && (
              <div>
                <dt>最后使用</dt>
                <dd>{formatDate(skill.lastUsedAt)}</dd>
              </div>
            )}
            <div>
              <dt>下载次数</dt>
              <dd>{skill.skill.downloadCount}</dd>
            </div>
            {skill.skill.ratingAvg && (
              <div>
                <dt>评分</dt>
                <dd>{skill.skill.ratingAvg} ({skill.skill.ratingCount} 人评价)</dd>
              </div>
            )}
          </dl>
        </section>

        {skill.skill.tags && skill.skill.tags.length > 0 && (
          <section className="detail-section">
            <h4>标签</h4>
            <div className="detail-tags">
              {skill.skill.tags.map((tag) => (
                <span key={tag} className="skill-tag">{tag}</span>
              ))}
            </div>
          </section>
        )}

        {/* 版本不一致提示 */}
        {skill.installedVersion !== skill.skill.version && (
          <section className="detail-section">
            <div className="update-notice">
              有新版本可用: v{skill.installedVersion} → v{skill.skill.version}
            </div>
          </section>
        )}
      </div>

      <div className="skill-detail-footer">
        <div className="footer-actions">
          <button
            className={`toggle-button ${skill.isEnabled ? 'disable' : 'enable'}`}
            onClick={onToggle}
            disabled={isToggling}
          >
            {isToggling ? '处理中...' : skill.isEnabled ? '禁用' : '启用'}
          </button>
          <button
            className="uninstall-button"
            onClick={handleUninstall}
            disabled={isUninstalling}
          >
            {isUninstalling ? '卸载中...' : '卸载'}
          </button>
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
        <span className="stat-value stat-loaded">{stats.enabled}</span>
        <span className="stat-label">已启用</span>
      </div>
      <div className="stat-item">
        <span className="stat-value stat-disabled">{stats.disabled}</span>
        <span className="stat-label">已禁用</span>
      </div>
    </div>
  )
}

/**
 * 技能管理视图主组件
 */
export const SkillsView: React.FC<SkillsViewProps> = ({ isConnected }) => {
  const {
    installedSkills,
    stats,
    isLoading,
    error,
    loadInstalledSkills,
    toggleSkill,
    uninstallSkill,
  } = useSkills()

  /** 当前激活的标签页 */
  const [activeTab, setActiveTab] = useState<TabType>('my-skills')
  /** 选中技能的 skillItemId */
  const [selectedSkillItemId, setSelectedSkillItemId] = useState<string | null>(null)
  /** 操作状态 */
  const [isToggling, setIsToggling] = useState(false)
  const [isUninstalling, setIsUninstalling] = useState(false)
  const [togglingSkillItemId, setTogglingSkillItemId] = useState<string | null>(null)
  /** 操作结果提示 */
  const [resultMessage, setResultMessage] = useState<{
    success: boolean
    message: string
  } | null>(null)
  /** 搜索和过滤 */
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all')

  /**
   * 初始加载已安装技能列表
   */
  useEffect(() => {
    if (isConnected) {
      console.log('[SkillsView] 连接就绪，加载已安装技能')
      loadInstalledSkills()
    }
  }, [isConnected, loadInstalledSkills])

  /**
   * 获取选中的技能对象
   */
  const selectedSkill = selectedSkillItemId
    ? installedSkills.find((s) => s.skillItemId === selectedSkillItemId) ?? null
    : null

  /**
   * 处理技能启用/禁用切换
   */
  const handleToggle = useCallback(
    async (skillItemId: string) => {
      setTogglingSkillItemId(skillItemId)
      setIsToggling(true)

      try {
        const result = await toggleSkill(skillItemId)
        if (result.success) {
          setResultMessage({
            success: true,
            message: result.isEnabled ? '技能已启用' : '技能已禁用',
          })
        } else {
          setResultMessage({
            success: false,
            message: result.error ?? '切换状态失败',
          })
        }
      } catch (err) {
        setResultMessage({
          success: false,
          message: err instanceof Error ? err.message : '切换状态失败',
        })
      } finally {
        setIsToggling(false)
        setTogglingSkillItemId(null)
      }
    },
    [toggleSkill],
  )

  /**
   * 处理技能卸载
   */
  const handleUninstall = useCallback(
    async (skillItemId: string) => {
      setIsUninstalling(true)

      try {
        const success = await uninstallSkill(skillItemId)
        if (success) {
          setResultMessage({ success: true, message: '技能已卸载' })
          /** 如果卸载的是当前选中的技能，清除选中状态 */
          if (selectedSkillItemId === skillItemId) {
            setSelectedSkillItemId(null)
          }
        } else {
          setResultMessage({ success: false, message: '卸载失败' })
        }
      } catch (err) {
        setResultMessage({
          success: false,
          message: err instanceof Error ? err.message : '卸载失败',
        })
      } finally {
        setIsUninstalling(false)
      }
    },
    [uninstallSkill, selectedSkillItemId],
  )

  /**
   * 过滤技能列表
   */
  const filteredSkills = installedSkills.filter((skill) => {
    /** 搜索过滤 */
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchName = skill.skill.name.toLowerCase().includes(query)
      const matchDesc = (skill.skill.description ?? '').toLowerCase().includes(query)
      const matchTags = (skill.skill.tags ?? []).some((tag) =>
        tag.toLowerCase().includes(query),
      )
      if (!matchName && !matchDesc && !matchTags) return false
    }
    /** 状态过滤 */
    if (filterStatus === 'enabled' && !skill.isEnabled) return false
    if (filterStatus === 'disabled' && skill.isEnabled) return false
    return true
  })

  /** 按启用状态分组 */
  const enabledSkills = filteredSkills.filter((s) => s.isEnabled)
  const disabledSkills = filteredSkills.filter((s) => !s.isEnabled)

  /**
   * 技能商店安装完成回调 - 刷新已安装列表
   */
  const handleStoreInstallComplete = useCallback(() => {
    console.log('[SkillsView] 技能商店安装完成，刷新已安装列表')
    loadInstalledSkills()
    setResultMessage({ success: true, message: '技能安装成功' })
  }, [loadInstalledSkills])

  if (!isConnected) {
    return (
      <div className="skills-view disconnected">
        <div className="disconnected-message">
          <span className="icon">🔌</span>
          <p>请先连接服务器以管理技能</p>
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
          {stats && <span className="tab-badge">{stats.total}</span>}
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
                className="status-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'enabled' | 'disabled')}
              >
                <option value="all">全部状态</option>
                <option value="enabled">已启用</option>
                <option value="disabled">已禁用</option>
              </select>
              <button
                className="reload-button"
                onClick={loadInstalledSkills}
                disabled={isLoading}
                title="刷新技能列表"
              >
                {isLoading ? '...' : '刷新'}
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={loadInstalledSkills}>重试</button>
            </div>
          )}

          {/* 操作结果提示 */}
          {resultMessage && (
            <div className={`result-banner ${resultMessage.success ? 'success' : 'error'}`}>
              <span>{resultMessage.message}</span>
              <button onClick={() => setResultMessage(null)}>✕</button>
            </div>
          )}

          {/* 主内容区 */}
          <div className="skills-content">
            {/* 技能列表 */}
            <div className="skills-list">
              {isLoading && installedSkills.length === 0 ? (
                <div className="loading-state">
                  <span className="spinner">...</span>
                  <p>加载技能中...</p>
                </div>
              ) : filteredSkills.length === 0 ? (
                <div className="empty-state">
                  <span className="icon">📭</span>
                  <p>
                    {searchQuery || filterStatus !== 'all'
                      ? '没有找到匹配的技能'
                      : '暂无已安装技能，去技能商店看看吧'}
                  </p>
                  {!searchQuery && filterStatus === 'all' && (
                    <button
                      className="goto-store-button"
                      onClick={() => setActiveTab('store')}
                    >
                      浏览技能商店
                    </button>
                  )}
                </div>
              ) : filterStatus === 'all' ? (
                <>
                  {/* 按启用状态分组展示 */}
                  {enabledSkills.length > 0 && (
                    <div className="skill-group">
                      <h3 className="skill-group-title enabled-group">
                        已启用 ({enabledSkills.length})
                      </h3>
                      {enabledSkills.map((skill) => (
                        <SkillCard
                          key={skill.id}
                          skill={skill}
                          isSelected={skill.skillItemId === selectedSkillItemId}
                          onSelect={() => setSelectedSkillItemId(skill.skillItemId)}
                          onToggle={() => handleToggle(skill.skillItemId)}
                          onUninstall={() => handleUninstall(skill.skillItemId)}
                          isToggling={isToggling && togglingSkillItemId === skill.skillItemId}
                        />
                      ))}
                    </div>
                  )}
                  {disabledSkills.length > 0 && (
                    <div className="skill-group">
                      <h3 className="skill-group-title disabled-group">
                        已禁用 ({disabledSkills.length})
                      </h3>
                      {disabledSkills.map((skill) => (
                        <SkillCard
                          key={skill.id}
                          skill={skill}
                          isSelected={skill.skillItemId === selectedSkillItemId}
                          onSelect={() => setSelectedSkillItemId(skill.skillItemId)}
                          onToggle={() => handleToggle(skill.skillItemId)}
                          onUninstall={() => handleUninstall(skill.skillItemId)}
                          isToggling={isToggling && togglingSkillItemId === skill.skillItemId}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* 按状态筛选时平铺展示 */
                filteredSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    isSelected={skill.skillItemId === selectedSkillItemId}
                    onSelect={() => setSelectedSkillItemId(skill.skillItemId)}
                    onToggle={() => handleToggle(skill.skillItemId)}
                    onUninstall={() => handleUninstall(skill.skillItemId)}
                    isToggling={isToggling && togglingSkillItemId === skill.skillItemId}
                  />
                ))
              )}
            </div>

            {/* 技能详情 */}
            <SkillDetailPanel
              skill={selectedSkill}
              onToggle={() => selectedSkillItemId && handleToggle(selectedSkillItemId)}
              onUninstall={() => selectedSkillItemId && handleUninstall(selectedSkillItemId)}
              isToggling={isToggling && togglingSkillItemId === selectedSkillItemId}
              isUninstalling={isUninstalling}
            />
          </div>
        </>
      )}
    </div>
  )
}
