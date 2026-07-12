import { perks, stats } from '~/data/catalog'
import type { Gender, Perk } from '~/data/catalog'
import { emptyBuild, type Build } from '~/utils/planner'

export interface SavedBuild { id: string; createdAt: string; updatedAt: string; build: Build }
export interface LegacySavedBuild { id: string; savedAt?: string; createdAt?: string; updatedAt?: string; build: Build }

export function cloneBuild(value: Build) {
  return JSON.parse(JSON.stringify(value)) as Build
}

export function normalizeBuild(value: unknown, availablePerks: Perk[] = perks): Build | null {
  if (!value || typeof value !== 'object') return null
  const perksById = new Map(availablePerks.map((perk) => [perk.id, perk]))
  const raw = value as Partial<Build>
  if (raw.version !== 1 || !raw.stats || !raw.selectedRanks || !raw.priority || !isGender(raw.gender)) return null
  const normalized = emptyBuild()
  normalized.name = typeof raw.name === 'string' ? raw.name.slice(0, 80) : normalized.name
  normalized.characterName = typeof raw.characterName === 'string' ? raw.characterName.slice(0, 80) : ''
  normalized.gender = raw.gender
  const targetLevel = raw.targetLevel
  normalized.targetLevel = typeof targetLevel === 'number' && Number.isInteger(targetLevel) && targetLevel >= 1 && targetLevel <= 999 ? targetLevel : 60
  for (const stat of stats) {
    const statValue = raw.stats[stat]
    if (!Number.isInteger(statValue) || statValue < 1 || statValue > 10) return null
    normalized.stats[stat] = statValue
    normalized.bobbleheads[stat] = Boolean(raw.bobbleheads?.[stat])
  }
  normalized.bookStat = raw.bookStat && stats.includes(raw.bookStat) ? raw.bookStat : null
  for (const [id, rank] of Object.entries(raw.selectedRanks)) {
    const perk = perksById.get(id)
    if (!perk || perk.gender && perk.gender !== normalized.gender || !Number.isInteger(rank) || rank < 1 || rank > perk.ranks.length) continue
    normalized.selectedRanks[id] = rank
  }
  const selected = new Set(Object.keys(normalized.selectedRanks))
  normalized.priority = raw.priority.filter((id): id is string => typeof id === 'string' && selected.has(id))
  return normalized
}

function isGender(value: unknown): value is Gender {
  return value === 'female' || value === 'male'
}
