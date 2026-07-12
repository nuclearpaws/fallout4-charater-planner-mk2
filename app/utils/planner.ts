import type { Gender, Perk, Rank, Stat } from '../data/catalog'
import { initialPointBudget, stats } from '../data/catalog'

export interface Build {
  version: 1
  name: string
  characterName: string
  gender: Gender
  targetLevel: number
  stats: Record<Stat, number>
  bookStat: Stat | null
  bobbleheads: Record<Stat, boolean>
  selectedRanks: Record<string, number>
  priority: string[]
}

export interface PlanAction {
  level: number
  type: 'perk' | 'stat' | 'bobblehead'
  label: string
  detail: string
  perkId?: string
  requiredLevel?: number
  perkRank?: number
}

export function emptyBuild(): Build {
  const base = Object.fromEntries(stats.map((stat) => [stat, 1])) as Record<Stat, number>
  return {
    version: 1, name: 'Untitled build', characterName: '', gender: 'female', targetLevel: 60, stats: base,
    bookStat: null, bobbleheads: Object.fromEntries(stats.map((stat) => [stat, false])) as Record<Stat, boolean>,
    selectedRanks: {}, priority: []
  }
}

export function spentPoints(build: Build) {
  return Object.values(build.stats).reduce((total, value) => total + value - 1, 0)
}

export function effectiveStat(build: Build, stat: Stat, raisedBy = 0) {
  return build.stats[stat] + raisedBy + Number(build.bookStat === stat) + Number(build.bobbleheads[stat])
}

export function visiblePerks(perks: Perk[], gender: Gender) {
  return perks.filter((perk) => !perk.gender || perk.gender === gender)
}

export function selectedPerks(build: Build, perks: Perk[]) {
  return perks.filter((perk) => (build.selectedRanks[perk.id] ?? 0) > 0)
}

export function normalizePriority(build: Build, perks: Perk[]) {
  const selected = new Set(selectedPerks(build, perks).map((perk) => perk.id))
  return [...build.priority.filter((id) => selected.has(id)), ...[...selected].filter((id) => !build.priority.includes(id))]
}

function rankFor(perk: Perk, rank: number): Rank {
  const found = perk.ranks.find((item) => item.rank === rank)
  if (!found) throw new Error(`Missing ${perk.name} rank ${rank}`)
  return found
}

export function optimize(build: Build, perks: Perk[]): PlanAction[] {
  const selected = selectedPerks(build, visiblePerks(perks, build.gender))
  const byId = new Map(selected.map((perk) => [perk.id, perk]))
  const priority = normalizePriority(build, perks).filter((id) => byId.has(id))
  const progress: Record<string, number> = {}
  const raised: Partial<Record<Stat, number>> = {}
  const announcedBobbleheads = new Set<Stat>()
  const actions: PlanAction[] = []
  let level = 1

  while (Object.entries(build.selectedRanks).some(([id, target]) => (progress[id] ?? 0) < target && byId.has(id))) {
    const pending = priority.flatMap((id) => {
      const perk = byId.get(id)!
      const next = (progress[id] ?? 0) + 1
      if (next > (build.selectedRanks[perk.id] ?? 0)) return []
      return [{ perk, rank: rankFor(perk, next) }]
    })

    const firstWithStatGap = pending.find(({ perk }) => effectiveStat(build, perk.stat.name, raised[perk.stat.name] ?? 0) < perk.stat.value)
    if (firstWithStatGap) {
      const stat = firstWithStatGap.perk.stat.name
      const currentBase = build.stats[stat] + (raised[stat] ?? 0)
      if (currentBase >= 10) throw new Error(`${firstWithStatGap.perk.name} cannot meet its SPECIAL requirement.`)
      raised[stat] = (raised[stat] ?? 0) + 1
      actions.push({ level, type: 'stat', label: `Raise ${stat} to ${currentBase + 1}`, detail: `Needed for ${firstWithStatGap.perk.name}.` })
      level++
      continue
    }

    const ready = pending.find(({ rank }) => rank.level <= level)
    if (!ready) {
      level++
      continue
    }

    const stat = ready.perk.stat.name
    const withoutBobblehead = build.stats[stat] + (raised[stat] ?? 0) + Number(build.bookStat === stat)
    if (build.bobbleheads[stat] && withoutBobblehead < ready.perk.stat.value && !announcedBobbleheads.has(stat)) {
      announcedBobbleheads.add(stat)
      actions.push({ level, type: 'bobblehead', label: `Collect the ${stat} Bobblehead`, detail: `Required before ${ready.perk.name} rank ${ready.rank.rank}.`, perkId: ready.perk.id })
    }
    progress[ready.perk.id] = ready.rank.rank
    actions.push({ level, type: 'perk', label: `${ready.perk.name} rank ${ready.rank.rank}`, detail: ready.rank.description, perkId: ready.perk.id, requiredLevel: ready.rank.level, perkRank: ready.rank.rank })
    level++
  }
  return actions
}

export function finalPlannedLevel(build: Build, perks: Perk[]) {
  return optimize(build, perks).at(-1)?.level ?? 1
}

export function toMarkdown(build: Build, perks: Perk[]) {
  const plan = optimize(build, perks)
  const title = build.name || 'Fallout 4 build'
  const character = build.characterName ? ` for ${build.characterName}` : ''
  const special = stats.map((stat) => `- ${stat}: ${effectiveStat(build, stat)}${build.bobbleheads[stat] ? ' (bobblehead assumed)' : ''}`).join('\n')
  const steps = plan.map((action) => action.type === 'bobblehead'
    ? `- **Before level ${action.level}:** ${action.label} - ${action.detail}`
    : `- **Level ${action.level}:** ${action.label} - ${action.detail}`).join('\n')
  return `# ${title}${character}\n\n**Character:** ${build.gender}\n\n## Starting SPECIAL\n${special}\n\n**You're SPECIAL:** ${build.bookStat ? `+1 ${build.bookStat}` : 'Not assigned'}\n\n## Level-up guide\n${steps || '- No perks selected.'}\n`
}

export { initialPointBudget }
