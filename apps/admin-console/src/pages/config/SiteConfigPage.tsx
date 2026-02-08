import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Save, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useSiteConfig, useUpdateSiteConfig } from '@/hooks/useConfig'
import type { SiteConfig } from '@/types/config'

/**
 * 站点配置页面
 */
export default function SiteConfigPage() {
  // 获取站点配置
  const { data: config, isLoading, isFetching, refetch } = useSiteConfig()

  // 更新配置
  const updateConfig = useUpdateSiteConfig()

  // 表单状态
  const [formData, setFormData] = useState<Partial<SiteConfig>>({})
  const [hasChanges, setHasChanges] = useState(false)

  // 初始化表单数据
  useEffect(() => {
    if (config) {
      setFormData(config)
      setHasChanges(false)
    }
  }, [config])

  /**
   * 处理表单字段变更
   */
  const handleChange = (field: keyof SiteConfig, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  /**
   * 保存配置
   */
  const handleSave = async () => {
    try {
      await updateConfig.mutateAsync(formData)
      setHasChanges(false)
    } catch (error) {
      console.error('保存配置失败:', error)
    }
  }

  /**
   * 重置表单
   */
  const handleReset = () => {
    if (config) {
      setFormData(config)
      setHasChanges(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/config">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">站点配置</h1>
            <p className="text-muted-foreground">配置站点基础信息</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            重置
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateConfig.isPending}
          >
            {updateConfig.isPending && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            )}
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>站点名称和描述信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="siteName">站点名称</Label>
                  <Input
                    id="siteName"
                    value={formData.siteName || ''}
                    onChange={(e) => handleChange('siteName', e.target.value)}
                    placeholder="输入站点名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="copyright">版权信息</Label>
                  <Input
                    id="copyright"
                    value={formData.copyright || ''}
                    onChange={(e) => handleChange('copyright', e.target.value)}
                    placeholder="例如：© 2024 Company. All rights reserved."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="siteDescription">站点描述</Label>
                <Textarea
                  id="siteDescription"
                  value={formData.siteDescription || ''}
                  onChange={(e) => handleChange('siteDescription', e.target.value)}
                  placeholder="输入站点描述"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* 品牌资源 */}
          <Card>
            <CardHeader>
              <CardTitle>品牌资源</CardTitle>
              <CardDescription>Logo 和图标设置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    value={formData.logoUrl || ''}
                    onChange={(e) => handleChange('logoUrl', e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-muted-foreground">
                    建议尺寸：200x50px，支持 PNG、SVG 格式
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="faviconUrl">Favicon URL</Label>
                  <Input
                    id="faviconUrl"
                    value={formData.faviconUrl || ''}
                    onChange={(e) => handleChange('faviconUrl', e.target.value)}
                    placeholder="https://example.com/favicon.ico"
                  />
                  <p className="text-xs text-muted-foreground">
                    建议尺寸：32x32px，支持 ICO、PNG 格式
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 联系方式 */}
          <Card>
            <CardHeader>
              <CardTitle>联系方式</CardTitle>
              <CardDescription>客服和技术支持联系信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">联系邮箱</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail || ''}
                    onChange={(e) => handleChange('contactEmail', e.target.value)}
                    placeholder="support@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">联系电话</Label>
                  <Input
                    id="contactPhone"
                    value={formData.contactPhone || ''}
                    onChange={(e) => handleChange('contactPhone', e.target.value)}
                    placeholder="400-123-4567"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 备案信息 */}
          <Card>
            <CardHeader>
              <CardTitle>备案信息</CardTitle>
              <CardDescription>网站备案相关信息</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="icpNumber">ICP 备案号</Label>
                <Input
                  id="icpNumber"
                  value={formData.icpNumber || ''}
                  onChange={(e) => handleChange('icpNumber', e.target.value)}
                  placeholder="京ICP备12345678号"
                />
                <p className="text-xs text-muted-foreground">
                  如有备案，请填写完整备案号，将显示在网站底部
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
