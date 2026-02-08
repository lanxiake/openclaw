import { Plus, Edit, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

/**
 * 模拟订阅计划数据
 */
const mockPlans = [
  {
    id: 'free',
    name: '免费版',
    code: 'free',
    description: '基础功能，适合个人体验',
    price: 0,
    billingCycle: 'monthly',
    isActive: true,
    features: [
      { name: '每月 100 条消息', enabled: true },
      { name: '1 个设备', enabled: true },
      { name: '基础技能', enabled: true },
      { name: '社区支持', enabled: true },
    ],
    quotas: {
      maxDevices: 1,
      maxMessagesPerMonth: 100,
      maxTokensPerMonth: 50000,
      maxSkills: 3,
    },
  },
  {
    id: 'basic',
    name: '基础版',
    code: 'basic',
    description: '更多功能，适合日常使用',
    price: 2900,
    billingCycle: 'monthly',
    isActive: true,
    features: [
      { name: '每月 1000 条消息', enabled: true },
      { name: '2 个设备', enabled: true },
      { name: '全部技能', enabled: true },
      { name: '邮件支持', enabled: true },
    ],
    quotas: {
      maxDevices: 2,
      maxMessagesPerMonth: 1000,
      maxTokensPerMonth: 500000,
      maxSkills: 10,
    },
  },
  {
    id: 'pro',
    name: '专业版',
    code: 'pro',
    description: '高级功能，适合重度用户',
    price: 9900,
    billingCycle: 'monthly',
    isActive: true,
    features: [
      { name: '每月 5000 条消息', enabled: true },
      { name: '5 个设备', enabled: true },
      { name: '全部技能 + 优先访问', enabled: true },
      { name: '优先支持', enabled: true },
      { name: 'API 访问', enabled: true },
    ],
    quotas: {
      maxDevices: 5,
      maxMessagesPerMonth: 5000,
      maxTokensPerMonth: 2000000,
      maxSkills: -1,
    },
  },
  {
    id: 'enterprise',
    name: '企业版',
    code: 'enterprise',
    description: '定制方案，适合团队使用',
    price: 29900,
    billingCycle: 'monthly',
    isActive: true,
    features: [
      { name: '无限消息', enabled: true },
      { name: '无限设备', enabled: true },
      { name: '全部功能', enabled: true },
      { name: '专属客服', enabled: true },
      { name: 'SLA 保障', enabled: true },
      { name: '定制开发', enabled: true },
    ],
    quotas: {
      maxDevices: -1,
      maxMessagesPerMonth: -1,
      maxTokensPerMonth: -1,
      maxSkills: -1,
    },
  },
]

/**
 * 订阅计划管理页面
 */
export default function PlansPage() {
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">订阅计划</h1>
          <p className="text-muted-foreground">管理系统订阅计划</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          新建计划
        </Button>
      </div>

      {/* 计划列表 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {mockPlans.map((plan) => (
          <Card key={plan.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plan.name}</CardTitle>
                <Badge variant={plan.isActive ? 'success' : 'secondary'}>
                  {plan.isActive ? '启用' : '禁用'}
                </Badge>
              </div>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 价格 */}
              <div>
                <span className="text-3xl font-bold">
                  {plan.price === 0 ? '免费' : formatCurrency(plan.price)}
                </span>
                {plan.price > 0 && (
                  <span className="text-muted-foreground">/月</span>
                )}
              </div>

              {/* 功能列表 */}
              <ul className="space-y-2 text-sm">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {feature.name}
                  </li>
                ))}
              </ul>

              {/* 配额 */}
              <div className="pt-4 border-t space-y-1 text-sm text-muted-foreground">
                <p>设备上限: {plan.quotas.maxDevices === -1 ? '无限' : plan.quotas.maxDevices}</p>
                <p>
                  月消息上限:{' '}
                  {plan.quotas.maxMessagesPerMonth === -1
                    ? '无限'
                    : plan.quotas.maxMessagesPerMonth.toLocaleString()}
                </p>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="mr-1 h-3 w-3" />
                  编辑
                </Button>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
