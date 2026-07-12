import { describe, expect, it } from 'vitest'
import { perks } from '../data/catalog'
import { decodeBuildHash, encodeBuildHash } from '../utils/build-url'
import { toConsoleCommands } from '../utils/console-commands'
import { emptyBuild, effectiveStat, finalPlannedLevel, initialPointBudget, optimize, spentPoints, toMarkdown } from '../utils/planner'

function perk(name: string) {
  const found = perks.find((item) => item.name === name)
  if (!found) throw new Error(`Missing test perk ${name}`)
  return found
}

describe('planner rules', () => {
  it('starts with 21 distributable points above the seven base points', () => {
    const build = emptyBuild()
    expect(build.targetLevel).toBe(60)
    expect(spentPoints(build)).toBe(0)
    build.stats.Strength = 10
    expect(initialPointBudget - spentPoints(build)).toBe(12)
  })

  it('combines the book and bobblehead with starting SPECIAL', () => {
    const build = emptyBuild()
    build.stats.Luck = 8
    build.bookStat = 'Luck'
    build.bobbleheads.Luck = true
    expect(effectiveStat(build, 'Luck')).toBe(10)
  })

  it('announces a bobblehead before the first perk rank that depends on it', () => {
    const build = emptyBuild()
    const bigLeagues = perk('Big Leagues')
    build.bobbleheads.Strength = true
    build.selectedRanks[bigLeagues.id] = 1
    build.priority = [bigLeagues.id]
    const route = optimize(build, perks)
    expect(route[0]).toMatchObject({ type: 'bobblehead', level: 1, label: 'Collect the Strength Bobblehead' })
    expect(route[1]).toMatchObject({ type: 'perk', level: 1, label: 'Big Leagues rank 1' })
  })

  it('associates a bobblehead prerequisite with only the perk that needs it', () => {
    const build = emptyBuild()
    const ironFist = perk('Iron Fist')
    const bigLeagues = perk('Big Leagues')
    build.bobbleheads.Strength = true
    build.selectedRanks[ironFist.id] = 1
    build.selectedRanks[bigLeagues.id] = 1
    build.priority = [ironFist.id, bigLeagues.id]

    const bobbleheadAction = optimize(build, perks).find((action) => action.type === 'bobblehead')
    expect(bobbleheadAction).toMatchObject({ perkId: bigLeagues.id })
  })

  it('announces the SPECIAL book before the first perk rank that depends on it', () => {
    const build = emptyBuild()
    const bigLeagues = perk('Big Leagues')
    build.bookStat = 'Strength'
    build.selectedRanks[bigLeagues.id] = 1
    build.priority = [bigLeagues.id]

    const route = optimize(build, perks)
    expect(route[0]).toMatchObject({ type: 'book', level: 1, label: `Get the You're SPECIAL book`, perkId: bigLeagues.id })
    expect(route[1]).toMatchObject({ type: 'perk', level: 1, label: 'Big Leagues rank 1' })
  })

  it('attributes the book before the bobblehead when both raise the same stat', () => {
    const build = emptyBuild()
    const rooted = perk('Rooted')
    const painTrain = perk('Pain Train')
    build.stats.Strength = 8
    build.bookStat = 'Strength'
    build.bobbleheads.Strength = true
    build.selectedRanks[rooted.id] = 1
    build.selectedRanks[painTrain.id] = 1
    build.priority = [rooted.id, painTrain.id]

    const route = optimize(build, perks)
    expect(route.find((action) => action.type === 'book')).toMatchObject({ level: 1, perkId: rooted.id })
    expect(route.find((action) => action.type === 'bobblehead')).toMatchObject({ perkId: painTrain.id })
  })

  it('raises SPECIAL before scheduling a selected perk that needs it', () => {
    const build = emptyBuild()
    const armorer = perk('Armorer')
    build.selectedRanks[armorer.id] = 1
    build.priority = [armorer.id]
    const route = optimize(build, perks)
    expect(route[0]).toMatchObject({ type: 'stat', level: 1, label: 'Raise Strength to 2' })
    expect(route[1]).toMatchObject({ type: 'stat', level: 2, label: 'Raise Strength to 3' })
    expect(route[2]).toMatchObject({ type: 'perk', level: 3, label: 'Armorer rank 1' })
    expect(finalPlannedLevel(build, perks)).toBe(3)
  })

  it('includes each perk rank minimum level in the generated route', () => {
    const build = emptyBuild()
    const ironFist = perk('Iron Fist')
    build.selectedRanks[ironFist.id] = 2
    build.priority = [ironFist.id]

    const rankTwo = optimize(build, perks).find((action) => action.label === 'Iron Fist rank 2')
    expect(rankTwo).toMatchObject({ level: 9, requiredLevel: 9, perkRank: 2 })
    expect(optimize(build, perks).filter((action) => action.type === 'empty').map((action) => action.level)).toContain(2)
  })

  it('fills target levels without selected perks as unfilled route entries', () => {
    const build = emptyBuild()
    const bigLeagues = perk('Big Leagues')
    build.targetLevel = 5
    build.stats.Strength = 2
    build.selectedRanks[bigLeagues.id] = 1
    build.priority = [bigLeagues.id]

    const route = optimize(build, perks)
    expect(route).toContainEqual(expect.objectContaining({ type: 'perk', level: 1, label: 'Big Leagues rank 1' }))
    expect(route.filter((action) => action.type === 'empty').map((action) => action.level)).toEqual([2, 3, 4, 5])
    expect(finalPlannedLevel(build, perks)).toBe(1)
  })

  it('includes prerequisite guidance in Markdown exports', () => {
    const build = emptyBuild()
    const bigLeagues = perk('Big Leagues')
    build.bobbleheads.Strength = true
    build.selectedRanks[bigLeagues.id] = 1
    build.priority = [bigLeagues.id]
    expect(toMarkdown(build, perks)).toContain('**Before level 1:** Collect the Strength Bobblehead')
  })

  it('includes SPECIAL book prerequisite guidance in Markdown exports', () => {
    const build = emptyBuild()
    const bigLeagues = perk('Big Leagues')
    build.bookStat = 'Strength'
    build.selectedRanks[bigLeagues.id] = 1
    build.priority = [bigLeagues.id]

    expect(toMarkdown(build, perks)).toContain(`**Before level 1:** Get the You're SPECIAL book`)
  })

  it('continues scheduling another perk after a selected perk reaches its final rank', () => {
    const build = emptyBuild()
    const ironFist = perk('Iron Fist')
    const bigLeagues = perk('Big Leagues')
    build.stats.Strength = 2
    build.selectedRanks[ironFist.id] = ironFist.ranks.length
    build.selectedRanks[bigLeagues.id] = 1
    build.priority = [ironFist.id, bigLeagues.id]

    const route = optimize(build, perks)
    expect(route).toContainEqual(expect.objectContaining({ label: 'Big Leagues rank 1' }))
    expect(route.filter((action) => action.type !== 'empty').at(-1)).toMatchObject({ label: 'Iron Fist rank 5' })
  })

  it('exports console setup commands for level, final SPECIAL, and selected perk ranks', () => {
    const build = emptyBuild()
    const bigLeagues = perk('Big Leagues')
    build.bookStat = 'Strength'
    build.selectedRanks[bigLeagues.id] = 1
    build.priority = [bigLeagues.id]

    const preview = toConsoleCommands(build, perks)
    expect(preview.commands).toContain('player.setlevel 60')
    expect(preview.commands).toContain('player.setav strength 2')
    expect(preview.commands).toContain('player.addperk 0004a0b5')
  })

  it('uses configured DLC load order for placeholder perk IDs', () => {
    const build = emptyBuild()
    const radResistant = perk('Rad Resistant')
    build.stats.Endurance = 6
    build.selectedRanks[radResistant.id] = 4
    build.priority = [radResistant.id]

    const preview = toConsoleCommands(build, perks, { 'Far Harbor': '03' })
    expect(preview.commands).toContain('player.addperk 030423a4')
    expect(preview.hasLoadOrderPlaceholders).toBe(false)
  })

  it('round-trips builds through a URL-safe hash', () => {
    const build = emptyBuild()
    const bigLeagues = perk('Big Leagues')
    build.name = 'Melee & Luck'
    build.characterName = 'Nora'
    build.stats.Strength = 4
    build.bookStat = 'Strength'
    build.bobbleheads.Luck = true
    build.selectedRanks[bigLeagues.id] = 1
    build.priority = [bigLeagues.id]

    const hash = encodeBuildHash(build)
    expect(hash).toMatch(/^build=[A-Za-z0-9_-]+$/)
    expect(decodeBuildHash(`#${hash}`)).toEqual(build)
  })

  it('ignores invalid build hashes', () => {
    expect(decodeBuildHash('#build=nope')).toBeNull()
    expect(decodeBuildHash('#tab=perks')).toBeNull()
  })
})
