# Fallout 4 Character Planner

A local-first Nuxt planner for Fallout 4 SPECIAL perk builds. The Nuxt project lives in `app/` and uses the game data supplied in `resources/`.

## Run

```bash
bun --cwd app install
bun --cwd app run dev
```

Use `bun --cwd app run test`, `bun --cwd app run typecheck`, and `bun --cwd app run build` to verify the project.

## Rules implemented

- Every SPECIAL starts at 1. The player can distribute 21 additional starting points, with a starting-stat cap of 10.
- The You're SPECIAL book and each selected SPECIAL bobblehead add one effective point to their chosen stat.
- Lady Killer is restricted to male characters and Black Widow to female characters.
- Later selected perk ranks include all earlier ranks automatically.
- The route honors perk-family priority where possible, handles rank-level gates, and schedules required SPECIAL increases before the perk that needs them.
- A bobblehead prerequisite is placed immediately before the first scheduled selected rank that relies on it.

The planner treats the book and selected bobbleheads as available before their first required perk. It does not attempt to route the player to their physical in-game locations.

## Data notes

The provided SPECIAL perks include base-game, Far Harbor, and Nuka-World entries. The app keeps the JSON it uses in `app/data/source/` and the tiled perk-chart art in `app/public/images/`. During loading, the app normalizes the source's `Blacksmith` `levle` typo. It does not use source rank IDs as UI identifiers because Big Leagues has a duplicate rank ID.
