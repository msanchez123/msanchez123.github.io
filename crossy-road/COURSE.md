# How the map is built (and how to change it)

## The three places that matter
| File | Job | Touch it when you want to... |
|---|---|---|
| `js/course.js` | **The rules.** Numbers that shape how the map feels + the pacing logic. No graphics code. | make roads gentler, rest longer, speeds different |
| `js/world.js` | Builds each row (ground, lanes, objects, meshes) from the rules. | change how something looks or is made |
| `tools/check-course.js` | Automatic checks (run `node tools/check-course.js`). | after any change, to see nothing broke |

## Tuning the feel: `TUNE` in `js/course.js`
- `rest.chance` - how often a breather (hills, maze, glade...) follows a hazard. 0 = hazards come back to back, 1 = always a breather.
- `road.window` - seconds of travel every gap between vehicles is guaranteed to have. A lane takes about 1.0 s to cross; 1.7 leaves comfortable margin. Lower = tighter traffic.
- `road.speed` - vehicle speed range.
- `speedRamp.rows` - hazards speed up a little over the first N rows. Set to 0 for a perfectly flat course.
- `noRepeat` - how many recent stretches (and their kind) are not repeated.

## The one rule to remember: two random streams
- `lrand / lrnd / lri` (layout) decide **what is where**: lane types, obstacles, cars, logs, timings.
- `rand / rnd / ri` (decoration) decide **only looks**: tuft positions, rock shapes, colours.

Anything that changes whether something can be walked on, how long or fast it is, or where it is, must use the **layout** stream.
Anything purely visual must use the **decoration** stream. Each row gets its own streams from the seed, so
editing a rock, a tree or a colour can never change the level. `node tools/check-course.js` verifies this.

## What the checks guarantee
1. Same seed = same level.
2. Decoration changes (extra random calls) = same level.
3. Every hazard is separated from the next by rest (at least 3 rows), and hazards are crossable from the safe path with a bounded wait.

## Multiplayer note
Everyone in a room must run the same version of these files: the level is generated on each phone from the shared seed.

## Obstacles (all tuned in js/course.js)

- **Traffic**: every road lane gets a personality (`C.TRAFFIC`): *crawl* (slow heavy trucks), *commuter* (ordinary mix), *express* (a few fast cars), *convoy* (bunched platoons with big gaps). Neighbouring lanes never share one. Speeds run 2.2-7.4 units/s; `TUNE.road.maxSpeed` is the cap (anything faster than ~7.4 can't be seen coming in time). Gaps between vehicles are always at least `TUNE.road.window` seconds of travel, so every lane is crossable.
- **Rivers**: lanes are rafts (long, slow), plain logs, or stepping logs (short, quick). `C.LOGS`.
- **Trains**: regional, freight (long, slow, more warning) or express (short, very fast). `C.TRAINS`.
- **Rockslides**: boulders tumble in waves; `C.rockslide` makes sure the quiet gap between waves is long enough to cross and no rocks overlap. Rocks now sit on the ground and roll with their real size; small rocks tumble in the big ones' wake.
- Check everything with `node tools/check-course.js 4 250`.
