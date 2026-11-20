# Token Radar — radar-2

The best token launch radar for the make.fun bounty
`token-radar-01` ($1,325, closes 2026-12-14 10:00 UTC).

A program plus the dashboard it writes. It reads the sealed DefiLlama
snapshot (`input/snapshot.json` in the kit, 758 protocols as of 2026-11-14),
scores every pre-token protocol, and writes a ranked board.

## What it does

- Covers all 40 watchlist protocols (TVL ≥ $50M, no token on record) and
  adds 186 pre-token protocols below the floor, by TVL — 226 rows in total.
  The 32 largest live-token protocols are set aside with their market caps,
  never mixed into the ranking.
- Ranks by implied value under model `radar-2`, one function of the
  snapshot's own figures, no protocol name special-cased:

  ```
  implied = round( tvl_usd x 0.25
    x (1 + clamp(change_7d, -60, 120) / 100 x weight)
    x (0.6 + log1p(min(age_days, 1095)) / log1p(1095) x 0.4)
    x (1 + 0.03 x min(chains - 1, 3)) )
  ```

  Weight is 0.5 on a rise and 0.7 on a fall, so a shrinking protocol is
  penalised more than an equal rise helps. Maturity uses log age, so the
  first year with no token counts far more than the third. Breadth adds
  3% per extra chain, capped at 9%. Age is days since the protocol was
  first listed; an unlisted age uses 365 days.
- Gives every protocol an 8-step farm plan derived from its own record
  (category, chains, TVL, age): a fresh wallet, the category action with
  chain-specific gas, a category-specific weekly action, a hold period,
  a weekly points check, a risk check (verify addresses only on the
  protocol's own site, never pay to claim), claiming only from the
  official link, and a log plus a two-step unwind. Every step states
  its cost and its time.
- Dashboard (`dashboard/`, no framework, no network): sortable and
  filterable board (search, category, chain), a Live-token tab, a
  detail view for each protocol with the model's breakdown and its
  farm plan, and a methodology panel that states the formula.

## Run it

Node 22, standard library only:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

It writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and
`dossier.json` to the output directory.

## Files

- `main.ts` — entrypoint: reads the snapshot, writes the board, data,
  dashboard, screenshots and dossier.
- `lib/model.ts` — the radar-2 model, the board builder and the farm plans.
- `dashboard/` — the static page (`index.html`, `app.js`, `app.css`).
- `screenshots/` — the board, a detail view and a filtered view
  (1440×900 each, rendered from the board's own data).
- `vendor/makefun-board.ts` — the kit's vendored dossier library.
- `LICENSE` — MIT.

Implied value is a model, not a promise, and not a price.
