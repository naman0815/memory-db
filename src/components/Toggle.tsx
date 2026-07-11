export function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  ariaLabel?: string
}) {
  return (
    <span className="toggle-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
      />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
    </span>
  )
}
