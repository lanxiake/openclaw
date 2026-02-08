import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  RefreshCw,
  Mail,
  MessageSquare,
  Bell,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn, formatDateTime } from '@/lib/utils'
import {
  useNotificationTemplates,
  useUpdateNotificationTemplate,
  useTestNotificationTemplate,
} from '@/hooks/useConfig'
import type { NotificationTemplate, NotificationChannel } from '@/types/config'

/**
 * 获取渠道配置
 */
function getChannelConfig(channel: NotificationChannel) {
  switch (channel) {
    case 'email':
      return { icon: Mail, label: '邮件', color: 'text-blue-500' }
    case 'sms':
      return { icon: MessageSquare, label: '短信', color: 'text-green-500' }
    case 'push':
      return { icon: Bell, label: '推送', color: 'text-purple-500' }
    default:
      return { icon: Mail, label: channel, color: 'text-gray-500' }
  }
}

/**
 * 通知模板页面
 */
export default function NotificationsConfigPage() {
  // 筛选状态
  const [channelFilter, setChannelFilter] = useState<'all' | NotificationChannel>('all')

  // 弹窗状态
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  // 编辑表单状态
  const [editSubject, setEditSubject] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editEnabled, setEditEnabled] = useState(true)

  // 测试数据
  const [testData, setTestData] = useState<Record<string, string>>({})
  const [previewContent, setPreviewContent] = useState<{
    subject?: string
    content: string
    channel: string
  } | null>(null)

  // 获取模板列表
  const { data, isLoading, isFetching, refetch } = useNotificationTemplates(
    channelFilter === 'all' ? undefined : channelFilter
  )

  // 更新模板
  const updateTemplate = useUpdateNotificationTemplate()

  // 测试模板
  const testTemplate = useTestNotificationTemplate()

  /**
   * 打开编辑弹窗
   */
  const handleOpenEdit = (template: NotificationTemplate) => {
    setSelectedTemplate(template)
    setEditSubject(template.subject || '')
    setEditContent(template.content)
    setEditEnabled(template.enabled)
    setEditMode(true)
    setPreviewMode(false)
  }

  /**
   * 打开预览弹窗
   */
  const handleOpenPreview = (template: NotificationTemplate) => {
    setSelectedTemplate(template)
    // 初始化测试数据
    const initialTestData: Record<string, string> = {}
    template.variables.forEach((v) => {
      initialTestData[v] = `[${v}]`
    })
    setTestData(initialTestData)
    setPreviewContent(null)
    setPreviewMode(true)
    setEditMode(false)
  }

  /**
   * 保存模板
   */
  const handleSave = async () => {
    if (!selectedTemplate) return
    try {
      await updateTemplate.mutateAsync({
        templateId: selectedTemplate.id,
        subject: editSubject || undefined,
        content: editContent,
        enabled: editEnabled,
      })
      setEditMode(false)
      setSelectedTemplate(null)
    } catch (error) {
      console.error('保存模板失败:', error)
    }
  }

  /**
   * 测试模板
   */
  const handleTest = async () => {
    if (!selectedTemplate) return
    try {
      const result = await testTemplate.mutateAsync({
        templateId: selectedTemplate.id,
        testData,
      })
      if (result.preview) {
        setPreviewContent(result.preview)
      }
    } catch (error) {
      console.error('测试模板失败:', error)
    }
  }

  /**
   * 关闭弹窗
   */
  const handleClose = () => {
    setSelectedTemplate(null)
    setEditMode(false)
    setPreviewMode(false)
    setPreviewContent(null)
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
            <h1 className="text-2xl font-bold">通知模板</h1>
            <p className="text-muted-foreground">管理系统通知消息模板</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
          刷新
        </Button>
      </div>

      {/* 筛选 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <Label>渠道筛选：</Label>
            <Select
              value={channelFilter}
              onValueChange={(value: 'all' | NotificationChannel) => setChannelFilter(value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="email">邮件</SelectItem>
                <SelectItem value="sms">短信</SelectItem>
                <SelectItem value="push">推送</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 模板列表 */}
      <Card>
        <CardHeader>
          <CardTitle>模板列表</CardTitle>
          <CardDescription>
            共 {data?.total ?? 0} 个模板
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data || data.templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              没有找到通知模板
            </div>
          ) : (
            <div className="space-y-3">
              {data.templates.map((template) => {
                const channelConfig = getChannelConfig(template.channel)
                const Icon = channelConfig.icon

                return (
                  <div
                    key={template.id}
                    className="flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn('p-2 rounded-lg bg-muted', channelConfig.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{template.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {channelConfig.label}
                        </Badge>
                        <Badge
                          variant={template.enabled ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {template.enabled ? (
                            <><CheckCircle className="h-3 w-3 mr-1" />启用</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" />禁用</>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        代码：{template.code}
                      </p>
                      {template.subject && (
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          主题：{template.subject}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>变量：{template.variables.join(', ')}</span>
                        <span>更新：{formatDateTime(template.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenPreview(template)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        预览
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(template)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        编辑
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑弹窗 */}
      <Dialog open={editMode} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑模板 - {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              修改通知模板内容
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {getChannelConfig(selectedTemplate.channel).label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    代码：{selectedTemplate.code}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="editEnabled">启用</Label>
                  <Switch
                    id="editEnabled"
                    checked={editEnabled}
                    onCheckedChange={setEditEnabled}
                  />
                </div>
              </div>

              {selectedTemplate.channel === 'email' && (
                <div className="space-y-2">
                  <Label htmlFor="editSubject">邮件主题</Label>
                  <Input
                    id="editSubject"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="输入邮件主题"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="editContent">模板内容</Label>
                <Textarea
                  id="editContent"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="输入模板内容"
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>

              <div className="text-sm text-muted-foreground">
                <p>可用变量：</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedTemplate.variables.map((v) => (
                    <Badge key={v} variant="secondary">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateTemplate.isPending}
            >
              {updateTemplate.isPending && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 预览弹窗 */}
      <Dialog open={previewMode} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>预览模板 - {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              填写测试数据并预览模板效果
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <Tabs defaultValue="input">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="input">测试数据</TabsTrigger>
                <TabsTrigger value="preview">预览结果</TabsTrigger>
              </TabsList>
              <TabsContent value="input" className="space-y-4">
                {selectedTemplate.variables.map((variable) => (
                  <div key={variable} className="space-y-2">
                    <Label htmlFor={`test-${variable}`}>{variable}</Label>
                    <Input
                      id={`test-${variable}`}
                      value={testData[variable] || ''}
                      onChange={(e) =>
                        setTestData((prev) => ({
                          ...prev,
                          [variable]: e.target.value,
                        }))
                      }
                      placeholder={`输入 ${variable} 的测试值`}
                    />
                  </div>
                ))}
                <Button
                  onClick={handleTest}
                  disabled={testTemplate.isPending}
                  className="w-full"
                >
                  {testTemplate.isPending && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  )}
                  生成预览
                </Button>
              </TabsContent>
              <TabsContent value="preview" className="space-y-4">
                {previewContent ? (
                  <div className="space-y-4">
                    {previewContent.subject && (
                      <div className="space-y-2">
                        <Label>主题</Label>
                        <div className="p-3 bg-muted rounded text-sm">
                          {previewContent.subject}
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>内容</Label>
                      <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap font-mono">
                        {previewContent.content}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    请先填写测试数据并点击"生成预览"
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
