/**
 * DeviceManagementView Component - 设备管理视图
 *
 * 用于管理用户的设备绑定、查看设备列表、配对新设备
 * 融合两套数据源：
 * - REST API (deviceService): 持久化绑定信息（isPrimary, alias, linkedAt）
 * - Gateway RPC (node.list): 实时连接信息（connected, remoteIp, version）
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
    // 按 deviceId/nodeId 或 platform+displayName 匹配
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
 * 设备管理视图组件
 */
export const DeviceManagementView: React.FC<DeviceManagementViewProps> = ({
  accessToken,
  onClose,
  onDevicePaired,
}) => {
  const [devices, setDevices] = useState<MergedDevice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPairDialog, setShowPairDialog] = useState(false)
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'requesting' | 'waiting' | 'success' | 'error'>('idle')
  const [pairingError, setPairingError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)

  /**
   * 加载 Gateway 节点列表（实时连接信息）
   */
  const loadNodes = useCallback(async (): Promise<NodeInfo[]> => {
    try {
      const result = await window.electronAPI.gateway.call('node.list', {})
      const nodes: NodeInfo[] = result?.nodes || []
      console.log('[DeviceManagementView] Gateway 节点列表:', nodes.length, '个')
      return nodes
    } catch (err) {
      console.warn('[DeviceManagementView] 获取 Gateway 节点列表失败（可能未连接）:', err)
      return []
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

    console.log('[DeviceManagementView] 加载设备列表, accessToken:', accessToken ? '存在' : '不存在')
    setIsLoading(true)
    setError(null)

    deviceService.setAccessToken(accessToken)
    const [deviceResult, nodes] = await Promise.all([
      deviceService.getDevices(),
      loadNodes(),
    ])

    if (deviceResult.success && deviceResult.devices) {
      const merged = mergeDeviceData(deviceResult.devices, nodes)
      setDevices(merged)
      console.log('[DeviceManagementView] 设备列表加载成功，合并后', merged.length, '个设备')
    } else {
      setError(deviceResult.error || '加载失败')
      console.error('[DeviceManagementView] 设备列表加载失败', deviceResult.error)
    }

    setIsLoading(false)
  }, [accessToken, loadNodes])

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

    // 生成设备ID和公钥
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
      setRequestId(result.request.requestId)
      setPairingStatus('waiting')
      console.log('[DeviceManagementView] 配对请求已发送', result.request.requestId)

      // 自动批准配对(简化流程)
      setTimeout(async () => {
        const approveResult = await deviceService.approvePairing(result.request!.requestId)
        if (approveResult.success && approveResult.result) {
          console.log('[DeviceManagementView] 设备配对成功', approveResult.result)

          // 保存设备Token到本地
          if (approveResult.result.deviceToken) {
            localStorage.setItem('device_token', approveResult.result.deviceToken)
            localStorage.setItem('device_id', approveResult.result.device.deviceId)

            // 触发回调,通知父组件设备已配对
            if (onDevicePaired) {
              onDevicePaired(approveResult.result.deviceToken)
            }
          }

          setPairingStatus('success')
          setShowPairDialog(false)

          // 重新加载设备列表
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
   * 删除设备
   */
  const handleDeleteDevice = async (deviceId: string) => {
    if (!window.confirm('确定要删除此设备吗？')) {
      return
    }

    console.log('[DeviceManagementView] 删除设备', deviceId)

    if (!accessToken) {
      alert('未登录')
      return
    }

    deviceService.setAccessToken(accessToken)
    const result = await deviceService.deleteDevice(deviceId)

    if (result.success) {
      console.log('[DeviceManagementView] 设备删除成功')
      alert('设备删除成功')
      await loadDevices()
    } else {
      console.error('[DeviceManagementView] 设备删除失败', result.error)
      alert(`删除失败: ${result.error}`)
    }
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

    deviceService.setAccessToken(accessToken)
    const result = await deviceService.updateDevice(deviceId, { isPrimary: true })

    if (result.success) {
      console.log('[DeviceManagementView] 主设备设置成功')
      await loadDevices()
    } else {
      console.error('[DeviceManagementView] 主设备设置失败', result.error)
      alert(`设置失败: ${result.error}`)
    }
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

        {/* 设备列表 */}
        {accessToken && (
          <div className="device-list-section">
            <div className="section-header">
              <h3>我的设备</h3>
              <div className="section-actions">
                <button className="refresh-button" onClick={loadDevices} disabled={isLoading} title="刷新设备列表">
                  刷新
                </button>
                <button className="pair-button" onClick={() => setShowPairDialog(true)}>
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
                        {device.platform === 'windows' ? '🖥️' : device.platform === 'macos' ? '💻' : '📱'}
                      </div>
                      <div className="device-details">
                        <div className="device-name">
                          {device.alias || device.displayName || device.deviceId}
                          {device.isPrimary && <span className="primary-badge">主设备</span>}
                          <span className={`status-dot ${device.isOnline ? 'online' : 'offline'}`} title={device.isOnline ? '在线' : '离线'} />
                        </div>
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
                        </div>
                        <div className="device-meta">
                          {device.isOnline && device.connectedAtMs ? (
                            <span>已连接 {formatRelativeTime(device.connectedAtMs)}</span>
                          ) : (
                            <span>绑定于 {new Date(device.linkedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="device-actions">
                      {!device.isPrimary && (
                        <button
                          className="action-button"
                          onClick={() => handleSetPrimary(device.deviceId)}
                        >
                          设为主设备
                        </button>
                      )}
                      <button
                        className="action-button danger"
                        onClick={() => handleDeleteDevice(device.deviceId)}
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
