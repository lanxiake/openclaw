/**
 * SkillStoreView Component - 技能商店视图
 *
 * 显示可安装的技能，支持浏览、搜索、筛选和安装
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  useSkillStore,
  type StoreSkillInfo,
  type SkillCategory,
  type StoreFilters
} from '../hooks/useSkillStore'
import './SkillStoreView.css'

interface SkillStoreViewProps {
  isConnected: boolean
  onInstallComplete?: () => void
}

/**
 * 订阅类型标签
 */
function getSubscriptionLabel(type: string): { label: string; className: string } {
  switch (type) {
    case 'free':
      return { label: '免费', className: 'subscription-free' }
    case 'premium':
      return { label: '高级', className: 'subscription-premium' }
    case 'enterprise':
      return { label: '企业', className: 'subscription-enterprise' }
    default:
      return { label: type, className: '' }
  }
}

/**
 * 格式化下载数量
 */
function formatDownloads(count: number): string {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}

/**
 * 技能卡片组件（商店版）
 */
const StoreSkillCard: React.FC<{
  skill: StoreSkillInfo
  onSelect: () => void
  onInstall: () => void
  isInstalling: boolean
}> = ({ skill, onSelect, onInstall, isInstalling }) => {
  const subscriptionInfo = getSubscriptionLabel(skill.subscription.type)

  /**
   * 处理安装按钮点击
   */
  const handleInstallClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onInstall()
  }

  return (
    <div className="store-skill-card" onClick={onSelect}>
      <div className="store-card-header">
        <div className="store-card-icon">{skill.icon || '🔧'}</div>
        <div className="store-card-meta">
          <span className={`subscription-badge ${subscriptionInfo.className}`}>
            {subscriptionInfo.label}
          </span>
          {skill.subscription.price && (
            <span className="price-tag">
              ¥{skill.subscription.price}/{skill.subscription.period === 'monthly' ? '月' : '年'}
            </span>
          )}
        </div>
      </div>
      <div className="store-card-content">
        <h3 className="store-skill-name">{skill.name}</h3>
        <p className="store-skill-description">{skill.description}</p>
        <div className="store-skill-stats">
          <span className="stat-item">
            <span className="stat-icon">⭐</span>
            <span className="stat-value">{skill.rating.toFixed(1)}</span>
          </span>
          <span className="stat-item">
            <span className="stat-icon">📥</span>
            <span className="stat-value">{formatDownloads(skill.downloads)}</span>
          </span>
        </div>
        <div className="store-skill-tags">
          {skill.tags.slice(0, 3).map((tag, index) => (
            <span key={index} className="tag">{tag}</span>
          ))}
        </div>
      </div>
      <div className="store-card-footer">
        {skill.installed ? (
          <button className="installed-button" disabled>
            ✓ 已安装
          </button>
        ) : (
          <button
            className="install-button"
            onClick={handleInstallClick}
            disabled={isInstalling}
          >
            {isInstalling ? '安装中...' : '安装'}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * 技能详情对话框
 */
const SkillDetailDialog: React.FC<{
  skill: StoreSkillInfo | null
  isOpen: boolean
  onClose: () => void
  onInstall: () => void
  isInstalling: boolean
}> = ({ skill, isOpen, onClose, onInstall, isInstalling }) => {
  if (!isOpen || !skill) return null

  const subscriptionInfo = getSubscriptionLabel(skill.subscription.type)

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content skill-detail-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <div className="skill-dialog-title">
            <span className="skill-dialog-icon">{skill.icon || '🔧'}</span>
            <div>
              <h3>{skill.name}</h3>
              <span className="skill-dialog-author">by {skill.author}</span>
            </div>
          </div>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <div className="dialog-body">
          <div className="skill-dialog-stats">
            <div className="stat-block">
              <span className="stat-label">评分</span>
              <span className="stat-value">⭐ {skill.rating.toFixed(1)} ({skill.ratingCount})</span>
            </div>
            <div className="stat-block">
              <span className="stat-label">下载</span>
              <span className="stat-value">📥 {formatDownloads(skill.downloads)}</span>
            </div>
            <div className="stat-block">
              <span className="stat-label">版本</span>
              <span className="stat-value">v{skill.version}</span>
            </div>
            <div className="stat-block">
              <span className="stat-label">类型</span>
              <span className={`stat-value subscription-badge ${subscriptionInfo.className}`}>
                {subscriptionInfo.label}
              </span>
            </div>
          </div>

          <div className="skill-dialog-section">
            <h4>描述</h4>
            <p>{skill.longDescription || skill.description}</p>
          </div>

          <div className="skill-dialog-section">
            <h4>标签</h4>
            <div className="skill-dialog-tags">
              {skill.tags.map((tag, index) => (
                <span key={index} className="tag">{tag}</span>
              ))}
            </div>
          </div>

          <div className="skill-dialog-section">
            <h4>运行模式</h4>
            <p>
              {skill.runMode === 'local' && '🖥️ 本地运行 - 在您的设备上执行'}
              {skill.runMode === 'server' && '☁️ 服务端运行 - 在云端执行'}
              {skill.runMode === 'hybrid' && '🔄 混合模式 - 本地与云端协作'}
            </p>
          </div>

          {skill.screenshots && skill.screenshots.length > 0 && (
            <div className="skill-dialog-section">
              <h4>截图</h4>
              <div className="skill-dialog-screenshots">
                {skill.screenshots.map((url, index) => (
                  <img key={index} src={url} alt={`截图 ${index + 1}`} />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <button className="cancel-button" onClick={onClose}>关闭</button>
          {skill.installed ? (
            <button className="installed-button" disabled>✓ 已安装</button>
          ) : (
            <button
              className="confirm-button"
              onClick={onInstall}
              disabled={isInstalling}
            >
              {isInstalling ? '安装中...' : skill.subscription.price
                ? `安装 (¥${skill.subscription.price}/${skill.subscription.period === 'monthly' ? '月' : '年'})`
                : '免费安装'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 分类侧边栏
 */
const CategorySidebar: React.FC<{
  categories: SkillCategory[]
  selectedCategory: string | null
  onSelectCategory: (category: string | null) => void
  popularTags: string[]
  onSelectTag: (tag: string) => void
}> = ({ categories, selectedCategory, onSelectCategory, popularTags, onSelectTag }) => {
  return (
    <div className="store-sidebar">
      <div className="sidebar-section">
        <h3>分类</h3>
        <ul className="category-list">
          {categories.map(category => (
            <li
              key={category.id}
              className={`category-item ${selectedCategory === category.id || (category.id === 'all' && !selectedCategory) ? 'selected' : ''}`}
              onClick={() => onSelectCategory(category.id === 'all' ? null : category.id)}
            >
              <span className="category-icon">{category.icon}</span>
              <span className="category-name">{category.name}</span>
              <span className="category-count">{category.count}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-section">
        <h3>热门标签</h3>
        <div className="popular-tags">
          {popularTags.map((tag, index) => (
            <button
              key={index}
              className="tag-button"
              onClick={() => onSelectTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * 技能商店视图
 */
export const SkillStoreView: React.FC<SkillStoreViewProps> = ({
  isConnected,
  onInstallComplete
}) => {
  const {
    skills,
    featured,
    popular,
    stats,
    isLoading,
    error,
    filters,
    loadStoreSkills,
    loadFeatured,
    loadPopular,
    loadStats,
    searchSkills,
    setFilters,
    getSkillDetail,
    installSkill,
  } = useSkillStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('downloads')
  const [selectedSkill, setSelectedSkill] = useState<StoreSkillInfo | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [installingSkillId, setInstallingSkillId] = useState<string | null>(null)
  const [installResult, setInstallResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  /**
   * 初始加载
   */
  useEffect(() => {
    if (isConnected) {
      loadStoreSkills()
      loadFeatured()
      loadPopular()
      loadStats()
    }
  }, [isConnected, loadStoreSkills, loadFeatured, loadPopular, loadStats])

  /**
   * 处理搜索
   */
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    searchSkills(searchQuery)
  }, [searchQuery, searchSkills])

  /**
   * 处理分类选择
   */
  const handleCategorySelect = useCallback((category: string | null) => {
    setSelectedCategory(category)
    loadStoreSkills({
      ...filters,
      category: category || undefined,
    })
  }, [filters, loadStoreSkills])

  /**
   * 处理标签点击
   */
  const handleTagClick = useCallback((tag: string) => {
    setSearchQuery(tag)
    searchSkills(tag)
  }, [searchSkills])

  /**
   * 处理订阅筛选
   */
  const handleSubscriptionFilter = useCallback((value: string) => {
    setSubscriptionFilter(value)
    loadStoreSkills({
      ...filters,
      subscription: value as StoreFilters['subscription'],
    })
  }, [filters, loadStoreSkills])

  /**
   * 处理排序
   */
  const handleSortChange = useCallback((value: string) => {
    setSortBy(value)
    loadStoreSkills({
      ...filters,
      sortBy: value as StoreFilters['sortBy'],
    })
  }, [filters, loadStoreSkills])

  /**
   * 处理技能选择
   */
  const handleSkillSelect = useCallback(async (skill: StoreSkillInfo) => {
    const detail = await getSkillDetail(skill.id)
    if (detail) {
      setSelectedSkill(detail)
      setShowDetailDialog(true)
    }
  }, [getSkillDetail])

  /**
   * 处理安装
   */
  const handleInstall = useCallback(async (skillId: string) => {
    setInstallingSkillId(skillId)
    setInstallResult(null)

    try {
      const result = await installSkill(skillId)
      if (result.success) {
        setInstallResult({
          success: true,
          message: '技能安装成功！',
        })
        // 刷新列表
        loadStoreSkills(filters)
        onInstallComplete?.()
      } else {
        setInstallResult({
          success: false,
          message: result.error || '安装失败',
        })
      }
    } catch (err) {
      setInstallResult({
        success: false,
        message: err instanceof Error ? err.message : '安装失败',
      })
    } finally {
      setInstallingSkillId(null)
    }
  }, [installSkill, loadStoreSkills, filters, onInstallComplete])

  if (!isConnected) {
    return (
      <div className="skill-store-view disconnected">
        <div className="disconnected-message">
          <span className="icon">🔌</span>
          <p>请先连接 Gateway 以访问技能商店</p>
        </div>
      </div>
    )
  }

  return (
    <div className="skill-store-view">
      {/* 顶部搜索和筛选 */}
      <div className="store-header">
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            className="search-input"
            placeholder="搜索技能..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="search-button">🔍</button>
        </form>
        <div className="filter-controls">
          <select
            className="filter-select"
            value={subscriptionFilter}
            onChange={e => handleSubscriptionFilter(e.target.value)}
          >
            <option value="all">全部类型</option>
            <option value="free">免费</option>
            <option value="premium">高级</option>
          </select>
          <select
            className="filter-select"
            value={sortBy}
            onChange={e => handleSortChange(e.target.value)}
          >
            <option value="downloads">按下载量</option>
            <option value="rating">按评分</option>
            <option value="updated">按更新时间</option>
            <option value="name">按名称</option>
          </select>
        </div>
      </div>

      {/* 安装结果提示 */}
      {installResult && (
        <div className={`result-banner ${installResult.success ? 'success' : 'error'}`}>
          <span>{installResult.success ? '✅' : '❌'} {installResult.message}</span>
          <button onClick={() => setInstallResult(null)}>✕</button>
        </div>
      )}

      {/* 主内容区 */}
      <div className="store-content">
        {/* 侧边栏 */}
        {stats && (
          <CategorySidebar
            categories={stats.categories}
            selectedCategory={selectedCategory}
            onSelectCategory={handleCategorySelect}
            popularTags={stats.popularTags}
            onSelectTag={handleTagClick}
          />
        )}

        {/* 技能列表 */}
        <div className="store-main">
          {/* 推荐技能 */}
          {!searchQuery && !selectedCategory && featured.length > 0 && (
            <section className="store-section">
              <h2 className="section-title">⭐ 推荐技能</h2>
              <div className="skill-grid featured-grid">
                {featured.map(skill => (
                  <StoreSkillCard
                    key={skill.id}
                    skill={skill}
                    onSelect={() => handleSkillSelect(skill)}
                    onInstall={() => handleInstall(skill.id)}
                    isInstalling={installingSkillId === skill.id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 热门技能 */}
          {!searchQuery && !selectedCategory && popular.length > 0 && (
            <section className="store-section">
              <h2 className="section-title">🔥 热门技能</h2>
              <div className="skill-grid">
                {popular.map(skill => (
                  <StoreSkillCard
                    key={skill.id}
                    skill={skill}
                    onSelect={() => handleSkillSelect(skill)}
                    onInstall={() => handleInstall(skill.id)}
                    isInstalling={installingSkillId === skill.id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 所有技能 / 搜索结果 */}
          <section className="store-section">
            <h2 className="section-title">
              {searchQuery
                ? `搜索结果: "${searchQuery}"`
                : selectedCategory
                  ? stats?.categories.find(c => c.id === selectedCategory)?.name || '技能'
                  : '全部技能'}
              <span className="count">({skills.length})</span>
            </h2>
            {isLoading ? (
              <div className="loading-state">
                <span className="spinner">⏳</span>
                <p>加载中...</p>
              </div>
            ) : skills.length === 0 ? (
              <div className="empty-state">
                <span className="icon">📭</span>
                <p>没有找到匹配的技能</p>
              </div>
            ) : (
              <div className="skill-grid">
                {skills.map(skill => (
                  <StoreSkillCard
                    key={skill.id}
                    skill={skill}
                    onSelect={() => handleSkillSelect(skill)}
                    onInstall={() => handleInstall(skill.id)}
                    isInstalling={installingSkillId === skill.id}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* 技能详情对话框 */}
      <SkillDetailDialog
        skill={selectedSkill}
        isOpen={showDetailDialog}
        onClose={() => setShowDetailDialog(false)}
        onInstall={() => selectedSkill && handleInstall(selectedSkill.id)}
        isInstalling={selectedSkill ? installingSkillId === selectedSkill.id : false}
      />
    </div>
  )
}
