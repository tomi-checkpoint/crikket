import { Badge } from "../components/primitives/badge"
import { Button } from "../components/primitives/button"

export function ConsoleDock(props: {
  busy: boolean
  onStopConsole: () => void
  remainingTime: string
  zIndex: number
}): React.JSX.Element {
  return (
    <div
      className="fixed right-6 bottom-[76px] z-[var(--capture-z-index)] flex max-w-[320px] flex-col gap-1 rounded-2xl border bg-card px-3 py-2 text-card-foreground shadow-2xl"
      style={{ ["--capture-z-index" as string]: String(props.zIndex + 2) }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-2 rounded-full bg-foreground"
        />
        <Badge variant="secondary">Capturing console + steps</Badge>
        <span className="min-w-11 text-right font-mono text-muted-foreground text-xs">
          {props.remainingTime}
        </span>
        <Button
          disabled={props.busy}
          onClick={props.onStopConsole}
          size="sm"
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
      <p className="m-0 text-muted-foreground text-xs">
        Reproduce the issue, then open Report Issue and take a screenshot to
        finish.
      </p>
    </div>
  )
}
