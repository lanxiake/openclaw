/**
 * FilesView Component - 工作空间视图
 *
 * 以工作空间目录为根的文件浏览器，支持导航、搜索、文件操作。
 * 与 Gateway 工作空间概念对齐：展示 skills/、配置文件、sandbox 等结构。
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useFileManager, formatFileSize, type FileItem, type FileSortBy } from '../hooks/useFileManager'
import { useWorkspace, type WorkspaceLocation } from '../hooks/useWorkspace'
import './FilesView.css'

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 文件列表项组件
 */
const FileListItem: React.FC<{
  file: FileItem
  isSelected: boolean
  onSelect: () => void
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}> = ({ file, isSelected, onSelect, onDoubleClick, onContextMenu }) => {
  return (
    <div
      className={`file-item ${isSelected ? 'selected' : ''} ${file.isDirectory ? 'directory' : ''}`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div className="file-icon">{file.icon}</div>
      <div className="file-info">
        <span className="file-name">{file.name}</span>
        <div className="file-meta">
          {!file.isDirectory && <span className="file-size">{formatFileSize(file.size)}</span>}
          <span className="file-date">{formatDate(file.modifiedAt)}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * 新建文件夹对话框
 */
const NewFolderDialog: React.FC<{
  onConfirm: (name: string) => void
  onCancel: () => void
}> = ({ onConfirm, onCancel }) => {
  const [folderName, setFolderName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (folderName.trim()) {
      onConfirm(folderName.trim())
    }
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>新建文件夹</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="文件夹名称"
            autoFocus
          />
          <div className="dialog-actions">
            <button type="button" className="btn-cancel" onClick={onCancel}>
              取消
            </button>
            <button type="submit" className="btn-confirm" disabled={!folderName.trim()}>
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * 重命名对话框
 */
const RenameDialog: React.FC<{
  currentName: string
  onConfirm: (newName: string) => void
  onCancel: () => void
}> = ({ currentName, onConfirm, onCancel }) => {
  const [newName, setNewName] = useState(currentName)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newName.trim() && newName !== currentName) {
      onConfirm(newName.trim())
    }
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>重命名</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新名称"
            autoFocus
          />
          <div className="dialog-actions">
            <button type="button" className="btn-cancel" onClick={onCancel}>
              取消
            </button>
            <button
              type="submit"
              className="btn-confirm"
              disabled={!newName.trim() || newName === currentName}
            >
              确定
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * 工作空间视图
 */
export const FilesView: React.FC = () => {
  // 工作空间管理
  const {
    workspaceDir,
    isInitializing,
    initError,
    locations,
    toRelativePath,
    toAbsolutePath,
  } = useWorkspace()

  // 文件管理，以工作空间为根
  const {
    currentPath,
    files,
    isLoading,
    error,
    selectedFiles,
    sortBy,
    sortOrder,
    historyIndex,
    history,
    navigateTo,
    refresh,
    goUp,
    goBack,
    goForward,
    toggleSelect,
    selectAll,
    clearSelection,
    setSorting,
    createFolder,
    deleteSelected,
    renameFile,
  } = useFileManager(
    workspaceDir
      ? { initialPath: workspaceDir, rootPath: workspaceDir }
      : undefined
  )

  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    file: FileItem | null
  } | null>(null)

  /**
   * 处理文件双击
   */
  const handleFileDoubleClick = useCallback(
    (file: FileItem) => {
      if (file.isDirectory) {
        navigateTo(file.path)
      } else {
        // 打开文件 (使用系统默认程序)
        console.log('[FilesView] 打开文件:', file.path)
        window.electronAPI.app.openExternal(file.path)
      }
    },
    [navigateTo]
  )

  /**
   * 处理右键菜单
   */
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: FileItem | null) => {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY, file })
    },
    []
  )

  /**
   * 关闭右键菜单
   */
  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  /**
   * 处理工作空间快捷位置点击
   */
  const handleLocationClick = useCallback(
    (location: WorkspaceLocation) => {
      const targetPath = toAbsolutePath(location.relativePath)
      if (location.group === 'config') {
        // 配置文件用系统默认编辑器打开
        window.electronAPI.app.openExternal(targetPath)
      } else {
        // 目录则导航
        navigateTo(targetPath)
      }
    },
    [toAbsolutePath, navigateTo]
  )

  /**
   * 处理地址栏回车
   */
  const handlePathSubmit = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const input = e.target as HTMLInputElement
        const absolute = toAbsolutePath(input.value)
        navigateTo(absolute)
      }
    },
    [navigateTo, toAbsolutePath]
  )

  /**
   * 处理新建文件夹
   */
  const handleCreateFolder = useCallback(
    async (name: string) => {
      try {
        await createFolder(name)
        setShowNewFolderDialog(false)
      } catch (err) {
        alert(err instanceof Error ? err.message : '创建失败')
      }
    },
    [createFolder]
  )

  /**
   * 处理删除
   */
  const handleDelete = useCallback(async () => {
    if (selectedFiles.size === 0) return

    const confirmed = window.confirm(`确定要删除 ${selectedFiles.size} 个文件/文件夹吗？`)
    if (confirmed) {
      try {
        await deleteSelected()
      } catch (err) {
        alert(err instanceof Error ? err.message : '删除失败')
      }
    }
  }, [selectedFiles, deleteSelected])

  /**
   * 处理重命名
   */
  const handleRename = useCallback(
    async (newName: string) => {
      if (!renameTarget) return

      try {
        await renameFile(renameTarget.path, newName)
        setRenameTarget(null)
      } catch (err) {
        alert(err instanceof Error ? err.message : '重命名失败')
      }
    },
    [renameTarget, renameFile]
  )

  /**
   * 点击背景时关闭右键菜单
   */
  useEffect(() => {
    const handleClick = () => closeContextMenu()
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [closeContextMenu])

  /**
   * 键盘快捷键
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault()
        selectAll()
      }
      if (e.key === 'Delete' && selectedFiles.size > 0) {
        handleDelete()
      }
      if (e.key === 'F2' && selectedFiles.size === 1) {
        const filePath = Array.from(selectedFiles)[0]
        const file = files.find((f) => f.path === filePath)
        if (file) setRenameTarget(file)
      }
      if (e.key === 'Escape') {
        clearSelection()
        setContextMenu(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectAll, clearSelection, selectedFiles, files, handleDelete])

  // 工作空间初始化中
  if (isInitializing) {
    return (
      <div className="files-view">
        <div className="workspace-loading">
          <span className="spinner">⏳</span>
          <p>初始化工作空间...</p>
        </div>
      </div>
    )
  }

  // 工作空间初始化失败
  if (initError) {
    return (
      <div className="files-view">
        <div className="workspace-error">
          <span className="icon">❌</span>
          <p>工作空间初始化失败: {initError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="files-view">
      {/* 工具栏 */}
      <div className="files-toolbar">
        <div className="toolbar-navigation">
          <button
            className="nav-btn"
            onClick={goBack}
            disabled={historyIndex <= 0}
            title="后退"
          >
            ←
          </button>
          <button
            className="nav-btn"
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            title="前进"
          >
            →
          </button>
          <button className="nav-btn" onClick={goUp} title="上一级">
            ↑
          </button>
          <button className="nav-btn" onClick={refresh} disabled={isLoading} title="刷新">
            {isLoading ? '⏳' : '🔄'}
          </button>
        </div>

        <div className="path-bar">
          <span className="path-prefix">workspace://</span>
          <input
            type="text"
            value={toRelativePath(currentPath)}
            onChange={() => {}}
            onKeyDown={handlePathSubmit}
            placeholder="路径..."
          />
        </div>

        <div className="toolbar-actions">
          <button
            className="action-btn"
            onClick={() => setShowNewFolderDialog(true)}
            title="新建文件夹"
          >
            📁+
          </button>
          <button
            className="action-btn"
            onClick={handleDelete}
            disabled={selectedFiles.size === 0}
            title="删除"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="files-content">
        {/* 侧边栏 - 工作空间导航 */}
        <div className="files-sidebar">
          <h4>工作空间</h4>
          <nav className="quick-locations">
            {locations
              .filter((loc) => loc.group === 'root')
              .map((loc) => (
                <button
                  key={loc.id}
                  className={`quick-location-item ${currentPath === toAbsolutePath(loc.relativePath) ? 'active' : ''}`}
                  onClick={() => handleLocationClick(loc)}
                >
                  <span className="loc-icon">{loc.icon}</span>
                  <span className="loc-label">{loc.label}</span>
                </button>
              ))}
          </nav>

          <h4>配置文件</h4>
          <nav className="quick-locations">
            {locations
              .filter((loc) => loc.group === 'config')
              .map((loc) => (
                <button
                  key={loc.id}
                  className="quick-location-item"
                  onClick={() => handleLocationClick(loc)}
                >
                  <span className="loc-icon">{loc.icon}</span>
                  <span className="loc-label">{loc.label}</span>
                </button>
              ))}
          </nav>

          <h4>目录</h4>
          <nav className="quick-locations">
            {locations
              .filter((loc) => loc.group === 'directories')
              .map((loc) => (
                <button
                  key={loc.id}
                  className={`quick-location-item ${currentPath === toAbsolutePath(loc.relativePath) ? 'active' : ''}`}
                  onClick={() => handleLocationClick(loc)}
                >
                  <span className="loc-icon">{loc.icon}</span>
                  <span className="loc-label">{loc.label}</span>
                </button>
              ))}
          </nav>

          {selectedFiles.size > 0 && (
            <div className="selection-info">
              <span>已选择 {selectedFiles.size} 项</span>
              <button onClick={clearSelection}>取消选择</button>
            </div>
          )}
        </div>

        {/* 文件列表 */}
        <div className="files-list-container">
          {/* 排序栏 */}
          <div className="files-header">
            <button
              className={`sort-btn ${sortBy === 'name' ? 'active' : ''}`}
              onClick={() => setSorting('name')}
            >
              名称 {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              className={`sort-btn ${sortBy === 'size' ? 'active' : ''}`}
              onClick={() => setSorting('size')}
            >
              大小 {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              className={`sort-btn ${sortBy === 'date' ? 'active' : ''}`}
              onClick={() => setSorting('date')}
            >
              修改日期 {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="error-banner">
              <span>❌ {error}</span>
              <button onClick={refresh}>重试</button>
            </div>
          )}

          {/* 文件列表 */}
          <div
            className="files-list"
            onContextMenu={(e) => handleContextMenu(e, null)}
          >
            {isLoading && files.length === 0 ? (
              <div className="loading-state">
                <span className="spinner">⏳</span>
                <p>加载中...</p>
              </div>
            ) : files.length === 0 ? (
              <div className="empty-state">
                <span className="icon">📂</span>
                <p>文件夹为空</p>
              </div>
            ) : (
              files.map((file) => (
                <FileListItem
                  key={file.path}
                  file={file}
                  isSelected={selectedFiles.has(file.path)}
                  onSelect={() => toggleSelect(file.path)}
                  onDoubleClick={() => handleFileDoubleClick(file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                />
              ))
            )}
          </div>

          {/* 状态栏 */}
          <div className="files-statusbar">
            <span>{files.length} 个项目</span>
            {selectedFiles.size > 0 && <span>已选择 {selectedFiles.size} 项</span>}
          </div>
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.file ? (
            <>
              <button
                onClick={() => {
                  if (contextMenu.file?.isDirectory) {
                    navigateTo(contextMenu.file.path)
                  } else {
                    window.electronAPI.app.openExternal(contextMenu.file!.path)
                  }
                  closeContextMenu()
                }}
              >
                {contextMenu.file.isDirectory ? '打开' : '打开文件'}
              </button>
              <button
                onClick={() => {
                  setRenameTarget(contextMenu.file)
                  closeContextMenu()
                }}
              >
                重命名
              </button>
              <hr />
              <button
                onClick={() => {
                  if (!selectedFiles.has(contextMenu.file!.path)) {
                    toggleSelect(contextMenu.file!.path)
                  }
                  handleDelete()
                  closeContextMenu()
                }}
                className="danger"
              >
                删除
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setShowNewFolderDialog(true)
                  closeContextMenu()
                }}
              >
                新建文件夹
              </button>
              <button
                onClick={() => {
                  refresh()
                  closeContextMenu()
                }}
              >
                刷新
              </button>
              <hr />
              <button
                onClick={() => {
                  selectAll()
                  closeContextMenu()
                }}
              >
                全选
              </button>
            </>
          )}
        </div>
      )}

      {/* 新建文件夹对话框 */}
      {showNewFolderDialog && (
        <NewFolderDialog
          onConfirm={handleCreateFolder}
          onCancel={() => setShowNewFolderDialog(false)}
        />
      )}

      {/* 重命名对话框 */}
      {renameTarget && (
        <RenameDialog
          currentName={renameTarget.name}
          onConfirm={handleRename}
          onCancel={() => setRenameTarget(null)}
        />
      )}
    </div>
  )
}
