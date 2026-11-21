import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const PANE = 'usage-glance'
// Bumped each second so countdowns redraw.
const tick = atom({ plugin: 'usage-glance', key: 'tick' } as const, 0, {
  shape: 'tick-1',
})

const SHORT: Record<string, string> = { five_hour: '5h', seven_day: '7d', context: 'Ctx' }

const WINDOWS: Record<string, { label: string; spanMs: number }> = {
  five_hour: { label: 'Session', spanMs: 5 * 3_600_000 },
  seven_day: { label: 'Week', spanMs: 7 * 24 * 3_600_000 },
}

const bar = (pct: number, width: number) => {
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

// Filled = usage; the dim │ marks how far through the window time has gone.
const trackBar = (pct: number, elapsed: number | undefined, width: number) => {
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * width)
  const mark = elapsed === undefined ? -1 : Math.min(width - 1, Math.round((elapsed / 100) * (width - 1)))
  return Array.from({ length: width }, (_, i) => (i === mark ? '│' : i < filled ? '█' : '░')).join('')
}

// Coarse (no seconds) so the row changes rarely; the cache uses m:ss below.
const coarse = (ms: number) => {
  const m = Math.max(0, Math.ceil(ms / 60000))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
}
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const dur = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${String(s % 60).padStart(2, '0')}s`
}

// Soft peach normally, soft yellow as it climbs, clay-red when high.
const CLAY = '#F2B38C'
const KRAFT = '#E8C97A'
const ALERT = '#BF4D43'
const tone = (pct: number) => (pct >= 90 ? ALERT : pct >= 70 ? KRAFT : CLAY)
// Fixed-width cells so the row never shifts as digits change.
const cell = (t: string, n: number) => t.padStart(n, ' ')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    $.clock.every(1000, () => update($, tick, n => n + 1))

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await read($, tick)
    const now = await $.clock.now()
    const { rateLimits, context } = await $.session.usage()
    const ctx = context.percent
    const windows = rateLimits.filter(r => WINDOWS[r.kind])

    if (e.props.hasSurvey || (windows.length === 0 && ctx == null)) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    // Shrink to the band's width: first the bars, then the reset countdowns,
    // then the labels, so it keeps fitting on one line as the window narrows.
    // Keep a few cells spare so a rounding or border cell can never tip it onto a second line.
    const cols = e.props.bodyColumns - 4
    const sections = windows.length + (ctx != null ? 1 : 0)
    type Tier = { isShort: boolean; hasReset: boolean }
    const narrowest: Tier = { isShort: true, hasReset: false }
    const tiers: Tier[] = [
      { isShort: false, hasReset: true },
      { isShort: false, hasReset: false },
      narrowest,
    ]
    const labelOf = (kind: string, isShort: boolean) =>
      isShort ? (SHORT[kind] ?? kind) : (WINDOWS[kind]?.label ?? 'Context')
    const kinds = [...windows.map(r => r.kind), ...(ctx != null ? ['context'] : [])]
    const barFor = (t: Tier) => {
      const fixed = kinds.reduce(
        (n, k) =>
          n + labelOf(k, t.isShort).length + 1 + 5 + 1 + (t.hasReset && k !== 'context' ? 6 : 0),
        0,
      ) + 3 * (sections - 1)
      return Math.floor((cols - fixed) / sections)
    }
    const tier = tiers.find(t => barFor(t) >= 5) ?? narrowest
    const barW = Math.min(10, Math.max(2, barFor(tier)))
    const divider = (
      <Box marginRight={1} marginLeft={1}><Text dimColor>┊</Text></Box>
    )

    return (
      <Box>
        {windows.map((r, i) => {
          const w = WINDOWS[r.kind]
          if (!w) return null
          const resetMs = r.resetsAt ? Date.parse(r.resetsAt) - now : undefined
          const elapsed = resetMs === undefined
            ? undefined
            : Math.min(100, Math.max(0, ((w.spanMs - resetMs) / w.spanMs) * 100))
          const label = labelOf(r.kind, tier.isShort)
          return (
            <Box key={r.kind} flexShrink={0}>
              {i > 0 && divider}
              <Box width={label.length + 1}><Text dimColor>{label}</Text></Box>
              <Box width={barW + 1}><Text color={tone(r.percentUsed)}>{trackBar(r.percentUsed, elapsed, barW)}</Text></Box>
              <Box width={5} justifyContent="flex-end"><Text color={tone(r.percentUsed)}>{`${Math.round(r.percentUsed)}%`}</Text></Box>
              {tier.hasReset && (
                <Box width={6} justifyContent="flex-end"><Text dimColor>{resetMs === undefined ? '' : coarse(resetMs)}</Text></Box>
              )}
            </Box>
          )
        })}
        {ctx != null && (
          <Box flexShrink={0}>
            {windows.length > 0 && divider}
            <Box width={labelOf('context', tier.isShort).length + 1}><Text dimColor>{labelOf('context', tier.isShort)}</Text></Box>
            <Box width={barW + 1}><Text color={tone(ctx)}>{bar(ctx, barW)}</Text></Box>
            <Box width={5} justifyContent="flex-end"><Text color={tone(ctx)}>{`${Math.round(ctx)}%`}</Text></Box>
          </Box>
        )}
      </Box>
    )
  })
}
