/**
 * 用户积分详情页
 *
 * 展示用户积分余额、流水记录，支持管理员发放积分
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ROUTES, CREDIT_TYPE_LABELS, CREDIT_SOURCE_LABELS } from '@/lib/constants'
import { formatDateTime, formatNumber } from '@/lib/utils'
import { useCreditBalance, useCreditHistory, useGrantCredits } from '@/hooks/useCredits'
import type { CreditTransaction } from '@/types/credits'

/**
 * 流水类型对应的 Badge 样式
 */
const TYPE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  earn: 'default',
  consume: 'destructive',
  expire: 'secondary',
  refund: 'outline',
  admin_adjust: 'default',
}

/**
 * 用户积分详情页组件
 */
export default function UserCreditsPage() {
  const { userId } = useParams<{ userId: string }>()
  const [offset, setOffset] = useState(0)
  const limit = 50
  const [grantDialogOpen, setGrantDialogOpen] = useState(false)
  const [selectedTxn, setSelectedTxn] = useState<CreditTransaction | null>(null)

  /** 发放积分表单 */
  const [grantForm, setGrantForm] = useState({
    amount: '100',
    expiryMonths: '3',
    description: '',
    adminNote: '',
  })

  const { data: balance, isLoading: balanceLoading, error: balanceError } = useCreditBalance(userId ?? '')
  const { data: history, isLoading: historyLoading, isFetching } = useCreditHistory(
    userId ?? '',
    { limit, offset },
  )
  const grantMutation = useGrantCredits()

  /**
   * 提交发放积分
   */
  const handleGrant = async () => {
    if (!userId) return
    const amount = parseInt(grantForm.amount, 10)
    const expiryMonths = parseInt(grantForm.expiryMonths, 10)

    if (isNaN(amount) || amount <= 0) {
      alert('积分数量必须为正整数')
      return
    }
    if (isNaN(expiryMonths) || expiryMonths <= 0) {
      alert('有效期必须为正整数')
      return
    }

    try {
      await grantMutation.mutateAsync({
        userId,
        request: {
          amount,
          expiryMonths,
          description: grantForm.description.trim() || undefined,
          adminNote: grantForm.adminNote.trim() || undefined,
        },
      })
      setGrantDialogOpen(false)
      setGrantForm({ amount: '100', expiryMonths: '3', description: '', adminNote: '' })
    } catch (err) {
      alert(err instanceof Error ? err.message : '发放失败')
    }
  }

  /** 上一页 */
  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - limit))
  }

  /** 判断是否还有下一页 */
  const hasMore = history?.meta ? history.meta.page < history.meta.totalPages : false

  /** 下一页 */
  const handleNextPage = () => {
    if (hasMore) {
      setOffset(offset + limit)
    }
  }

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        未指定用户 ID
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={ROUTES.CREDITS}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">用户积分详情</h1>
            <p className="text-sm text-muted-foreground font-mono">{userId}</p>
          </div>
        </div>
        <Button onClick={() => setGrantDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          发放积分
        </Button>
      </div>

      {/* 余额统计卡片 */}
      {balanceLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : balanceError ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            未找到该用户的积分账户
          </CardContent>
        </Card>
      ) : balance ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">当前余额</p>
              <p className="text-2xl font-bold text-primary">{formatNumber(balance.totalBalance)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">累计获得</p>
              <p className="text-2xl font-bold text-green-600">{formatNumber(balance.totalEarned)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">累计消费</p>
              <p className="text-2xl font-bold text-red-600">{formatNumber(balance.totalConsumed)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">已过期</p>
              <p className="text-2xl font-bold text-muted-foreground">{formatNumber(balance.totalExpired)}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* 积分流水 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">积分流水</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {historyLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : !history || history.data.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">暂无流水记录</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                      <th className="p-3 font-medium">时间</th>
                      <th className="p-3 font-medium">类型</th>
                      <th className="p-3 font-medium">来源</th>
                      <th className="p-3 font-medium">变动</th>
                      <th className="p-3 font-medium">余额</th>
                      <th className="p-3 font-medium">描述</th>
                      <th className="p-3 font-medium">详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.map((txn) => (
                      <tr key={txn.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(txn.createdAt)}
                        </td>
                        <td className="p-3">
                          <Badge variant={TYPE_BADGE_VARIANT[txn.type] ?? 'secondary'}>
                            {CREDIT_TYPE_LABELS[txn.type] ?? txn.type}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs">
                          {CREDIT_SOURCE_LABELS[txn.source] ?? txn.source}
                        </td>
                        <td className="p-3 font-mono text-xs">
                          <span className={txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {txn.amount >= 0 ? `+${txn.amount}` : txn.amount}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs">{txn.balanceAfter}</td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">
                          {txn.description ?? '-'}
                        </td>
                        <td className="p-3">
                          {txn.metadata && Object.keys(txn.metadata).length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setSelectedTxn(txn)}
                            >
                              <Info className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              <div className="flex items-center justify-between p-3 border-t">
                <span className="text-xs text-muted-foreground">
                  第 {offset + 1}-{offset + history.data.length} 条
                  {isFetching && '（加载中...）'}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={offset === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={!hasMore}
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

      {/* 发放积分 Dialog */}
      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发放积分</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>目标用户</Label>
              <Input value={userId} disabled />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grant-amount">积分数量</Label>
                <Input
                  id="grant-amount"
                  type="number"
                  min="1"
                  value={grantForm.amount}
                  onChange={(e) => setGrantForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grant-expiry">有效期（月）</Label>
                <Input
                  id="grant-expiry"
                  type="number"
                  min="1"
                  value={grantForm.expiryMonths}
                  onChange={(e) => setGrantForm((prev) => ({ ...prev, expiryMonths: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="grant-description">描述（对用户可见）</Label>
              <Input
                id="grant-description"
                placeholder="例如：客服补偿"
                value={grantForm.description}
                onChange={(e) => setGrantForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grant-note">管理员备注（仅内部可见）</Label>
              <Textarea
                id="grant-note"
                placeholder="记录发放原因..."
                value={grantForm.adminNote}
                onChange={(e) => setGrantForm((prev) => ({ ...prev, adminNote: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleGrant} disabled={grantMutation.isPending}>
              {grantMutation.isPending ? '发放中...' : '确认发放'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 流水详情 Dialog */}
      <Dialog open={!!selectedTxn} onOpenChange={(open) => { if (!open) setSelectedTxn(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>流水详情</DialogTitle>
          </DialogHeader>
          {selectedTxn && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">ID: </span>
                  <span className="font-mono text-xs">{selectedTxn.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">时间: </span>
                  <span>{formatDateTime(selectedTxn.createdAt)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">类型: </span>
                  <Badge variant={TYPE_BADGE_VARIANT[selectedTxn.type] ?? 'secondary'}>
                    {CREDIT_TYPE_LABELS[selectedTxn.type] ?? selectedTxn.type}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">来源: </span>
                  <span>{CREDIT_SOURCE_LABELS[selectedTxn.source] ?? selectedTxn.source}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">变动: </span>
                  <span className={`font-mono ${selectedTxn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedTxn.amount >= 0 ? `+${selectedTxn.amount}` : selectedTxn.amount}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">余额: </span>
                  <span className="font-mono">{selectedTxn.balanceAfter}</span>
                </div>
              </div>
              {selectedTxn.description && (
                <div>
                  <span className="text-muted-foreground">描述: </span>
                  <span>{selectedTxn.description}</span>
                </div>
              )}
              {selectedTxn.metadata && Object.keys(selectedTxn.metadata).length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1">元数据:</p>
                  <pre className="rounded bg-muted p-3 text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedTxn.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
