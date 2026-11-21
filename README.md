# Token Radar

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/bongekanjing/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/bongekanjing/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

Build the best token launch radar: a program plus the web dashboard it writes,
ranking every pre-token protocol in a sealed DefiLlama snapshot by the implied
value of the token it may one day issue, each with the steps to farm it.

- [make.fun bounty: token-radar-01](https://make.fun/bounty/token-radar-01)
- Try make.fun yourself: https://make.fun/r/204hjvsp

## What it does

`main.ts` (Node 22, standard library only) reads the sealed snapshot at
`/input/snapshot.json`, scores every rankable pre-token protocol with the
radar-2 model, and writes:

- `board.json` — the ranked board (198 rows: all 40 watchlist protocols plus
  every other protocol that passes the watchlist's eligibility rule, at any TVL)
- `data.js` — the dashboard's dataset, written beside the page
- `dashboard/` — the board, a detail view per protocol, and filters, as a
  static page with no network
- `dossier.json` — the summary the judge reads, built with the kit's
  `vendor/makefun-board.ts`

## The model (radar-2)

Implied value is calibrated from the snapshot's own live market, not from a
flat constant. For each category, the base multiple is the median
market-cap-to-TVL ratio of that category's live-token protocols, shrunk toward
the global median (0.169, k = 3) and clamped to [0.05, 1.5]:

```
implied = round(tvl_usd x multiple(category)
  x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
  x (0.7 + min(age_days, 1095) / 1095 x 0.3)
  x (1 + 0.04 x min(chains - 1, 5)))
```

Age is the time since the protocol was first listed, the best record of how
long it has run with no token. Token-trading protocols are set aside in the
Live view with their market caps: the board ranks only protocols that record
no token. Implied value is what a token would be worth if the protocol's
record stayed as it is — a model estimate, not a price, and not a prediction
that a token is issued at all.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

## License

MIT
