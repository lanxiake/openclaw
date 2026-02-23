/**
 * 管理员管理页面
 *
 * 提供管理员列表查看、创建、编辑、状态管理等功能
 * 仅 super_admin 角色可访问
 */

import { useState } from 'react'
import {
  Plus,
  MoreHorizontal,
  Key,
  LogOut,
  UserX,
  UserCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatDateTime } from '@/lib/utils'
import { ADMIN_ROLE_LABELS, ADMIN_STATUS_LABELS } from '@/lib/constants'
import {
  useAdminList,
  useCreateAdmin,
  useUpdateAdmin,
  useResetAdminPassword,
  useUpdateAdminStatus,
  useForceLogoutAdmin,
} from '@/hooks/useAdmins'
import type { AdminItem, AdminListQuery, AdminRole, AdminStatus } from '@/types/admin-manage'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/stores'

/**
 * 角色对应的 Badge 样式
 */
const ROLE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  super_admin: 'default',
  admin: 'secondary',
  operator: 'outline',
}

/**
 * 状态对应的 Badge 样式
 */
const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  suspended: 'destructive',
  locked: 'secondary',
}

/**
 * 确认操作类型
 */
interface ConfirmAction {
  type: 'reset-password' | 'force-logout' | 'suspend' | 'activate'
  admin: AdminItem
}

/**
 * 管理员管理页面组件
 */
