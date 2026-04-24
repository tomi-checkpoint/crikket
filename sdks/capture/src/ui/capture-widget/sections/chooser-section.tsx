import { useRef } from "react"
import { Button } from "../components/primitives/button"

export function ChooserSection(props: {
  busy: boolean
  supportsDisplayMedia: boolean
  onStartVideo: () => void
  onTakeScreenshot: () => void
  onPickScreenshotFile: (file: File | Blob) => void
}): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const canVideo = props.supportsDisplayMedia

  const handlePickClick = () => {
    fileInputRef.current?.click()
  }
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file) props.onPickScreenshotFile(file)
  }

  // Screenshot works everywhere: real display-media on desktop, DOM fallback
  // on mobile. Record Video needs getDisplayMedia, so we hide it on devices
  // that don't support it rather than letting the user click into an error.
  // Upload is always available as an override or manual path.
  const columns = canVideo ? "grid-cols-3" : "grid-cols-2"

  return (
    <section className="grid gap-4 p-5">
      <p className="m-0 text-muted-foreground text-sm">
        Choose how to capture the issue.
      </p>
      <div className={`grid ${columns} gap-2`}>
        <Button
          className="w-full"
          disabled={props.busy}
          onClick={props.onTakeScreenshot}
          type="button"
        >
          Take Screenshot
        </Button>
        {canVideo ? (
          <Button
            className="w-full"
            disabled={props.busy}
            onClick={props.onStartVideo}
            type="button"
            variant="outline"
          >
            Record Video
          </Button>
        ) : null}
        <Button
          className="w-full"
          disabled={props.busy}
          onClick={handlePickClick}
          type="button"
          variant="outline"
        >
          Upload Image
        </Button>
      </div>
      {canVideo ? null : (
        <p className="m-0 text-muted-foreground text-xs">
          Video recording isn&apos;t supported on this device. Screenshot and
          upload still work.
        </p>
      )}
      <input
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
    </section>
  )
}
