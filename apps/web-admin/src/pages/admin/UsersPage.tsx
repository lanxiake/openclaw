import { useState } from 'react'
import { Search, MoreVertical, UserX, Shield, Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate, maskPhone, maskEmail } from '@/lib/utils'
import type { UserListItem } from '@/types'

/**
 * 模拟用户数据
 */
const mockUsers: UserListItem[] = [
  {
    id: '1',
    phone: '+8613800138001',
    email: 'user1@example.com',
    displayName: '张三',
    status: 'active',
    deviceCount: 3,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    phone: '+8613800138002',
    email: 'user2@example.com',
    displayName: '李四',
    status: 'active',
    deviceCount: 2,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    phone: '+8613800138003',
    displayName: '王五',
    status: 'suspended',
    deviceCount: 0,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    email: 'admin@example.com',
    displayName: '管理员',
    status: 'active',
    deviceCount: 5,
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    lastLoginAt: new Date().toISOString(),
  },
]

/**
 * 状态标签
 */
function StatusBadge({ status }: { status: string }) {
  const config = {
    active: {
      label: '正常',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
    suspended: {
      label: '已停用',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
    deleted: {
      label: '已删除',
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    },
  }

  const { label, className } = config[status as keyof typeof config] || config.active

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

/**
 * 用户管理页面
 */
export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showMenu, setShowMenu] = useState<string | null>(null)

  // 过滤用户
  const filteredUsers = mockUsers.filter((user) => {
    const matchSearch =
      !search ||
      user.displayName.toLowerCase().includes(search.toLowerCase()) ||
      user.phone?.includes(search) ||
      user.email?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || user.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">用户管理</h1>
        <p className="text-muted-foreground">管理平台用户</p>
      </div>

      {/* 搜索和过滤 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索用户名、手机号、邮箱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'suspended'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? '全部' : status === 'active' ? '正常' : '已停用'}
            </Button>
          ))}
        </div>
      </div>

      {/* 用户列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium">用户</th>
                  <th className="text-left p-4 font-medium">联系方式</th>
                  <th className="text-left p-4 font-medium">状态</th>
                  <th className="text-left p-4 font-medium">设备数</th>
                  <th className="text-left p-4 font-medium">注册时间</th>
                  <th className="text-left p-4 font-medium">最后登录</th>
                  <th className="text-right p-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-medium">
                            {user.displayName[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{user.displayName}</div>
                          <div className="text-sm text-muted-foreground">
                            ID: {user.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        {user.phone && (
                          <div className="text-sm">{maskPhone(user.phone)}</div>
                        )}
                        {user.email && (
                          <div className="text-sm text-muted-foreground">
                            {maskEmail(user.email)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="p-4">{user.deviceCount}</td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {formatDate(user.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {user.lastLoginAt
                        ? formatDate(user.lastLoginAt, { month: 'short', day: 'numeric' })
                        : '-'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setShowMenu(showMenu === user.id ? null : user.id)
                          }
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>

                        {showMenu === user.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setShowMenu(null)}
                            />
                            <div className="absolute right-0 mt-1 w-40 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                                <Mail className="w-4 h-4" />
                                发送消息
                              </button>
                              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                                <Shield className="w-4 h-4" />
                                修改权限
                              </button>
                              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                                <UserX className="w-4 h-4" />
                                {user.status === 'active' ? '停用账户' : '恢复账户'}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              没有找到匹配的用户
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 {filteredUsers.length} 个用户
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            上一页
          </Button>
          <Button variant="outline" size="sm" disabled>
            下一页
          </Button>
        </div>
      </div>
    </div>
  )
}
