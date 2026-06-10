"use client"

import type {
  BugReportStatus,
  BugReportVisibility,
} from "@crikket/shared/constants/bug-report"
import type { Priority } from "@crikket/shared/constants/priorities"
import { Button } from "@crikket/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@crikket/ui/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import { Input } from "@crikket/ui/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crikket/ui/components/ui/select"
import { CheckCircle2, SlidersHorizontal, Trash2 } from "lucide-react"
import { useState } from "react"

import {
  formatPriorityLabel,
  formatStatusLabel,
  formatVisibilityLabel,
  PRIORITY_FILTER_OPTIONS,
  STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
} from "./filters"

interface BugReportsBulkActionsProps {
  bulkStatus: BugReportStatus | ""
  bulkPriority: Priority | ""
  bulkVisibility: BugReportVisibility | ""
  bulkTagsInput: string
  isMutating: boolean
  onBulkStatusChange: (value: BugReportStatus | "") => void
  onBulkPriorityChange: (value: Priority | "") => void
  onBulkVisibilityChange: (value: BugReportVisibility | "") => void
  onBulkTagsChange: (value: string) => void
  onApplyUpdates: () => Promise<void>
  onApplyStatus: (value: BugReportStatus) => Promise<void>
  onRequestBulkDelete: () => void
}

export function BugReportsBulkActions({
  bulkStatus,
  bulkPriority,
  bulkVisibility,
  bulkTagsInput,
  isMutating,
  onBulkStatusChange,
  onBulkPriorityChange,
  onBulkVisibilityChange,
  onBulkTagsChange,
  onApplyUpdates,
  onApplyStatus,
  onRequestBulkDelete,
}: BugReportsBulkActionsProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const statusLabel = bulkStatus ? formatStatusLabel(bulkStatus) : "Status"
  const priorityLabel = bulkPriority
    ? formatPriorityLabel(bulkPriority)
    : "Priority"
  const visibilityLabel = bulkVisibility
    ? formatVisibilityLabel(bulkVisibility)
    : "Visibility"

  const hasPendingChanges =
    Boolean(bulkStatus) ||
    Boolean(bulkPriority) ||
    Boolean(bulkVisibility) ||
    bulkTagsInput.trim().length > 0

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className="flex-1 sm:flex-none"
              disabled={isMutating}
              size="sm"
              variant="outline"
            />
          }
        >
          <CheckCircle2 className="size-4" />
          Set status
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel>Set status to…</DropdownMenuLabel>
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => {
                void onApplyStatus(option.value)
              }}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={setIsEditorOpen} open={isEditorOpen}>
        <DialogTrigger
          render={
            <Button
              className="flex-1 sm:flex-none"
              size="sm"
              variant={hasPendingChanges ? "default" : "outline"}
            />
          }
        >
          <SlidersHorizontal className="size-4" />
          Bulk edit
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk edit selected reports</DialogTitle>
            <DialogDescription>
              Choose one or more fields. Only selected fields will be updated.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              onValueChange={(value) =>
                onBulkStatusChange(value as BugReportStatus)
              }
              value={bulkStatus}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{statusLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              onValueChange={(value) => onBulkPriorityChange(value as Priority)}
              value={bulkPriority}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{priorityLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              onValueChange={(value) =>
                onBulkVisibilityChange(value as BugReportVisibility)
              }
              value={bulkVisibility}
            >
              <SelectTrigger className="w-full sm:col-span-2">
                <SelectValue>{visibilityLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              className="sm:col-span-2"
              onChange={(event) => onBulkTagsChange(event.target.value)}
              placeholder="Tags (comma-separated)"
              value={bulkTagsInput}
            />
          </div>

          <DialogFooter>
            <Button
              disabled={isMutating}
              onClick={async () => {
                try {
                  await onApplyUpdates()
                  setIsEditorOpen(false)
                } catch {
                  // Errors are handled by parent toasts.
                }
              }}
              size="sm"
              variant="default"
            >
              Apply updates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 gap-2 sm:flex-none">
        <Button
          className="flex-1 sm:flex-none"
          disabled={isMutating}
          onClick={onRequestBulkDelete}
          size="sm"
          variant="destructive"
        >
          <Trash2 className="size-4" />
          Delete selected
        </Button>
      </div>
    </div>
  )
}
