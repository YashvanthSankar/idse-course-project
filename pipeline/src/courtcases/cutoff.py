"""When was each court's data scraped?

The dataset has no "scraped on" column, but it leaves a fingerprint: the number of decisions
per month runs steadily, then collapses when scraping happened (measured on 2010 filings:
~11,000 decisions a month nationally until Jan 2019, ~1,500 a month after). A case without a
decision date is only known to be pending *up to that date*, so the cutoff decides which cases
can be labelled at all, and different states were scraped at different times (Maharashtra in
early 2019; Uttar Pradesh, Bihar and Odisha a year or more later).

`cliff` finds the *first lasting collapse*: the first month that, together with the
`sustain - 1` months after it, sits below `share` of the median of the 12 months before it.
- "First", not "last normal month": after a scrape the low trickle (a few courts re-scraped
  later, plus typos) becomes the new normal, so "last month that looks normal" drifts years
  late.
- "Lasting": a one-month dip (court vacations in May/June, Diwali, a strike) is not a scrape.
- Feed it decisions from *all* filing years together. One filing cohort's decisions shrink
  naturally as its cases get decided, which in a small district looks like a scrape.
- Known confound: the COVID-19 lockdown from late March 2020 collapsed decisions everywhere, so
  a state scraped after that shows its cliff at March 2020 at the latest.
"""

import pandas as pd


def monthly_counts(dates: pd.Series) -> pd.Series:
    months = dates.dropna().dt.to_period("M")
    if months.empty:
        return pd.Series(dtype="int64")
    counts = months.value_counts().sort_index()
    full = pd.period_range(counts.index.min(), counts.index.max(), freq="M")
    return counts.reindex(full, fill_value=0)


def cliff(dates: pd.Series, share: float = 0.25, window: int = 12, sustain: int = 3,
          min_typical: float = 20.0) -> pd.Timestamp | None:
    """The last day before the first lasting collapse in monthly decisions, or None when
    there is no collapse or too few decisions to tell (typical month under `min_typical`)."""
    counts = monthly_counts(dates)
    if len(counts) <= window + sustain:
        return None
    typical = counts.rolling(window, min_periods=window).median().shift(1)
    values = counts.to_numpy()
    for i in range(window, len(counts) - sustain + 1):
        level = typical.iloc[i]
        if level >= min_typical and (values[i:i + sustain] < share * level).all():
            return (counts.index[i] - 1).to_timestamp(how="end").normalize()
    return None


def cutoffs(df: pd.DataFrame, by: str | list[str], date_col: str = "date_of_decision",
            **kwargs) -> pd.Series:
    """The cliff for each group (e.g. by="state_code", or ["state_code", "dist_code"])."""
    return df.groupby(by)[date_col].apply(lambda s: cliff(s, **kwargs))


def with_fallback(local: pd.Series, regional: pd.Series, parent_of, max_gap_days: int = 92
                  ) -> pd.Series:
    """Use each local (e.g. district) cutoff unless it is missing or more than `max_gap_days`
    away from its region's (state's) cutoff: then a dip in a small district, not a scrape, made
    the cliff, and the region's cutoff is the better estimate. `parent_of` maps a local key to
    its region key."""
    parent = pd.Series([parent_of(k) for k in local.index], index=local.index)
    region = parent.map(regional)
    far = (local - region).abs() > pd.Timedelta(days=max_gap_days)
    return local.where(local.notna() & ~far, region)
