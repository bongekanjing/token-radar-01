# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/bongekanjing/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/bongekanjing/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar ranking 226 pre-token protocols by implied value, with a sortable and filterable dashboard, a per-protocol detail view with model breakdown, and 7-step farm plans with costs and times.

The model (radar-2) scores every protocol from the snapshot's own figures only: implied value = TVL x 0.20 x growth x maturity x chains. Growth is the 7-day TVL change clamped to -80%..+200% (weighted x0.6), maturity is 0.55 + age/1460 x 0.45, and each chain adds 3% (up to 5 chains). No protocol names are hardcoded. The board holds all 40 watchlist protocols plus 186 early finds, and 24 live-token protocols are set aside in their own table.

Local verification: two runs write byte-identical output, and all seven gate checks pass (dashboard files, board file, sorted by value, 40/40 watchlist coverage, farm steps, screenshots, dossier matches).

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=yg9xmt6c&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
