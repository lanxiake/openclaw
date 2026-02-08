/**
 * SkillUploadView Component - 技能上传视图
 *
 * 提供技能上传表单和提交功能
 */

import React, { useState, useCallback, useEffect } from 'react'
import {
  useSkillStore,
  type SkillUploadData,
  type SkillCategory
} from '../hooks/useSkillStore'
import './SkillUploadView.css'

interface SkillUploadViewProps {
  isConnected: boolean
  onUploadComplete?: () => void
  onCancel?: () => void
}

/**
 * 技能上传视图
 */
export const SkillUploadView: React.FC<SkillUploadViewProps> = ({
  isConnected,
  onUploadComplete,
  onCancel
}) => {
  const {
    categories,
    isUploading,
    error,
    loadCategories,
    uploadSkill
  } = useSkillStore()

  // 表单状态
  const [formData, setFormData] = useState<SkillUploadData>({
    name: '',
    description: '',
    readme: '',
    version: '1.0.0',
    categoryId: '',
    tags: [],
    subscriptionLevel: 'free',
    iconUrl: '',
    manifestUrl: '',
    packageUrl: '',
    config: {}
  })

  const [tagInput, setTagInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<{
    success: boolean
    message: string
    skillId?: string
  } | null>(null)

  /**
   * 加载分类列表
   */
  useEffect(() => {
    if (isConnected) {
      loadCategories()
    }
  }, [isConnected, loadCategories])

  /**
   * 处理输入变化
   */
  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setFormError(null)
  }, [])

  /**
   * 添加标签
   */
  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim()
    if (tag && formData.tags && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tag]
      }))
      setTagInput('')
    }
  }, [tagInput, formData.tags])

  /**
   * 删除标签
   */
  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: (prev.tags || []).filter(tag => tag !== tagToRemove)
    }))
  }, [])

  /**
   * 处理标签输入回车
   */
  const handleTagKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }, [handleAddTag])

  /**
   * 表单验证
   */
  const validateForm = useCallback((): boolean => {
    if (!formData.name.trim()) {
      setFormError('请输入技能名称')
      return false
    }

    if (!formData.description.trim()) {
      setFormError('请输入技能描述')
      return false
    }

    if (!formData.version.trim()) {
      setFormError('请输入版本号')
      return false
    }

    // 版本号格式验证
    const versionRegex = /^\d+\.\d+\.\d+$/
    if (!versionRegex.test(formData.version)) {
      setFormError('版本号格式错误，请使用 x.y.z 格式')
      return false
    }

    return true
  }, [formData])

  /**
   * 提交表单
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setUploadResult(null)

    if (!validateForm()) {
      return
    }

    console.log('[SkillUploadView] 提交技能:', formData)

    const result = await uploadSkill(formData)

    if (result.success) {
      setUploadResult({
        success: true,
        message: '技能上传成功！等待审核通过后将显示在商店中。',
        skillId: result.skillId
      })
      // 重置表单
      setFormData({
        name: '',
        description: '',
        readme: '',
        version: '1.0.0',
        categoryId: '',
        tags: [],
        subscriptionLevel: 'free',
        iconUrl: '',
        manifestUrl: '',
        packageUrl: '',
        config: {}
      })
      onUploadComplete?.()
    } else {
      setUploadResult({
        success: false,
        message: result.error || '上传失败，请稍后重试'
      })
    }
  }, [formData, validateForm, uploadSkill, onUploadComplete])

  if (!isConnected) {
    return (
      <div className="skill-upload-view disconnected">
        <div className="disconnected-message">
          <span className="icon">🔌</span>
          <p>请先连接 Gateway 以上传技能</p>
        </div>
      </div>
    )
  }

  return (
    <div className="skill-upload-view">
      <div className="upload-header">
        <h2>上传技能</h2>
        <p className="upload-subtitle">分享您的技能到商店，让更多人使用</p>
      </div>

      {/* 结果提示 */}
      {uploadResult && (
        <div className={`result-banner ${uploadResult.success ? 'success' : 'error'}`}>
          <span>{uploadResult.success ? '✅' : '❌'} {uploadResult.message}</span>
          <button onClick={() => setUploadResult(null)}>✕</button>
        </div>
      )}

      <form className="upload-form" onSubmit={handleSubmit}>
        {/* 基本信息 */}
        <section className="form-section">
          <h3>基本信息</h3>

          <div className="form-group">
            <label className="form-label" htmlFor="name">
              技能名称 <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              className="form-input"
              placeholder="输入技能名称"
              value={formData.name}
              onChange={handleInputChange}
              disabled={isUploading}
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">
              简短描述 <span className="required">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              className="form-textarea"
              placeholder="简要描述技能的功能和用途"
              value={formData.description}
              onChange={handleInputChange}
              disabled={isUploading}
              rows={3}
              maxLength={500}
            />
            <span className="char-count">{formData.description.length}/500</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="readme">
              详细说明
            </label>
            <textarea
              id="readme"
              name="readme"
              className="form-textarea readme-input"
              placeholder="使用 Markdown 格式详细说明技能的使用方法、参数配置等"
              value={formData.readme}
              onChange={handleInputChange}
              disabled={isUploading}
              rows={8}
            />
          </div>
        </section>

        {/* 版本和分类 */}
        <section className="form-section">
          <h3>版本和分类</h3>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="version">
                版本号 <span className="required">*</span>
              </label>
              <input
                type="text"
                id="version"
                name="version"
                className="form-input"
                placeholder="1.0.0"
                value={formData.version}
                onChange={handleInputChange}
                disabled={isUploading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="categoryId">
                分类
              </label>
              <select
                id="categoryId"
                name="categoryId"
                className="form-select"
                value={formData.categoryId}
                onChange={handleInputChange}
                disabled={isUploading}
              >
                <option value="">选择分类</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="subscriptionLevel">
                订阅级别
              </label>
              <select
                id="subscriptionLevel"
                name="subscriptionLevel"
                className="form-select"
                value={formData.subscriptionLevel}
                onChange={handleInputChange}
                disabled={isUploading}
              >
                <option value="free">免费</option>
                <option value="pro">Pro</option>
                <option value="team">团队</option>
                <option value="enterprise">企业</option>
              </select>
            </div>
          </div>
        </section>

        {/* 标签 */}
        <section className="form-section">
          <h3>标签</h3>

          <div className="form-group">
            <div className="tag-input-group">
              <input
                type="text"
                className="form-input tag-input"
                placeholder="输入标签后按回车添加"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                disabled={isUploading}
              />
              <button
                type="button"
                className="add-tag-button"
                onClick={handleAddTag}
                disabled={isUploading || !tagInput.trim()}
              >
                添加
              </button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="tag-list">
                {formData.tags.map((tag, index) => (
                  <span key={index} className="tag">
                    {tag}
                    <button
                      type="button"
                      className="remove-tag"
                      onClick={() => handleRemoveTag(tag)}
                      disabled={isUploading}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 资源链接 */}
        <section className="form-section">
          <h3>资源链接</h3>

          <div className="form-group">
            <label className="form-label" htmlFor="iconUrl">
              图标 URL
            </label>
            <input
              type="url"
              id="iconUrl"
              name="iconUrl"
              className="form-input"
              placeholder="https://example.com/icon.png"
              value={formData.iconUrl}
              onChange={handleInputChange}
              disabled={isUploading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="manifestUrl">
              配置文件 URL
            </label>
            <input
              type="url"
              id="manifestUrl"
              name="manifestUrl"
              className="form-input"
              placeholder="https://example.com/skill.json"
              value={formData.manifestUrl}
              onChange={handleInputChange}
              disabled={isUploading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="packageUrl">
              技能包 URL
            </label>
            <input
              type="url"
              id="packageUrl"
              name="packageUrl"
              className="form-input"
              placeholder="https://example.com/skill.zip"
              value={formData.packageUrl}
              onChange={handleInputChange}
              disabled={isUploading}
            />
          </div>
        </section>

        {/* 错误提示 */}
        {(formError || error) && (
          <div className="error-message">
            {formError || error}
          </div>
        )}

        {/* 提交按钮 */}
        <div className="form-actions">
          {onCancel && (
            <button
              type="button"
              className="cancel-button"
              onClick={onCancel}
              disabled={isUploading}
            >
              取消
            </button>
          )}
          <button
            type="submit"
            className="submit-button"
            disabled={isUploading}
          >
            {isUploading ? '上传中...' : '提交审核'}
          </button>
        </div>
      </form>
    </div>
  )
}
