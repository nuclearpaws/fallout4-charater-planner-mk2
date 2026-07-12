import { stats, type Stat } from '../data/catalog'
import { effectiveStat, type Build } from './planner'

export interface SpeechCheckChance {
  label: 'Yellow' | 'Orange' | 'Red'
  chance: number
  difficulty: number
}

export interface PlayerDerivedStats {
  effectiveStats: Record<Stat, number>
  carryWeight: number
  actionPoints: number
  maxSettlers: number
  buyPriceMultiplier: number
  sellPriceMultiplier: number
  xpMultiplier: number
  meleeDamageMultiplier: number
  speechChecks: SpeechCheckChance[]
  hitPointsByLevel: Array<{ level: number; hitPoints: number }>
}

const speechDifficulties: Array<{ label: SpeechCheckChance['label']; difficulty: number }> = [
  { label: 'Yellow', difficulty: 35 },
  { label: 'Orange', difficulty: 50 },
  { label: 'Red', difficulty: 65 }
]

export function derivedPlayerStats(build: Build): PlayerDerivedStats {
  const effectiveStats = Object.fromEntries(stats.map((stat) => [stat, effectiveStat(build, stat)])) as Record<Stat, number>
  const strength = effectiveStats.Strength
  const endurance = effectiveStats.Endurance
  const charisma = effectiveStats.Charisma
  const intelligence = effectiveStats.Intelligence
  const agility = effectiveStats.Agility
  return {
    effectiveStats,
    carryWeight: 200 + strength * 10,
    actionPoints: 60 + agility * 10,
    maxSettlers: 10 + charisma,
    buyPriceMultiplier: buyPriceMultiplier(charisma),
    sellPriceMultiplier: sellPriceMultiplier(charisma),
    xpMultiplier: 1 + intelligence * 0.03,
    meleeDamageMultiplier: 1 + strength * 0.1,
    speechChecks: speechDifficulties.map(({ label, difficulty }) => ({ label, difficulty, chance: speechChance(charisma, difficulty) })),
    hitPointsByLevel: Array.from({ length: build.targetLevel }, (_, index) => {
      const level = index + 1
      return { level, hitPoints: hitPointsAtLevel(level, endurance) }
    })
  }
}

export function hitPointsAtLevel(level: number, endurance: number) {
  return Math.floor(80 + endurance * 5 + Math.max(0, level - 1) * (2.5 + endurance / 2))
}

export function speechChance(charisma: number, difficulty: number) {
  return Math.max(0, Math.min(100, charisma * 15 - difficulty))
}

export function buyPriceMultiplier(charisma: number) {
  return Math.max(1.2, 3.5 - charisma * 0.15)
}

export function sellPriceMultiplier(charisma: number) {
  return Math.min(0.8, 0.25 + charisma * 0.015)
}
