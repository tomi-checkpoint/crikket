import {
  BUG_REPORT_VISIBILITY_OPTIONS,
  type BugReportVisibility,
} from "@crikket/shared/constants/bug-report"
import {
  PRIORITY_OPTIONS,
  type Priority,
} from "@crikket/shared/constants/priorities"
import type { CaptureSubmissionDraft } from "../../../types"

const priorityValues = new Set<string>(Object.values(PRIORITY_OPTIONS))
const visibilityValues = new Set<string>(
  Object.values(BUG_REPORT_VISIBILITY_OPTIONS)
)
const surfaceValues = new Set<string>([
  "frontend",
  "backend",
  "both",
  "unknown",
])
export type ReviewDraftErrors = Partial<
  Record<keyof CaptureSubmissionDraft, string>
>

export const capturePriorityOptions = [
  { label: "Critical", value: PRIORITY_OPTIONS.critical },
  { label: "High", value: PRIORITY_OPTIONS.high },
  { label: "Medium", value: PRIORITY_OPTIONS.medium },
  { label: "Low", value: PRIORITY_OPTIONS.low },
  { label: "None", value: PRIORITY_OPTIONS.none },
] as const

export const captureSurfaceOptions = [
  { label: "Unknown", value: "unknown" },
  { label: "Frontend / UI", value: "frontend" },
  { label: "Backend / API", value: "backend" },
  { label: "Both", value: "both" },
] as const

export function validateReviewDraft(
  value: CaptureSubmissionDraft
): ReviewDraftErrors | undefined {
  const errors: ReviewDraftErrors = {}

  if (value.title.length > 200) {
    errors.title = "Title must be at most 200 characters."
  }

  if (value.description.length > 3000) {
    errors.description = "Description must be at most 3000 characters."
  }

  if ((value.stepsToReproduce ?? "").length > 4000) {
    errors.stepsToReproduce = "Steps must be at most 4000 characters."
  }

  if ((value.expectedBehavior ?? "").length > 2000) {
    errors.expectedBehavior =
      "Expected behavior must be at most 2000 characters."
  }

  if ((value.actualBehavior ?? "").length > 2000) {
    errors.actualBehavior = "Actual behavior must be at most 2000 characters."
  }

  if (value.surface !== undefined && !surfaceValues.has(value.surface)) {
    errors.surface = "Select a valid surface."
  }

  if (!priorityValues.has(value.priority)) {
    errors.priority = "Select a valid priority."
  }

  if (
    value.visibility !== undefined &&
    !visibilityValues.has(value.visibility)
  ) {
    errors.visibility = "Select a valid visibility."
  }

  return Object.keys(errors).length > 0 ? errors : undefined
}

export function trimReviewDraftForSubmission(
  draft: CaptureSubmissionDraft
): CaptureSubmissionDraft {
  return {
    actualBehavior: draft.actualBehavior?.trim() ?? "",
    description: draft.description.trim(),
    expectedBehavior: draft.expectedBehavior?.trim() ?? "",
    priority: draft.priority,
    stepsToReproduce: draft.stepsToReproduce?.trim() ?? "",
    surface: surfaceValues.has(draft.surface ?? "") ? draft.surface : "unknown",
    title: draft.title.trim(),
    visibility: visibilityValues.has(draft.visibility ?? "")
      ? (draft.visibility as BugReportVisibility)
      : BUG_REPORT_VISIBILITY_OPTIONS.private,
  }
}

export type CapturePriority = Priority
