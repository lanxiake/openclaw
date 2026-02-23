/**
 * DeviceManagementView Component - 设备管理视图
 *
 * 用于管理用户的设备绑定、查看设备列表、配对新设备
 * 融合两套数据源：
 * - REST API (deviceService): 持久化绑定信息（isPrimary, alias, linkedAt）
 * - api.listNodes (IPC → Gateway WS): 实时连接信息（connected, remoteIp, version）
 *
 * 功能：
 * - 设备列表（在线/离线状态）
 * - 绑定新设备
 * - 修改设备别名
 * - 设备 Token 获取与连接网关
 * - 设备配额展示
 * - 删除/解绑设备
 */

import React, { useState, useEffect, useCallback } from 'react'
import { deviceService, type Device } from '../services/device-service'
import './DeviceManagementView.css'

/**
 * Gateway 节点信息（来自 node.list RPC）
 */
interface NodeInfo {
  nodeId: string
  displayName?: string
  platform?: string
  version?: string
  connected: boolean
  paired: boolean
  remoteIp?: string
  connectedAtMs?: number
}

/**
 * 设备配额信息
 */
interface DeviceQuota {
  /** 最大允许设备数 */
  max: number
  /** 已使用设备数 */
  used: number
  /** 剩余可绑定数 */
  remaining: number
}

/**
 * 合并后的设备视图模型
 */
interface MergedDevice extends Device {
  /** 是否在线（来自 Gateway node.list） */
  isOnline: boolean
  /** IP 地址（来自 Gateway node.list） */
  remoteIp?: string
  /** 客户端版本（来自 Gateway node.list） */
  version?: string
  /** 连接时间戳（来自 Gateway node.list） */
  connectedAtMs?: number
}

interface DeviceManagementViewProps {
  accessToken: string | null
  onClose?: () => void
  onDevicePaired?: (deviceToken: string) => void
}

/**
 * 将 REST 设备列表与 Gateway 节点列表合并
 */
