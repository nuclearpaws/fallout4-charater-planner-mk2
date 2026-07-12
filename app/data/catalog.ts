import rawDlcs from './source/fallout4.dlcs.json'
import rawNames from './source/fallout4.names.json'
import rawPerks from './source/fallout4.special-perks.json'
import rawStats from './source/fallout4.special-stats.json'

export const stats = rawStats.stats as Stat[]
export type Stat = 'Strength' | 'Perception' | 'Endurance' | 'Charisma' | 'Intelligence' | 'Agility' | 'Luck'
export type Gender = 'male' | 'female'

export interface Dlc {
  name: string
  id: string
}

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
export const dlcs = rawDlcs.dlcs as Dlc[]
export const specialStatDescriptions: Record<Stat, string> = {
  Strength: 'Strength affects melee damage and carry weight. Higher Strength unlocks perks focused on melee weapons, armor crafting, heavy weapons, and power armor charges.',
  Perception: 'Perception affects V.A.T.S. weapon accuracy. Higher Perception unlocks perks for rifles, explosives, lockpicking, targeting limbs, and better awareness.',
  Endurance: 'Endurance affects maximum health and sprinting stamina. Higher Endurance unlocks perks for toughness, radiation resistance, cannibalism, solar bonuses, and survival durability.',
  Charisma: 'Charisma affects persuasion, settlement population, and vendor prices. Higher Charisma unlocks perks for companions, intimidation, trading, local leaders, and wasteland creatures.',
  Intelligence: 'Intelligence affects experience gained. Higher Intelligence unlocks perks for hacking, medicine, weapon and science crafting, robotics, radiation weapons, and extra XP effects.',
  Agility: 'Agility affects Action Points and sneaking. Higher Agility unlocks perks for pistols, stealth, automatic weapons, action point economy, moving target, and rapid V.A.T.S. attacks.',
  Luck: 'Luck affects critical meter recharge and random fortune. Higher Luck unlocks perks for finding supplies, better criticals, mysterious help, ricochets, and powerful V.A.T.S. chains.'
}
