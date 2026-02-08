import { Search, Filter, Download } from 'lucide-react'
import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { ORDER_STATUS_LABELS } from '@/lib/constants'

/**
 * 模拟订单数据
 */
const mockOrders = [
  {
    id: 'o1',
    orderNo: 'ORD202602070001',
    userName: '张三',
    userPhone: '138****5678',
    planName: '专业版',
    amount: 9900,
    finalAmount: 9900,
    status: 'paid',
    paymentMethod: '微信支付',
    paymentTime: '2026-02-07T10:30:00Z',
    createdAt: '2026-02-07T10:25:00Z',
  },
  {
    id: 'o2',
    orderNo: 'ORD202602070002',
    userName: '李四',
    userPhone: '186****1234',
    planName: '基础版',
    amount: 2900,
    finalAmount: 2320,
    status: 'paid',
    paymentMethod: '支付宝',
    paymentTime: '2026-02-07T09:15:00Z',
    createdAt: '2026-02-07T09:10:00Z',
  },
  {
    id: 'o3',
    orderNo: 'ORD202602060003',
    userName: '王五',
    userPhone: '135****9012',
    planName: '企业版',
    amount: 29900,
    finalAmount: 29900,
    status: 'pending',
    paymentMethod: null,
    paymentTime: null,
    createdAt: '2026-02-06T16:00:00Z',
  },
  {
    id: 'o4',
    orderNo: 'ORD202602050004',
    userName: '赵六',
    userPhone: '159****3456',
    planName: '专业版',
    amount: 9900,
    finalAmount: 9900,
    status: 'refunded',
    paymentMethod: '微信支付',
    paymentTime: '2026-02-05T14:20:00Z',
    createdAt: '2026-02-05T14:15:00Z',
  },
]

/**
 * 获取订单状态徽章变体
 */
function getStatusVariant(status: string) {
  switch (status) {
    case 'paid':
      return 'success'
    case 'pending':
      return 'warning'
    case 'failed':
    case 'canceled':
      return 'destructive'
    case 'refunded':
      return 'secondary'
    default:
      return 'secondary'
  }
}

/**
 * 订单管理页面
 */
export default function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">订单管理</h1>
          <p className="text-muted-foreground">查看和管理用户订单</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          导出
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索订单号、用户..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 订单列表 */}
      <Card>
        <CardHeader>
          <CardTitle>订单列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>订单号</th>
                  <th>用户</th>
                  <th>计划</th>
                  <th>金额</th>
                  <th>状态</th>
                  <th>支付方式</th>
                  <th>创建时间</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {mockOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-mono text-sm">{order.orderNo}</td>
                    <td>
                      <div>
                        <p className="font-medium">{order.userName}</p>
                        <p className="text-sm text-muted-foreground">{order.userPhone}</p>
                      </div>
                    </td>
                    <td>{order.planName}</td>
                    <td>
                      <div>
                        <p className="font-medium">{formatCurrency(order.finalAmount)}</p>
                        {order.amount !== order.finalAmount && (
                          <p className="text-sm text-muted-foreground line-through">
                            {formatCurrency(order.amount)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td>
                      <Badge variant={getStatusVariant(order.status) as 'success' | 'warning' | 'destructive' | 'secondary'}>
                        {ORDER_STATUS_LABELS[order.status] || order.status}
                      </Badge>
                    </td>
                    <td>{order.paymentMethod || '-'}</td>
                    <td className="text-sm">{formatDateTime(order.createdAt)}</td>
                    <td className="text-right">
                      <Button variant="ghost" size="sm">
                        查看
                      </Button>
                      {order.status === 'paid' && (
                        <Button variant="ghost" size="sm" className="text-destructive">
                          退款
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