export default function AdminListPage() {
  const { admin: currentAdmin } = useAuthStore()

  /** 搜索和过滤状态 */
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const pageSize = 20
  const debouncedSearch = useDebounce(searchInput, 300)

  /** Dialog 状态 */
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editAdmin, setEditAdmin] = useState<AdminItem | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  /** 创建表单 */
  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    displayName: '',
    email: '',
    phone: '',
    role: 'operator' as string,
  })

  /** 编辑表单 */
  const [editForm, setEditForm] = useState({
    displayName: '',
    email: '',
    phone: '',
    role: 'operator' as string,
  })

  /** 构建查询参数 */
  const query: AdminListQuery = {
    page,
    pageSize,
    search: debouncedSearch || undefined,
    role: roleFilter !== 'all' ? (roleFilter as AdminRole) : undefined,
    status: statusFilter !== 'all' ? (statusFilter as AdminStatus) : undefined,
    orderBy: 'createdAt',
    orderDir: 'desc',
  }

  /** 数据查询 */
  const { data, isLoading, isFetching, refetch } = useAdminList(query)
  const createMutation = useCreateAdmin()
  const updateMutation = useUpdateAdmin()
  const resetPasswordMutation = useResetAdminPassword()
  const updateStatusMutation = useUpdateAdminStatus()
  const forceLogoutMutation = useForceLogoutAdmin()

  /**
   * 重置过滤器
   */
  const handleResetFilters = () => {
    setSearchInput('')
    setRoleFilter('all')
    setStatusFilter('all')
    setPage(1)
  }

  /**
   * 打开编辑弹窗
   */
  const handleOpenEdit = (admin: AdminItem) => {
    setEditForm({
      displayName: admin.displayName,
      email: admin.email ?? '',
      phone: admin.phone ?? '',
      role: admin.role,
    })
    setEditAdmin(admin)
  }

  /**
   * 提交创建管理员
   */
  const handleCreate = async () => {
    if (!createForm.username || !createForm.password || !createForm.displayName) {
      alert('请填写必填字段')
      return
    }
    if (createForm.username.length < 3) {
      alert('用户名至少 3 个字符')
      return
    }
    if (createForm.password.length < 8) {
      alert('密码至少 8 个字符')
      return
    }

    try {
      await createMutation.mutateAsync({
        username: createForm.username,
        password: createForm.password,
        displayName: createForm.displayName,
        email: createForm.email || undefined,
        phone: createForm.phone || undefined,
        role: createForm.role as 'admin' | 'operator',
      })
      setCreateDialogOpen(false)
      setCreateForm({
        username: '',
        password: '',
        displayName: '',
        email: '',
        phone: '',
        role: 'operator',
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败')
    }
  }

  /**
   * 提交编辑管理员
   */
  const handleUpdate = async () => {
    if (!editAdmin) return
    if (!editForm.displayName.trim()) {
      alert('显示名称不能为空')
      return
    }

    try {
      await updateMutation.mutateAsync({
        adminId: editAdmin.id,
        displayName: editForm.displayName.trim(),
        email: editForm.email.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        role: editForm.role as 'admin' | 'operator',
      })
      setEditAdmin(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失败')
    }
  }

  /**
   * 执行确认操作
   */
  const handleConfirmAction = async () => {
    if (!confirmAction) return

    try {
      switch (confirmAction.type) {
        case 'reset-password': {
          const result = await resetPasswordMutation.mutateAsync(confirmAction.admin.id)
          setConfirmAction(null)
          setTempPassword(result.tempPassword)
          return
        }
        case 'force-logout':
          await forceLogoutMutation.mutateAsync(confirmAction.admin.id)
          break
        case 'suspend':
          await updateStatusMutation.mutateAsync({
            adminId: confirmAction.admin.id,
            status: 'suspended',
          })
          break
        case 'activate':
          await updateStatusMutation.mutateAsync({
            adminId: confirmAction.admin.id,
            status: 'active',
          })
          break
      }
      setConfirmAction(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  /**
   * 复制临时密码到剪贴板
   */
  const handleCopyPassword = async () => {
    if (!tempPassword) return
    try {
      await navigator.clipboard.writeText(tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('复制失败，请手动复制')
    }
  }

  /**
   * 获取确认操作的描述信息
   */
  const getConfirmInfo = (action: ConfirmAction) => {
    const name = action.admin.displayName
    switch (action.type) {
      case 'reset-password':
        return { title: '重置密码', description: `确定要重置管理员 "${name}" 的密码吗？将生成一个临时密码，该管理员的所有会话将被撤销。` }
      case 'force-logout':
        return { title: '强制登出', description: `确定要强制管理员 "${name}" 登出吗？该管理员的所有活跃会话将被撤销。` }
      case 'suspend':
        return { title: '禁用管理员', description: `确定要禁用管理员 "${name}" 吗？禁用后该管理员将无法登录系统。` }
      case 'activate':
        return { title: '启用管理员', description: `确定要启用管理员 "${name}" 吗？启用后该管理员可以正常登录系统。` }
    }
  }

  /** 分页信息 */
  const totalPages = data?.totalPages ?? 0

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">管理员管理</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            创建管理员
          </Button>
        </div>
      </div>

      {/* 搜索过滤 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">搜索</label>
              <Input
                placeholder="用户名、显示名称或邮箱"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">角色</label>
              <Select
                value={roleFilter}
                onValueChange={(v) => {
                  setRoleFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="super_admin">超级管理员</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="operator">运营人员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">状态</label>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="active">正常</SelectItem>
                  <SelectItem value="suspended">已禁用</SelectItem>
                  <SelectItem value="locked">已锁定</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                重置过滤
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 管理员列表 */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : !data || data.admins.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">暂无管理员数据</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                      <th className="p-3 font-medium">管理员</th>
                      <th className="p-3 font-medium">邮箱</th>
                      <th className="p-3 font-medium">角色</th>
                      <th className="p-3 font-medium">状态</th>
                      <th className="p-3 font-medium">MFA</th>
                      <th className="p-3 font-medium">最后登录</th>
                      <th className="p-3 font-medium">创建时间</th>
                      <th className="p-3 font-medium w-[60px]">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.admins.map((admin) => {
                      const isSelf = currentAdmin?.id === admin.id
                      return (
                        <tr key={admin.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{admin.displayName}</p>
                              <p className="text-xs text-muted-foreground font-mono">{admin.username}</p>
                            </div>
                          </td>
                          <td className="p-3 text-xs">{admin.email ?? '-'}</td>
                          <td className="p-3">
                            <Badge variant={ROLE_BADGE_VARIANT[admin.role] ?? 'secondary'}>
                              {ADMIN_ROLE_LABELS[admin.role] ?? admin.role}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant={STATUS_BADGE_VARIANT[admin.status] ?? 'secondary'}>
                              {ADMIN_STATUS_LABELS[admin.status] ?? admin.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant={admin.mfaEnabled ? 'default' : 'outline'}>
                              {admin.mfaEnabled ? '已启用' : '未启用'}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                            {admin.lastLoginAt ? (
                              <div>
                                <p>{formatDateTime(admin.lastLoginAt)}</p>
                                {admin.lastLoginIp && (
                                  <p className="font-mono text-[10px]">{admin.lastLoginIp}</p>
                                )}
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(admin.createdAt)}
                          </td>
                          <td className="p-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenEdit(admin)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  编辑信息
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setConfirmAction({ type: 'reset-password', admin })}
                                >
                                  <Key className="mr-2 h-4 w-4" />
                                  重置密码
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={isSelf}
                                  onClick={() => setConfirmAction({ type: 'force-logout', admin })}
                                >
                                  <LogOut className="mr-2 h-4 w-4" />
                                  强制登出
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {admin.status === 'active' ? (
                                  <DropdownMenuItem
                                    disabled={isSelf}
                                    className="text-destructive"
                                    onClick={() => setConfirmAction({ type: 'suspend', admin })}
                                  >
                                    <UserX className="mr-2 h-4 w-4" />
                                    禁用
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => setConfirmAction({ type: 'activate', admin })}
                                  >
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    启用
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              <div className="flex items-center justify-between p-3 border-t">
                <span className="text-xs text-muted-foreground">
                  第 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, data.total)} 条，共 {data.total} 条
                  {isFetching && '（加载中...）'}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                  >
                    下一页
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 创建管理员 Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建管理员</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-username">用户名 *</Label>
              <Input
                id="create-username"
                placeholder="3-50 个字符"
                value={createForm.username}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">密码 *</Label>
              <Input
                id="create-password"
                type="password"
                placeholder="至少 8 个字符"
                value={createForm.password}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-displayName">显示名称 *</Label>
              <Input
                id="create-displayName"
                placeholder="管理员显示名称"
                value={createForm.displayName}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, displayName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-email">邮箱</Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="可选"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-phone">手机号</Label>
                <Input
                  id="create-phone"
                  placeholder="可选"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">角色 *</Label>
              <Select
                value={createForm.role}
                onValueChange={(v) => setCreateForm((prev) => ({ ...prev, role: v }))}
              >
                <SelectTrigger id="create-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="operator">运营人员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? '创建中...' : '确认创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑管理员 Dialog */}
      <Dialog open={!!editAdmin} onOpenChange={(open) => { if (!open) setEditAdmin(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑管理员 - {editAdmin?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-displayName">显示名称</Label>
              <Input
                id="edit-displayName"
                value={editForm.displayName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, displayName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">邮箱</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">手机号</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">角色</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm((prev) => ({ ...prev, role: v }))}
                disabled={editAdmin?.role === 'super_admin'}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editAdmin?.role === 'super_admin' && (
                    <SelectItem value="super_admin">超级管理员</SelectItem>
                  )}
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="operator">运营人员</SelectItem>
                </SelectContent>
              </Select>
              {editAdmin?.role === 'super_admin' && (
                <p className="text-xs text-muted-foreground">超级管理员角色不可修改</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAdmin(null)}>
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认操作 AlertDialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction && getConfirmInfo(confirmAction).title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction && getConfirmInfo(confirmAction).description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={confirmAction?.type === 'suspend' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 临时密码展示 Dialog */}
      <Dialog open={!!tempPassword} onOpenChange={(open) => { if (!open) { setTempPassword(null); setCopied(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>密码已重置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              新的临时密码已生成，请将其发送给对应管理员。此密码仅显示一次，关闭后无法再次查看。
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={tempPassword ?? ''}
                className="font-mono text-lg tracking-widest"
              />
              <Button variant="outline" size="icon" onClick={handleCopyPassword}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setTempPassword(null); setCopied(false) }}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
