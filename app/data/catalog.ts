import rawNames from './source/fallout4.names.json'
import rawPerks from './source/fallout4.special-perks.json'
import rawStats from './source/fallout4.special-stats.json'

export const stats = rawStats.stats as Stat[]
export type Stat = 'Strength' | 'Perception' | 'Endurance' | 'Charisma' | 'Intelligence' | 'Agility' | 'Luck'
export type Gender = 'male' | 'female'

export interface Rank {
  rank: number
  dlc: string
  id: string
  level: number
  description: string
}

export interface Perk {
  id: string
  name: string
  stat: { name: Stat; value: number }
  ranks: Rank[]
  gender?: Gender
}

interface RawRank extends Omit<Rank, 'level'> { level?: number; levle?: number }
interface RawPerk { name: string; stat: { name: Stat; value: number }; ranks: RawRank[] }

const genderRequirements: Record<string, Gender> = {
  'Lady Killer': 'male',
  'Black Widow': 'female',
  Aquaboy: 'male',
  Aquagirl: 'female',
  'Party Boy': 'male',
  'Pary Girl': 'female',
  'Action Boy': 'male',
  'Action Girl': 'female'
}

export const perks: Perk[] = (rawPerks.special as RawPerk[]).map((perk) => ({
  id: `${perk.stat.name}-${perk.stat.value}-${perk.name}`.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'),
  name: perk.name,
  stat: perk.stat,
  ranks: perk.ranks.map((rank) => ({
    rank: rank.rank,
    dlc: rank.dlc,
    id: rank.id,
    level: rank.level ?? rank.levle ?? 1,
    description: rank.description
  })),
  gender: genderRequirements[perk.name]
}))

export const voicedNames = new Set((rawNames.names as string[]).map((name) => name.toLocaleLowerCase()))
export const initialPointBudget = rawStats.initialStatPoints
