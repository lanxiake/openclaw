import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Tabs 组件上下文
 */
interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined)

/**
 * 使用 Tabs 上下文
 */
function useTabsContext() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider')
  }
  return context
}

/**
 * Tabs 根组件
 */
interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ defaultValue, value: controlledValue, onValueChange, children, className }, ref) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? '')

    const value = controlledValue ?? uncontrolledValue
    const handleValueChange = React.useCallback((newValue: string) => {
      if (onValueChange) {
        onValueChange(newValue)
      } else {
        setUncontrolledValue(newValue)
      }
    }, [onValueChange])

    return (
      <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
        <div ref={ref} className={cn('w-full', className)}>
          {children}
        </div>
      </TabsContext.Provider>
    )
  }
)
Tabs.displayName = 'Tabs'

/**
 * TabsList 组件
 */
interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        className
      )}
      {...props}
    />
  )
)
TabsList.displayName = 'TabsList'

/**
 * TabsTrigger 组件
 */
interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const context = useTabsContext()
    const isActive = context.value === value

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          isActive
            ? 'bg-background text-foreground shadow-sm'
            : 'hover:bg-background/50 hover:text-foreground',
          className
        )}
        onClick={() => context.onValueChange(value)}
        {...props}
      />
    )
  }
)
TabsTrigger.displayName = 'TabsTrigger'

/**
 * TabsContent 组件
 */
interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = useTabsContext()
    const isActive = context.value === value

    if (!isActive) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
