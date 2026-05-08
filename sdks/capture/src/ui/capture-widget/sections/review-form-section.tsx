import { useEffect, useRef, useState } from "react"
import type { CaptureSubmissionDraft } from "../../../types"
import type { CaptureReviewSubmitOptions, CaptureUiState } from "../../types"
import { MediaPreview } from "../components/media-preview"
import { Button } from "../components/primitives/button"
import { Field, FieldError } from "../components/primitives/field"
import { Input } from "../components/primitives/input"
import { Label } from "../components/primitives/label"
import { Textarea } from "../components/primitives/textarea"
import { ScreenshotAnnotationEditor } from "../components/screenshot-annotation-editor"
import { SummaryStat } from "../components/summary-stat"
import { useReviewForm } from "../hooks/use-review-form"
import {
  capturePriorityOptions,
  captureSurfaceOptions,
} from "../utils/review-form-schema"
import {
  createAnnotatedScreenshotBlob,
  type ScreenshotAnnotation,
} from "../utils/screenshot-annotations"

interface ReviewFormSectionProps {
  formKey: string
  isSubmitting: boolean
  state: CaptureUiState
  onCancel: () => void
  onSubmit: (
    draft: CaptureSubmissionDraft,
    options?: CaptureReviewSubmitOptions
  ) => Promise<void>
}

