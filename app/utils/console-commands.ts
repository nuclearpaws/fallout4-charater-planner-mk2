import { stats, type Perk, type Stat } from '../data/catalog'
import { effectiveStat, optimize, type Build, type PlanAction } from './planner'

const statActorValues: Record<Stat, string> = {
  Strength: 'strength',
  Perception: 'perception',
  Endurance: 'endurance',
  Charisma: 'charisma',
  Intelligence: 'intelligence',
  Agility: 'agility',
  Luck: 'luck'
}

export interface ConsoleCommandPreview {
  commands: string
  hasLoadOrderPlaceholders: boolean
}

export type DlcLoadOrder = Record<string, string>

export function toConsoleCommands(build: Build, perks: Perk[], dlcLoadOrder: DlcLoadOrder = {}): ConsoleCommandPreview {
  const plan = optimize(build, perks)
  const finalLevel = plan.at(-1)?.level ?? 1
  const finalStats = finalEffectiveStats(build, plan)
  const byId = new Map(perks.map((perk) => [perk.id, perk]))
  const perkCommands = plan.flatMap((action) => {
    if (action.type !== 'perk' || !action.perkId || !action.perkRank) return []
    const perk = byId.get(action.perkId)
    const rank = perk?.ranks.find((item) => item.rank === action.perkRank)
    return rank ? [`player.addperk ${formatFormId(rank.id, rank.dlc, dlcLoadOrder)}`] : []
  })

  const commands = [
    `player.setlevel ${finalLevel}`,
    ...stats.map((stat) => `player.setav ${statActorValues[stat]} ${finalStats[stat]}`),
    ...perkCommands
  ]

  return {
    commands: commands.join('\n'),
    hasLoadOrderPlaceholders: perkCommands.some((command) => command.includes('xx'))
  }
}

function finalEffectiveStats(build: Build, plan: PlanAction[]) {
  const finalBase = { ...build.stats }
  for (const action of plan) {
    if (action.type !== 'stat') continue
    const match = action.label.match(/^Raise (.+) to (\d+)$/)
    if (!match) continue
    const stat = match[1] as Stat
    if (stats.includes(stat)) finalBase[stat] = Number(match[2])
  }
  return Object.fromEntries(stats.map((stat) => [stat, effectiveStat({ ...build, stats: finalBase }, stat)])) as Record<Stat, number>
}

function formatFormId(id: string, dlc: string, dlcLoadOrder: DlcLoadOrder) {
  if (id.startsWith('xx')) return `${normalizeLoadOrder(dlcLoadOrder[dlc]) ?? 'xx'}${id.slice(2)}`
  return id.padStart(8, '0')
}

function normalizeLoadOrder(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized && /^[0-9a-f]{2}$/.test(normalized) ? normalized : null
}
