"""Group districts by how their courts move cases (k-means).

Each district gets a profile: the share of cases disposed of within a year for the biggest case
types, plus how congested its courts are. Profiles are standardised (otherwise the measure with
the largest spread decides everything) and k is chosen by silhouette score, with the inertia
("elbow") curve reported alongside so the choice can be checked by eye.
"""

from dataclasses import dataclass

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler


@dataclass
class Clustering:
    labels: pd.Series                 # district -> cluster number
    centres: pd.DataFrame             # cluster -> mean profile (original units)
    k: int
    silhouette: dict[int, float]      # k -> score
    inertia: dict[int, float]         # k -> within-cluster sum of squares (elbow)
    imputed: dict[str, list[str]]     # district -> profile columns filled with the median


def choose_and_fit(profile: pd.DataFrame, ks=range(2, 9), seed: int = 0) -> Clustering:
    """A district missing one measure (Chennai's metropolitan courts don't use every case type)
    gets the median for it rather than being dropped; which ones were filled is returned."""
    imputed = {d: [c for c in profile.columns if pd.isna(row[c])]
               for d, row in profile.iterrows() if row.isna().any()}
    clean = profile.fillna(profile.median())
    x = StandardScaler().fit_transform(clean)
    silhouette, inertia, fits = {}, {}, {}
    for k in ks:
        if k >= len(clean):
            break
        model = KMeans(n_clusters=k, n_init=20, random_state=seed).fit(x)
        fits[k] = model
        inertia[k] = float(model.inertia_)
        silhouette[k] = float(silhouette_score(x, model.labels_))
    k = max(silhouette, key=silhouette.get)
    labels = pd.Series(fits[k].labels_, index=clean.index, name="cluster")
    # number clusters from fastest to slowest (by the mean of all rates) so names are stable
    order = clean.groupby(labels).mean().mean(axis=1).sort_values(ascending=False).index
    renumber = {old: new for new, old in enumerate(order)}
    labels = labels.map(renumber)
    centres = clean.groupby(labels).mean()
    return Clustering(labels, centres, k, silhouette, inertia, imputed)
