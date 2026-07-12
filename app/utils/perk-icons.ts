import { stats, type Perk, type Stat } from '~/data/catalog'

const statColumns = Object.fromEntries(stats.map((stat, index) => [stat, index + 1])) as Record<Stat, number>

const iconNameOverrides: Record<string, string> = {
  Rifleman: 'RifleMan',
  Pickpocket: 'PickPocket',
  Lifegiver: 'LifeGiver',
  'Black Widow': 'LadyKiller',
  Aquaboy: 'AquaBoy',
  Aquagirl: 'AquaBoy',
  'Pary Girl': 'PartyBoy',
  'Action Girl': 'ActionBoy',
  'Mr Sandman': 'MrSandman'
}

export function perkIconPath(perk: Perk) {
  const iconName = iconNameOverrides[perk.name] ?? perk.name.replaceAll(/[^A-Za-z0-9]/g, '')
  return `/images/perkicons/${perk.stat.value}.${statColumns[perk.stat.name]}.${iconName}.png`
}

export function statHeaderIconPath(stat: Stat) {
  return `/images/perkicons/0.${statColumns[stat]}.${stat}.png`
}
