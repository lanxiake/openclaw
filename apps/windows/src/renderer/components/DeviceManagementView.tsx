/**
 * DeviceManagementView Component - 设备管理视图
 *
 * 用于管理用户的设备绑定、查看设备列表、配对新设备
 */

import React, { useState, useEffect } from 'react'
import { deviceService, type Device } from '../services/device-service'
import './DeviceManagementView.css'

interface DeviceManagementViewProps {
  accessToken: string | null
  onClose?: () => void
  onDevicePaired?: (deviceToken: string) => void // 新增: 设备配对成功回调
}

/**
 * 设备管理视图组件
 */
export const DeviceManagementView: React.FC<DeviceManagementViewProps> = ({
  accessToken,
  onClose,
  onDevicePaired,
}) => {
  const [devices, setDevices] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPairDialog, setShowPairDialog] = useState(false)
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'requesting' | 'waiting' | 'success' | 'error'>('idle')
  const [pairingError, setPairingError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)

  /**
   * 加载设备列表
   */
  const loadDevices = async () => {
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
    const result = await deviceService.getDevices()

    if (result.success && result.devices) {
      setDevices(result.devices)
      console.log('[DeviceManagementView] 设备列表加载成功', result.devices.length)
    } else {
      setError(result.error || '加载失败')
      console.error('[DeviceManagementView] 设备列表加载失败', result.error)
    }

    setIsLoading(false)
  }

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
              <button className="pair-button" onClick={() => setShowPairDialog(true)}>
                + 绑定新设备
              </button>
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
                  <div key={device.deviceId} className="device-item">
                    <div className="device-info">
                      <div className="device-icon">
                        {device.platform === 'windows' ? '🖥️' : '📱'}
                      </div>
                      <div className="device-details">
                        <div className="device-name">
                          {device.alias || device.displayName || device.deviceId}
                          {device.isPrimary && <span className="primary-badge">主设备</span>}
                        </div>
                        <div className="device-meta">
                          <span>{device.platform || '未知平台'}</span>
                          <span>•</span>
                          <span>绑定于 {new Date(device.linkedAt).toLocaleDateString()}</span>
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
