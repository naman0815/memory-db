// Ported 1:1 from the Memory DB design mock (claude.ai/design) — currentColor
// SVGs so they inherit tile/button text color.

export type IconName =
  | 'heartCheck'
  | 'checkSquare'
  | 'receipt'
  | 'bolt'
  | 'person'
  | 'wallet'
  | 'plane'
  | 'shoe'
  | 'file'
  | 'plus'
  | 'mic'
  | 'send'
  | 'settings'
  | 'pin'
  | 'eye'
  | 'eyeOff'

const PATHS: Record<IconName, string> = {
  heartCheck:
    'M12 20.5s-7.5-4.6-9.8-9.2C.6 7.8 2.4 4.5 5.8 4c2-.3 3.7.6 4.9 2.2C11.9 4.6 13.6 3.7 15.6 4c2 .3 3.5 1.7 4 3.5|M15 12l1.6 1.7L20.5 10',
  checkSquare:
    'M8 12.5l2.6 2.6L16.5 9',
  receipt: 'M9 8.5h6M9 12.5h6M9 16h4',
  bolt: 'M13 7.5l-4.5 6H12l-1 4.5 5-6.5h-3.5l0.5-4z',
  person: 'M7 17.3c1-2.2 2.9-3.3 5-3.3s4 1.1 5 3.3',
  wallet: 'M3.5 9.5h13a3 3 0 013 3v0',
  plane: 'M8 15.5l8-5-1-1.7-9 2.7-2.3-1.7-1.2.6 1.7 2.6L8 15.5zM8 15.5l-.6 2.6 1.4.5 1.4-2.3',
  shoe: 'M6.5 15.5c0-2 1.4-3.6 2.4-4.8.7-.8 1-1.6 1-2.5h2.3c0 1.3.7 2 1.7 2.6l3.6 2.2c.8.5 1.4 1.3 1.4 2.3v.2H6.5z',
  file: 'M9 9.5h6M9 12.5h6M9 15.5h3.5',
  plus: 'M12 5v14M5 12h14',
  mic: 'M6 11a6 6 0 0012 0M12 17v3.5M9 20.5h6',
  send: 'M12 19V5M6 11l6-6 6 6',
  settings:
    'M12 3v2.4|M12 18.6V21|M4.75 6.5l2.1 1.2|M17.15 16.3l2.1 1.2|M3 12h2.4|M18.6 12H21|M4.75 17.5l2.1-1.2|M17.15 7.7l2.1-1.2',
  pin: 'M12 21s-6-5.86-6-10.29A6 6 0 0112 4.5a6 6 0 016 6.21C18 15.14 12 21 12 21z',
  eye: 'M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z',
  eyeOff:
    'M4.7 4.7l14.6 14.6|M9.9 6.2C10.6 6 11.3 5.9 12 5.9c6 0 9.5 6.1 9.5 6.1a17.6 17.6 0 01-3.2 4.2|M6.4 7.6A17.4 17.4 0 002.5 12S6 18.1 12 18.1c1.3 0 2.5-.3 3.5-.7|M9.9 12a2.1 2.1 0 003 2.9',
}

const OUTLINED: Set<IconName> = new Set(['checkSquare', 'person', 'wallet', 'plane', 'shoe', 'file'])

/** Icons that render an outer 24x24 rounded-square outline before the glyph path(s). */
function Frame({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.4" />
      {children}
    </svg>
  )
}

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths = PATHS[name].split('|')

  if (OUTLINED.has(name)) {
    return (
      <Frame size={size}>
        {name === 'person' && <circle cx="12" cy="10.3" r="2.6" stroke="currentColor" strokeWidth="1.3" />}
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            stroke="currentColor"
            strokeWidth={name === 'plane' || name === 'shoe' ? '1.1' : '1.3'}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {name === 'wallet' && <circle cx="16.3" cy="13.3" r="1.3" fill="currentColor" />}
      </Frame>
    )
  }

  if (name === 'heartCheck') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {paths.map((d, i) => (
          <path key={i} d={d} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
    )
  }

  if (name === 'receipt') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M6 3.5h12v17l-2.2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-1.8 1.5v-17z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d={paths[0]} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  }

  if (name === 'bolt') {
    return (
      <Frame size={size}>
        <path d={paths[0]} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
      </Frame>
    )
  }

  if (name === 'plus') {
    return (
      <svg width={size + 2} height={size + 2} viewBox="0 0 24 24" fill="none">
        <path d={paths[0]} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }

  if (name === 'mic') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.4" />
        <path d={paths[0]} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }

  if (name === 'send') {
    return (
      <svg width={size - 1} height={size - 1} viewBox="0 0 24 24" fill="none">
        <path d={paths[0]} stroke="var(--send-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (name === 'settings') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.4" />
        {paths.map((d, i) => (
          <path key={i} d={d} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        ))}
      </svg>
    )
  }

  if (name === 'pin') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d={paths[0]} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="12" cy="10.7" r="2.1" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    )
  }

  if (name === 'eye') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d={paths[0]} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    )
  }

  if (name === 'eyeOff') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {paths.map((d, i) => (
          <path key={i} d={d} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
    )
  }

  return null
}