function mergeDeviceData(devices: Device[], nodes: NodeInfo[]): MergedDevice[] {
  return devices.map((device) => {
    const matchedNode = nodes.find(
      (n) => n.nodeId === device.deviceId || n.displayName === device.displayName
    )
    return {
      ...device,
      isOnline: matchedNode?.connected ?? false,
      remoteIp: matchedNode?.remoteIp,
      version: matchedNode?.version,
      connectedAtMs: matchedNode?.connectedAtMs,
    }
  })
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

/**
 * 获取平台图标
 */
function getPlatformIcon(platform?: string): string {
  switch (platform) {
    case 'windows':
      return '🖥️'
    case 'macos':
    case 'darwin':
      return '💻'
    case 'linux':
      return '🐧'
    case 'ios':
      return '📱'
    case 'android':
      return '📱'
    default:
      return '📟'
  }
}

/**
 * 设备管理视图组件
 */
export const DeviceManagementView: React.FC<DeviceManagementViewProps> = ({
  accessToken,
  onClose,
  onDevicePaired,
}) => {
  const [devices, setDevices] = useState<MergedDevice[]>([])
  const [quota, setQuota] = useState<DeviceQuota | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPairDialog, setShowPairDialog] = useState(false)
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'requesting' | 'waiting' | 'success' | 'error'>('idle')
  const [pairingError, setPairingError] = useState<string | null>(null)

  /** 正在编辑别名的设备 ID */
  const [editingAliasDeviceId, setEditingAliasDeviceId] = useState<string | null>(null)
  /** 编辑中的别名值 */
  const [editingAliasValue, setEditingAliasValue] = useState('')
  /** 操作中的设备 ID（防止重复点击） */
  const [operatingDeviceId, setOperatingDeviceId] = useState<string | null>(null)

  /**
   * 加载 Gateway 节点列表（实时连接信息，通过 IPC → Gateway WS）
   */
  const loadNodes = useCallback(async (): Promise<NodeInfo[]> => {
    try {
      const result = await window.electronAPI.api.listNodes() as {
        success: boolean
        data?: { nodes?: NodeInfo[] }
      }
      const nodes: NodeInfo[] = result?.data?.nodes || []
      console.log('[DeviceManagementView] Gateway 节点列表:', nodes.length, '个')
      return nodes
    } catch (err) {
      console.warn('[DeviceManagementView] 获取 Gateway 节点列表失败（可能未连接）:', err)
      return []
    }
  }, [])

  /**
   * 加载设备配额信息（通过 Gateway RPC device.quota）
   */
  const loadQuota = useCallback(async (): Promise<DeviceQuota | null> => {
    try {
      const result = await window.electronAPI.gateway.call<{
        success: boolean
        quota?: {
          currentCount: number
          maxDevices: number
          canLinkMore: boolean
        }
      }>('device.quota')
      if (result?.success && result.quota) {
        const mapped: DeviceQuota = {
          max: result.quota.maxDevices,
          used: result.quota.currentCount,
          remaining: result.quota.maxDevices - result.quota.currentCount,
        }
        console.log('[DeviceManagementView] 设备配额:', mapped)
        return mapped
      }
      return null
    } catch (err) {
      console.warn('[DeviceManagementView] 获取设备配额失败:', err)
      return null
    }
  }, [])

  /**
   * 加载设备列表（融合 REST + Gateway 数据）
   */
  const loadDevices = useCallback(async () => {
    if (!accessToken) {
      console.warn('[DeviceManagementView] accessToken为空,无法加载设备列表')
      setError('未登录或登录已过期')
      setIsLoading(false)
      return
    }

    console.log('[DeviceManagementView] 加载设备列表')
    setIsLoading(true)
    setError(null)

    deviceService.setAccessToken(accessToken)
    const [deviceResult, nodes, quotaResult] = await Promise.all([
      deviceService.getDevices(),
      loadNodes(),
      loadQuota(),
    ])

    if (deviceResult.success && deviceResult.devices) {
      const merged = mergeDeviceData(deviceResult.devices, nodes)
      setDevices(merged)
      console.log('[DeviceManagementView] 设备列表加载成功，合并后', merged.length, '个设备')
    } else {
      setError(deviceResult.error || '加载失败')
      console.error('[DeviceManagementView] 设备列表加载失败', deviceResult.error)
    }

    if (quotaResult) {
      setQuota(quotaResult)
    }

    setIsLoading(false)
  }, [accessToken, loadNodes, loadQuota])

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadDevices()
  }, [accessToken])

  /**
   * 发起设备配对
   */
  const handlePairDevice = async () => {
    if (!accessToken) {
      setPairingError('未登录')
      return
    }

    console.log('[DeviceManagementView] 发起设备配对')
    setPairingStatus('requesting')
    setPairingError(null)

    const deviceId = `windows-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const publicKey = `pk-${Math.random().toString(36).substring(2)}`

    deviceService.setAccessToken(accessToken)
    const result = await deviceService.requestPairing({
      deviceId,
      publicKey,
      displayName: 'Windows Desktop',
      platform: 'windows',
    })

    if (result.success && result.request) {
      setPairingStatus('waiting')
      console.log('[DeviceManagementView] 配对请求已发送', result.request.requestId)

      setTimeout(async () => {
        const approveResult = await deviceService.approvePairing(result.request!.requestId)
        if (approveResult.success && approveResult.result) {
          console.log('[DeviceManagementView] 设备配对成功', approveResult.result)

          if (approveResult.result.deviceToken) {
            localStorage.setItem('device_token', approveResult.result.deviceToken)
            localStorage.setItem('device_id', approveResult.result.device.deviceId)

            if (onDevicePaired) {
              onDevicePaired(approveResult.result.deviceToken)
            }
          }

          setPairingStatus('success')
          setShowPairDialog(false)
          await loadDevices()
        } else {
          setPairingError(approveResult.error || '配对失败')
          setPairingStatus('error')
        }
      }, 1000)
    } else {
      setPairingError(result.error || '请求失败')
      setPairingStatus('error')
    }
  }

  /**
   * 删除设备（撤销绑定）
   */
  const handleDeleteDevice = async (deviceId: string) => {
    if (!window.confirm('确定要删除此设备吗？删除后该设备的所有令牌将被撤销。')) {
      return
    }

    console.log('[DeviceManagementView] 删除设备', deviceId)

    if (!accessToken) {
      alert('未登录')
      return
    }

    setOperatingDeviceId(deviceId)
    deviceService.setAccessToken(accessToken)
    const result = await deviceService.deleteDevice(deviceId)

    if (result.success) {
      console.log('[DeviceManagementView] 设备删除成功')

      // 如果删除的是当前设备，清除本地 token 并断开 Gateway 连接
      const storedDeviceId = localStorage.getItem('device_id')
      if (storedDeviceId === deviceId) {
        localStorage.removeItem('device_token')
        localStorage.removeItem('device_id')
        console.log('[DeviceManagementView] 当前设备已删除，清除本地 token 并断开连接')

        try {
          await window.electronAPI.gateway.disconnect()
          console.log('[DeviceManagementView] Gateway 连接已断开')
        } catch (disconnectErr) {
          console.warn('[DeviceManagementView] 断开 Gateway 连接失败:', disconnectErr)
        }
      }

      await loadDevices()
    } else {
      console.error('[DeviceManagementView] 设备删除失败', result.error)
      alert(`删除失败: ${result.error}`)
    }

    setOperatingDeviceId(null)
  }

  /**
   * 设置主设备
   */
  const handleSetPrimary = async (deviceId: string) => {
    console.log('[DeviceManagementView] 设置主设备', deviceId)

    if (!accessToken) {
      alert('未登录')
      return
    }

    setOperatingDeviceId(deviceId)
    deviceService.setAccessToken(accessToken)
    const result = await deviceService.updateDevice(deviceId, { isPrimary: true })

    if (result.success) {
      console.log('[DeviceManagementView] 主设备设置成功')
      await loadDevices()
    } else {
      console.error('[DeviceManagementView] 主设备设置失败', result.error)
      alert(`设置失败: ${result.error}`)
    }

    setOperatingDeviceId(null)
  }

  /**
   * 开始编辑设备别名
   */
  const handleStartEditAlias = (device: MergedDevice) => {
    setEditingAliasDeviceId(device.deviceId)
    setEditingAliasValue(device.alias || device.displayName || '')
  }

  /**
   * 保存设备别名
   */
  const handleSaveAlias = async () => {
    if (!editingAliasDeviceId || !accessToken) return

    const trimmedAlias = editingAliasValue.trim()
    if (!trimmedAlias) {
      alert('别名不能为空')
      return
    }

    console.log('[DeviceManagementView] 保存设备别名', { deviceId: editingAliasDeviceId, alias: trimmedAlias })
    setOperatingDeviceId(editingAliasDeviceId)
    deviceService.setAccessToken(accessToken)

    const result = await deviceService.updateDevice(editingAliasDeviceId, { alias: trimmedAlias })

    if (result.success) {
      console.log('[DeviceManagementView] 设备别名保存成功')
      setEditingAliasDeviceId(null)
      setEditingAliasValue('')
      await loadDevices()
    } else {
      console.error('[DeviceManagementView] 设备别名保存失败', result.error)
      alert(`保存失败: ${result.error}`)
    }

    setOperatingDeviceId(null)
  }

  /**
   * 取消编辑别名
   */
  const handleCancelEditAlias = () => {
    setEditingAliasDeviceId(null)
    setEditingAliasValue('')
  }

  /**
   * 获取设备 Token 并连接网关
   */
  const handleConnectGateway = async (deviceId: string) => {
    if (!accessToken) {
      alert('未登录')
      return
    }

    console.log('[DeviceManagementView] 获取设备 Token 并连接网关', deviceId)
    setOperatingDeviceId(deviceId)
    deviceService.setAccessToken(accessToken)

    const tokenResult = await deviceService.getDeviceToken(deviceId)

    if (tokenResult.success && tokenResult.data) {
      console.log('[DeviceManagementView] 设备 Token 获取成功，保存并触发连接')

      // 保存设备 Token 到本地
      localStorage.setItem('device_token', tokenResult.data.token)
      localStorage.setItem('device_id', tokenResult.data.deviceId)

      // 触发父组件使用新 token 连接
      if (onDevicePaired) {
        onDevicePaired(tokenResult.data.token)
      }

      await loadDevices()
    } else {
      console.error('[DeviceManagementView] 获取设备 Token 失败', tokenResult.error)
      alert(`获取 Token 失败: ${tokenResult.error}`)
    }

    setOperatingDeviceId(null)
  }

  /**
   * 强制设备下线
   *
   * 通过撤销设备 Token 使该设备被 Gateway 踢出。
   * 撤销 Token 后，该设备需要重新获取 Token 才能重新连接。
   */
  const handleForceOffline = async (deviceId: string) => {
    if (!window.confirm('确定要强制此设备下线吗？该设备的连接 Token 将被撤销，需要重新获取 Token 才能重新连接。')) {
      return
    }

    // 检查 Gateway 连接状态
    let gatewayConnected = false
    try {
      gatewayConnected = await window.electronAPI.gateway.isConnected()
    } catch {
      console.warn('[DeviceManagementView] 无法检查 Gateway 连接状态')
    }

    if (!gatewayConnected) {
      alert('强制下线需要先连接网关。请先确保当前设备已连接到 Gateway。')
      return
    }

    console.log('[DeviceManagementView] 强制设备下线', deviceId)
    setOperatingDeviceId(deviceId)

    try {
      await window.electronAPI.gateway.call('device.token.revoke', { deviceId })
      console.log('[DeviceManagementView] 设备 Token 已撤销，设备将被强制下线')
      await loadDevices()
    } catch (err) {
      console.error('[DeviceManagementView] 强制下线失败', err)
      const errMsg = err instanceof Error ? err.message : '未知错误'
      alert(`强制下线失败: ${errMsg}`)
    }

    setOperatingDeviceId(null)
  }

  /**
   * 轮换设备 Token（通过 Gateway RPC）
   *
   * 需要 Gateway 已连接才能执行。如果未连接，提示用户先连接网关。
   */
  const handleRotateToken = async (deviceId: string) => {
    // 检查 Gateway 连接状态
    let gatewayConnected = false
    try {
      gatewayConnected = await window.electronAPI.gateway.isConnected()
    } catch {
      console.warn('[DeviceManagementView] 无法检查 Gateway 连接状态')
    }

    if (!gatewayConnected) {
      alert('轮换 Token 需要先连接网关。请在设备列表中点击"连接网关"按钮，或在设置页面配置 Gateway 连接。')
      return
    }

    if (!window.confirm('确定要轮换此设备的 Token 吗？旧 Token 将立即失效。')) {
      return
    }

    console.log('[DeviceManagementView] 轮换设备 Token', deviceId)
    setOperatingDeviceId(deviceId)

    try {
      const result = await window.electronAPI.gateway.call<{
        deviceId: string
        token: string
        role: string
        scopes: string[]
        rotatedAtMs: number
      }>('device.token.rotate', { deviceId, role: 'user', scopes: ['user.basic'] })

      if (result?.token) {
        console.log('[DeviceManagementView] Token 轮换成功')

        // 如果轮换的是当前设备，更新本地存储
        const storedDeviceId = localStorage.getItem('device_id')
        if (storedDeviceId === deviceId) {
          localStorage.setItem('device_token', result.token)
          console.log('[DeviceManagementView] 已更新本地设备 Token')

          // 使用新 token 重连网关
          if (onDevicePaired) {
            onDevicePaired(result.token)
          }
        }

        alert('Token 轮换成功')
      } else {
        alert('Token 轮换失败：服务端未返回新 Token')
      }
    } catch (err) {
      console.error('[DeviceManagementView] Token 轮换失败', err)
      const errMsg = err instanceof Error ? err.message : '未知错误'
      alert(`Token 轮换失败: ${errMsg}`)
    }

    setOperatingDeviceId(null)
  }

  /**
   * 判断是否是当前设备
   */
  const isCurrentDevice = (deviceId: string): boolean => {
    return localStorage.getItem('device_id') === deviceId
  }

  return (
    <div className="device-management-view">
      <div className="device-management-header">
        <h2>设备管理</h2>
        {onClose && (
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <div className="device-management-content">
        {/* 未登录提示 */}
        {!accessToken && (
          <div className="error-message">
            <p>请先登录后再使用设备管理功能</p>
          </div>
        )}

        {/* 设备配额信息 */}
        {accessToken && quota && (
          <div className="quota-section">
            <div className="quota-bar">
              <div className="quota-label">
                <span>设备配额</span>
                <span className="quota-numbers">{quota.used} / {quota.max}</span>
              </div>
              <div className="quota-progress">
                <div
                  className="quota-progress-fill"
                  style={{ width: `${Math.min((quota.used / quota.max) * 100, 100)}%` }}
                />
              </div>
              <div className="quota-hint">
                {quota.remaining > 0
                  ? `还可绑定 ${quota.remaining} 台设备`
                  : '已达设备上限'}
              </div>
            </div>
          </div>
        )}

        {/* 设备列表 */}
        {accessToken && (
          <div className="device-list-section">
            <div className="section-header">
              <h3>我的设备</h3>
              <div className="section-actions">
                <button className="refresh-button" onClick={loadDevices} disabled={isLoading} title="刷新设备列表">
                  刷新
                </button>
                <button
                  className="pair-button"
                  onClick={() => setShowPairDialog(true)}
                  disabled={quota !== null && quota.remaining <= 0}
                  title={quota !== null && quota.remaining <= 0 ? '已达设备上限' : '绑定新设备'}
                >
                  + 绑定新设备
                </button>
              </div>
            </div>

            {isLoading && <div className="loading">加载中...</div>}

            {error && <div className="error-message">{error}</div>}

            {!isLoading && !error && devices.length === 0 && (
              <div className="empty-state">
                <p>暂无绑定设备</p>
                <button onClick={() => setShowPairDialog(true)}>绑定第一个设备</button>
              </div>
            )}

            {!isLoading && !error && devices.length > 0 && (
              <div className="device-list">
                {devices.map((device) => (
                  <div key={device.deviceId} className={`device-item ${device.isOnline ? 'online' : 'offline'}`}>
                    <div className="device-info">
                      <div className="device-icon">
                        {getPlatformIcon(device.platform)}
                      </div>
                      <div className="device-details">
                        {/* 设备名称与别名编辑 */}
                        <div className="device-name">
                          {editingAliasDeviceId === device.deviceId ? (
                            <div className="alias-edit-inline">
                              <input
                                type="text"
                                className="alias-input"
                                value={editingAliasValue}
                                onChange={(e) => setEditingAliasValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveAlias()
                                  if (e.key === 'Escape') handleCancelEditAlias()
                                }}
                                autoFocus
                                maxLength={50}
                                placeholder="输入设备别名"
                              />
                              <button
                                className="alias-save-btn"
                                onClick={handleSaveAlias}
                                disabled={operatingDeviceId === device.deviceId}
                                title="保存"
                              >
                                ✓
                              </button>
                              <button
                                className="alias-cancel-btn"
                                onClick={handleCancelEditAlias}
                                title="取消"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <span
                                className="device-name-text"
                                onClick={() => handleStartEditAlias(device)}
                                title="点击修改别名"
                              >
                                {device.alias || device.displayName || device.deviceId}
                              </span>
                              {device.isPrimary && <span className="primary-badge">主设备</span>}
                              {isCurrentDevice(device.deviceId) && <span className="current-badge">当前</span>}
                              <span className={`status-dot ${device.isOnline ? 'online' : 'offline'}`} title={device.isOnline ? '在线' : '离线'} />
                            </>
                          )}
                        </div>

                        {/* 设备元信息 */}
                        <div className="device-meta">
                          <span>{device.platform || '未知平台'}</span>
                          {device.version && (
                            <>
                              <span>•</span>
                              <span>v{device.version}</span>
                            </>
                          )}
                          {device.remoteIp && (
                            <>
                              <span>•</span>
                              <span>{device.remoteIp}</span>
                            </>
                          )}
                          {device.role && (
                            <>
                              <span>•</span>
                              <span>{device.role}</span>
                            </>
                          )}
                        </div>

                        {/* 连接时间信息 */}
                        <div className="device-meta">
                          {device.isOnline && device.connectedAtMs ? (
                            <span>已连接 {formatRelativeTime(device.connectedAtMs)}</span>
                          ) : (
                            <span>绑定于 {new Date(device.linkedAt).toLocaleDateString()}</span>
                          )}
                          {device.lastActiveAt && !device.isOnline && (
                            <>
                              <span>•</span>
                              <span>最近活跃 {formatRelativeTime(new Date(device.lastActiveAt).getTime())}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 设备操作按钮 */}
                    <div className="device-actions">
                      {/* 连接网关按钮（仅离线设备且不是当前设备时显示） */}
                      {!device.isOnline && !isCurrentDevice(device.deviceId) && (
                        <button
                          className="action-button primary"
                          onClick={() => handleConnectGateway(device.deviceId)}
                          disabled={operatingDeviceId === device.deviceId}
                          title="获取此设备的 Token 并用于连接网关"
                        >
                          连接网关
                        </button>
                      )}

                      {/* 强制下线按钮（在线且不是当前设备时显示） */}
                      {device.isOnline && !isCurrentDevice(device.deviceId) && (
                        <button
                          className="action-button warning"
                          onClick={() => handleForceOffline(device.deviceId)}
                          disabled={operatingDeviceId === device.deviceId}
                          title="撤销 Token 强制此设备下线"
                        >
                          强制下线
                        </button>
                      )}

                      {/* Token 轮换按钮 */}
                      <button
                        className="action-button"
                        onClick={() => handleRotateToken(device.deviceId)}
                        disabled={operatingDeviceId === device.deviceId}
                        title="轮换此设备的连接 Token"
                      >
                        轮换Token
                      </button>

                      {/* 设为主设备按钮 */}
                      {!device.isPrimary && (
                        <button
                          className="action-button"
                          onClick={() => handleSetPrimary(device.deviceId)}
                          disabled={operatingDeviceId === device.deviceId}
                        >
                          设为主设备
                        </button>
                      )}

                      {/* 删除设备按钮 */}
                      <button
                        className="action-button danger"
                        onClick={() => handleDeleteDevice(device.deviceId)}
                        disabled={operatingDeviceId === device.deviceId}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 配对对话框 */}
        {showPairDialog && (
          <div className="pair-dialog-overlay" onClick={() => setShowPairDialog(false)}>
            <div className="pair-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="dialog-header">
                <h3>绑定新设备</h3>
                <button className="close-button" onClick={() => setShowPairDialog(false)}>
                  ✕
                </button>
              </div>

              <div className="dialog-content">
                {pairingStatus === 'idle' && (
                  <>
                    <p>点击下方按钮开始绑定当前设备</p>
                    <button className="primary-button" onClick={handlePairDevice}>
                      开始绑定
                    </button>
                  </>
                )}

                {pairingStatus === 'requesting' && (
                  <div className="status-message">
                    <div className="spinner"></div>
                    <p>正在发送配对请求...</p>
                  </div>
                )}

                {pairingStatus === 'waiting' && (
                  <div className="status-message">
                    <div className="spinner"></div>
                    <p>正在等待批准...</p>
                  </div>
                )}

                {pairingStatus === 'success' && (
                  <div className="status-message success">
                    <div className="success-icon">✓</div>
                    <p>设备绑定成功!</p>
                  </div>
                )}

                {pairingStatus === 'error' && (
                  <div className="status-message error">
                    <div className="error-icon">✕</div>
                    <p>绑定失败: {pairingError}</p>
                    <button onClick={() => setPairingStatus('idle')}>重试</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
