/**
 * 管理员管理页面
 *
 * 提供管理员列表查看、创建、编辑、状态管理等功能
 * 仅 super_admin 角色可访问
 */

import { useState, useCallback } from 'react'
import {
  Search,
  MoreHorizontal,
  UserX,
  UserCheck,
  Key,
  RefreshCw,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime, cn } from '@/lib/utils'
import { ADMIN_ROLE_LABELS, ADMIN_STATUS_LABELS } from '@/lib/constants'