export function ReviewFormSection({
  formKey,
  isSubmitting,
  state,
  onCancel,
  onSubmit,
}: ReviewFormSectionProps): React.JSX.Element {
  const [annotations, setAnnotations] = useState<ScreenshotAnnotation[]>([])
  const previousMediaObjectUrlRef = useRef(state.media?.objectUrl)

  useEffect(() => {
    if (previousMediaObjectUrlRef.current === state.media?.objectUrl) {
      return
    }

    previousMediaObjectUrlRef.current = state.media?.objectUrl
    setAnnotations([])
  }, [state.media?.objectUrl])

  const form = useReviewForm({
    initialDraft: state.reviewDraft,
    onSubmit: async (draft) => {
      let submitOptions: CaptureReviewSubmitOptions | undefined

      if (state.media?.captureType === "screenshot" && annotations.length > 0) {
        const screenshotBlobOverride = await createAnnotatedScreenshotBlob({
          annotations,
          imageUrl: state.media.objectUrl,
        })

        submitOptions = screenshotBlobOverride
          ? { screenshotBlobOverride }
          : undefined
      }

      onSubmit(draft, submitOptions)
    },
  })

  return (
    <section
      className="grid h-full min-h-0 gap-0 lg:grid-cols-[minmax(0,1.5fr)_360px]"
      key={formKey}
    >
      <div className="flex min-h-[320px] min-w-0 flex-col border-b bg-muted/20 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="font-medium text-sm">Review capture</p>
            <p className="text-muted-foreground text-xs">
              {state.media?.captureType === "screenshot"
                ? "Annotate the screenshot before submitting."
                : "Preview the recording before submitting."}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {state.media?.captureType === "screenshot" ? (
            <ScreenshotAnnotationEditor
              annotations={annotations}
              disabled={state.busy || isSubmitting}
              onChange={setAnnotations}
              src={state.media.objectUrl}
            />
          ) : (
            <div className="flex min-h-full items-center justify-center">
              <div className="aspect-video w-full overflow-hidden rounded-xl border border-border/70 bg-black">
                <MediaPreview media={state.media} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto p-5">
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-2">
            <SummaryStat label="Actions" value={state.summary.actions} />
            <SummaryStat label="Logs" value={state.summary.logs} />
            <SummaryStat
              label="Network"
              value={state.summary.networkRequests}
            />
          </div>

          {state.warnings.length > 0 ? (
            <ul className="m-0 grid gap-1 rounded-lg border bg-muted/40 px-4 py-3 pl-8 text-muted-foreground text-xs">
              {state.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <form className="grid gap-4" onSubmit={form.handleSubmit}>
            <Field data-invalid={Boolean(form.visibleErrors.title)}>
              <Label htmlFor={`${formKey}-title`}>Title</Label>
              <Input
                aria-invalid={Boolean(form.visibleErrors.title)}
                id={`${formKey}-title`}
                maxLength={200}
                onBlur={() => {
                  form.touchField("title")
                }}
                onChange={(event) => {
                  form.setFieldValue("title", event.currentTarget.value)
                }}
                placeholder="Enter a title (optional)"
                value={form.draft.title}
              />
              {form.visibleErrors.title ? (
                <FieldError errors={[form.visibleErrors.title]} />
              ) : null}
            </Field>

            <Field data-invalid={Boolean(form.visibleErrors.description)}>
              <Label htmlFor={`${formKey}-description`}>Summary</Label>
              <Textarea
                aria-invalid={Boolean(form.visibleErrors.description)}
                className="min-h-24 resize-y"
                id={`${formKey}-description`}
                maxLength={3000}
                onBlur={() => {
                  form.touchField("description")
                }}
                onChange={(event) => {
                  form.setFieldValue("description", event.currentTarget.value)
                }}
                placeholder="Briefly describe the issue"
                value={form.draft.description}
              />
              {form.visibleErrors.description ? (
                <FieldError errors={[form.visibleErrors.description]} />
              ) : null}
            </Field>

            <Field data-invalid={Boolean(form.visibleErrors.stepsToReproduce)}>
              <Label htmlFor={`${formKey}-steps`}>Steps to reproduce</Label>
              <Textarea
                aria-invalid={Boolean(form.visibleErrors.stepsToReproduce)}
                className="min-h-28 resize-y"
                id={`${formKey}-steps`}
                maxLength={4000}
                onBlur={() => {
                  form.touchField("stepsToReproduce")
                }}
                onChange={(event) => {
                  form.setFieldValue(
                    "stepsToReproduce",
                    event.currentTarget.value
                  )
                }}
                placeholder={"1. Open...\n2. Click...\n3. Observe..."}
                value={form.draft.stepsToReproduce ?? ""}
              />
              {form.visibleErrors.stepsToReproduce ? (
                <FieldError errors={[form.visibleErrors.stepsToReproduce]} />
              ) : null}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                data-invalid={Boolean(form.visibleErrors.expectedBehavior)}
              >
                <Label htmlFor={`${formKey}-expected`}>Expected behavior</Label>
                <Textarea
                  aria-invalid={Boolean(form.visibleErrors.expectedBehavior)}
                  className="min-h-24 resize-y"
                  id={`${formKey}-expected`}
                  maxLength={2000}
                  onBlur={() => {
                    form.touchField("expectedBehavior")
                  }}
                  onChange={(event) => {
                    form.setFieldValue(
                      "expectedBehavior",
                      event.currentTarget.value
                    )
                  }}
                  placeholder="What should happen?"
                  value={form.draft.expectedBehavior ?? ""}
                />
                {form.visibleErrors.expectedBehavior ? (
                  <FieldError errors={[form.visibleErrors.expectedBehavior]} />
                ) : null}
              </Field>

              <Field data-invalid={Boolean(form.visibleErrors.actualBehavior)}>
                <Label htmlFor={`${formKey}-actual`}>Actual behavior</Label>
                <Textarea
                  aria-invalid={Boolean(form.visibleErrors.actualBehavior)}
                  className="min-h-24 resize-y"
                  id={`${formKey}-actual`}
                  maxLength={2000}
                  onBlur={() => {
                    form.touchField("actualBehavior")
                  }}
                  onChange={(event) => {
                    form.setFieldValue(
                      "actualBehavior",
                      event.currentTarget.value
                    )
                  }}
                  placeholder="What happened instead?"
                  value={form.draft.actualBehavior ?? ""}
                />
                {form.visibleErrors.actualBehavior ? (
                  <FieldError errors={[form.visibleErrors.actualBehavior]} />
                ) : null}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(form.visibleErrors.surface)}>
                <Label htmlFor={`${formKey}-surface`}>Surface</Label>
                <select
                  aria-invalid={Boolean(form.visibleErrors.surface)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/60"
                  id={`${formKey}-surface`}
                  onBlur={() => {
                    form.touchField("surface")
                  }}
                  onChange={(event) => {
                    form.setFieldValue(
                      "surface",
                      event.currentTarget
                        .value as CaptureSubmissionDraft["surface"]
                    )
                  }}
                  value={form.draft.surface ?? "unknown"}
                >
                  {captureSurfaceOptions.map((surface) => (
                    <option key={surface.value} value={surface.value}>
                      {surface.label}
                    </option>
                  ))}
                </select>
                {form.visibleErrors.surface ? (
                  <FieldError errors={[form.visibleErrors.surface]} />
                ) : null}
              </Field>

              <Field data-invalid={Boolean(form.visibleErrors.priority)}>
                <Label htmlFor={`${formKey}-priority`}>Priority</Label>
                <select
                  aria-invalid={Boolean(form.visibleErrors.priority)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/60"
                  id={`${formKey}-priority`}
                  onBlur={() => {
                    form.touchField("priority")
                  }}
                  onChange={(event) => {
                    form.setFieldValue(
                      "priority",
                      event.currentTarget
                        .value as CaptureSubmissionDraft["priority"]
                    )
                  }}
                  value={form.draft.priority}
                >
                  {capturePriorityOptions.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
                {form.visibleErrors.priority ? (
                  <FieldError errors={[form.visibleErrors.priority]} />
                ) : null}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="w-full"
                disabled={state.busy || isSubmitting}
                type="submit"
              >
                Submit Report
              </Button>
              <Button
                className="w-full"
                disabled={state.busy || isSubmitting}
                onClick={onCancel}
                type="button"
                variant="outline"
              >
                Start Over
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
