from __future__ import annotations

import math
from collections import defaultdict
from typing import Optional

import networkx as nx
import numpy as np
import shap
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.ensemble import IsolationForest
from xgboost import XGBClassifier

app = FastAPI(title="CaseTrace ML service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FEATURES = [
    "in_deg", "out_deg", "fan_ratio", "log_in", "log_out",
    "pass_through", "known_share", "hop", "amt_cv", "log_hold",
]
FEATURE_TEXT = {
    "in_deg": "number of senders",
    "out_deg": "number of recipients",
    "fan_ratio": "in/out connection ratio",
    "log_in": "total value received (log)",
    "log_out": "total value sent (log)",
    "pass_through": "share of received value forwarded",
    "known_share": "share of neighbours that are known entities",
    "hop": "distance from the reported wallet",
    "amt_cv": "variation in transfer amounts",
    "log_hold": "median hold time before forwarding (log seconds)",
}


# ───────────────────────── schemas ─────────────────────────
class NodeIn(BaseModel):
    id: str
    labelType: Optional[str] = "UNLABELED"
    hop: int = 0
    isRoot: bool = False


class EdgeIn(BaseModel):
    source: str
    target: str
    amount: float = 0.0
    timestamp: Optional[int] = None  # unix seconds, optional
    tx_hash: Optional[str] = None  # enables the common-input ownership heuristic


class TraceIn(BaseModel):
    nodes: list[NodeIn]
    edges: list[EdgeIn]


# ───────────────── models (synthetic bootstrap) ─────────────────
def _synthetic(n: int = 2400, seed: int = 7):
    """Archetype data. Two heads: exchange-like (hot wallet / aggregator) and
    mixer-like (high fan-in AND fan-out, fixed denominations, pools value).
    Mixer rows are negatives for the exchange head and vice versa.
    Bootstrap only: replace with real labelled addresses before claiming accuracy."""
    rng = np.random.default_rng(seed)
    X, y_ex, y_mix = [], [], []
    for _ in range(n):
        kind = rng.choice(
            ["hot", "agg", "normal", "relay", "fanout", "mixer"],
            p=[.18, .13, .27, .18, .12, .12],
        )
        if kind == "hot":
            ind, outd = rng.integers(15, 200), rng.integers(5, 150)
            lin, lout = rng.uniform(3, 7), rng.uniform(3, 7)
            pt, ks, cv, ex, mx = rng.uniform(.6, 1), rng.uniform(0, .5), rng.uniform(1, 4), 1, 0
            lh = rng.uniform(2.0, 4.0)  # hot wallets turn funds over in minutes–hours
        elif kind == "agg":
            ind, outd = rng.integers(10, 100), rng.integers(1, 5)
            lin, lout = rng.uniform(2.5, 6), rng.uniform(2.5, 6)
            pt, ks, cv, ex, mx = rng.uniform(.8, 1), rng.uniform(0, .4), rng.uniform(1, 3), 1, 0
            lh = rng.uniform(2.0, 4.5)
        elif kind == "normal":
            ind, outd = rng.integers(1, 4), rng.integers(1, 4)
            lin, lout = rng.uniform(0, 2.5), rng.uniform(0, 2.5)
            pt, ks, cv, ex, mx = rng.uniform(0, .8), rng.uniform(0, .5), rng.uniform(0, 1.2), 0, 0
            lh = rng.uniform(3.0, 6.0)  # ordinary wallets sit on funds for hours–days
        elif kind == "relay":
            ind, outd = rng.integers(1, 3), rng.integers(1, 3)
            lin = rng.uniform(1, 4)
            lout = lin + rng.normal(0, .05)
            pt, ks, cv, ex, mx = rng.uniform(.9, 1), rng.uniform(0, .3), rng.uniform(0, .8), 0, 0
            lh = rng.uniform(1.0, 3.0)  # pass-through relays forward almost immediately
        elif kind == "fanout":
            ind, outd = 1, rng.integers(5, 25)
            lin, lout = rng.uniform(1, 4), rng.uniform(1, 4)
            pt, ks, cv, ex, mx = rng.uniform(.8, 1), rng.uniform(0, .2), rng.uniform(0, .6), 0, 0
            lh = rng.uniform(1.0, 3.0)
        else:  # mixer: pooled funds, many distinct counterparties both ways,
            # fixed denominations (low CV), dwells for the anonymity set
            ind, outd = rng.integers(20, 150), rng.integers(15, 120)
            lin, lout = rng.uniform(3, 6), rng.uniform(3, 6)
            pt, ks, cv, ex, mx = rng.uniform(.5, .9), rng.uniform(0, .3), rng.uniform(0, .5), 0, 1
            lh = rng.uniform(3.0, 5.0)
        X.append([ind, outd, (ind + 1) / (outd + 1), lin, lout, pt, ks, rng.integers(1, 6), cv, lh])
        y_ex.append(ex)
        y_mix.append(mx)
    return np.array(X, dtype=float), np.array(y_ex), np.array(y_mix)


_X, _y_ex, _y_mix = _synthetic()
MODEL = XGBClassifier(
    n_estimators=160, max_depth=4, learning_rate=0.08,
    subsample=0.9, eval_metric="logloss", random_state=7,
).fit(_X, _y_ex)
MIXER_MODEL = XGBClassifier(
    n_estimators=120, max_depth=3, learning_rate=0.08,
    subsample=0.9, eval_metric="logloss", random_state=11,
).fit(_X, _y_mix)
try:
    EXPLAINER = shap.TreeExplainer(MODEL)
except Exception:
    EXPLAINER = None


# ───────────────────────── graph + features ─────────────────────────
def build_graph(t: TraceIn):
    meta = {
        n.id.lower(): {
            "label": (n.labelType or "UNLABELED").upper(),
            "hop": n.hop,
            "root": n.isRoot,
        }
        for n in t.nodes
    }
    g = nx.MultiDiGraph()
    g.add_nodes_from(meta)
    for e in t.edges:
        s, d = e.source.lower(), e.target.lower()
        if s in meta and d in meta:
            g.add_edge(s, d, amount=max(e.amount, 0.0), ts=e.timestamp, tx=e.tx_hash)
    return g, meta


def node_features(g, meta):
    rows = {}
    for n in g.nodes:
        ins = [d["amount"] for _, _, d in g.in_edges(n, data=True)]
        outs = [d["amount"] for _, _, d in g.out_edges(n, data=True)]
        tin, tout = sum(ins), sum(outs)
        nbrs = set(g.predecessors(n)) | set(g.successors(n))
        known = sum(1 for m in nbrs if meta[m]["label"] != "UNLABELED")
        allamt = ins + outs
        mean = float(np.mean(allamt)) if allamt else 0.0
        cv = float(np.std(allamt) / mean) if mean > 0 else 0.0
        big = max(tin, tout)
        hs = hold_seconds(g, n)
        rows[n] = [
            len(ins), len(outs), (len(ins) + 1) / (len(outs) + 1),
            math.log10(1 + tin), math.log10(1 + tout),
            (min(tin, tout) / big) if big > 0 else 0.0,
            known / len(nbrs) if nbrs else 0.0,
            meta[n]["hop"], cv,
            math.log10(1 + hs) if hs is not None else 0.0,
        ]
    return rows


def hold_seconds(g, n):
    ti = [d["ts"] for _, _, d in g.in_edges(n, data=True) if d["ts"]]
    to = [d["ts"] for _, _, d in g.out_edges(n, data=True) if d["ts"]]
    if not ti or not to:
        return None
    hs = min(to) - max(ti)
    return hs if hs >= 0 else None


# ───────────────────────── structural node embeddings (ReFeX-style, numpy-only) ──
def structural_embeddings(g):
    """Role-based node embeddings: each node's vector profiles its own plus
    its 1-hop and 2-hop neighbourhoods' (log-scaled) connectivity, so
    addresses playing the same fund-flow role — two hot wallets, or a
    labelled exchange and an unlabelled look-alike — score near 1.0 even at
    different scales (cosine is scale-invariant over log features).

    Walk-based (Node2Vec/PPMI) proximity was tried first and rejected:
    on small dense trace graphs co-occurrence is near-independent, so PPMI
    collapses to all-zeros and skip-gram pushes frequent hubs apart via
    negative sampling. Role profiles stay discriminative at trace scale.
    Deterministic, pure numpy (no torch/gensim needed).
    Returns {node: unit vector}."""
    nodes = list(g.nodes)
    if len(nodes) < 2:
        return {}

    base = {}
    for n in nodes:
        ins = [d["amount"] for _, _, d in g.in_edges(n, data=True)]
        outs = [d["amount"] for _, _, d in g.out_edges(n, data=True)]
        base[n] = np.array([
            math.log10(1 + len(ins)), math.log10(1 + len(outs)),
            math.log10(1 + sum(ins)), math.log10(1 + sum(outs)),
        ])

    nbrs = {n: (set(g.predecessors(n)) | set(g.successors(n))) - {n} for n in nodes}

    def _mean(vecs):
        return sum(vecs, np.zeros(4)) / len(vecs) if vecs else np.zeros(4)

    agg1 = {n: _mean([base[m] for m in nbrs[n]]) for n in nodes}
    agg2 = {n: _mean([agg1[m] for m in nbrs[n]]) for n in nodes}

    out = {}
    for n in nodes:
        v = np.concatenate([base[n], agg1[n], agg2[n]])
        out[n] = v / (np.linalg.norm(v) + 1e-9)
    return out


# ───────────────────────── heuristic cluster mining ─────────────────────────
def detect_clusters(g, meta, hot):
    """Exchange-cluster heuristics over the traced subgraph:
    - sweep: deposit wallets forwarding >=90% of out-value into one hot wallet
    - consolidation: >=3 senders each directing >=70% of out-value into one target
    - siblings: >=2 wallets sharing one dominant (>=70% of in-value) non-root funder
    - co-input: distinct senders appearing in the same transaction hash
      (classic common-input ownership; rarely fires on EVM, kept for UTXO-style feeds)
    """
    clusters: dict = defaultdict(list)

    for n in g.nodes:
        by = defaultdict(float)
        for _, d, dd in g.out_edges(n, data=True):
            by[d] += dd["amount"]
        total = sum(by.values())
        if total <= 0 or meta[n]["root"]:
            continue
        tgt, amt = max(by.items(), key=lambda kv: kv[1])
        if tgt in hot and tgt != n and amt / total >= 0.9:
            clusters[tgt].append(n)

    for tgt in g.nodes:
        senders = []
        for src in g.predecessors(tgt):
            if src == tgt or meta[src]["root"]:
                continue
            out_tot = sum(dd["amount"] for _, _, dd in g.out_edges(src, data=True))
            to_tgt = sum(dd["amount"] for _, d, dd in g.out_edges(src, data=True) if d == tgt)
            if out_tot > 0 and to_tgt / out_tot >= 0.7:
                senders.append(src)
        if len(senders) >= 3:
            clusters[f"consolidation:{tgt}"] = sorted(senders)

    funders: dict = defaultdict(list)
    for n in g.nodes:
        if meta[n]["root"]:
            continue
        by = defaultdict(float)
        for s, _, dd in g.in_edges(n, data=True):
            by[s] += dd["amount"]
        total = sum(by.values())
        if total <= 0:
            continue
        top, amt = max(by.items(), key=lambda kv: kv[1])
        if amt / total >= 0.7 and not meta[top]["root"]:
            funders[top].append(n)
    for f, sibs in funders.items():
        if len(sibs) >= 2:
            clusters[f"siblings:{f}"] = sorted(sibs)

    by_tx: dict = defaultdict(set)
    for s, _, dd in g.edges(data=True):
        if dd.get("tx"):
            by_tx[dd["tx"]].add(s)
    for tx, srcs in by_tx.items():
        if len(srcs) >= 2:
            clusters[f"co-input:{tx}"] = sorted(srcs)

    return clusters


# ───────────────────────── layering rules ─────────────────────────
def peel_chains(g):
    found, covered = [], set()
    for start in g.nodes:
        if start in covered:
            continue
        chain, cur, seen = [start], start, {start}
        while True:
            by = defaultdict(float)
            for _, d, dd in g.out_edges(cur, data=True):
                by[d] += dd["amount"]
            if len(by) < 2:
                break
            total = sum(by.values())
            top, amt = max(by.items(), key=lambda kv: kv[1])
            if total <= 0 or amt / total < 0.7 or top in seen:
                break
            chain.append(top)
            seen.add(top)
            cur = top
        if len(chain) >= 3:
            covered.update(chain)
            found.append(chain)
    return found


# Anomaly level at which the unsupervised outlier score corroborates a structural
# flag (pass-through / fan-out) into an anomaly-confirmed layering signal.
# Scores are 0..1 normalised per trace; 0.7 marks the top outlier band. The
# structural flag already fired — anomaly only confirms it is unusual here.
ANOMALY_CONFIRM = 0.7


def detect_layering(g, meta, feats, anom_by=None):
    """Layering rules, annotated — and where strong — confirmed by the
    Isolation Forest outlier score. `anom_by` maps node -> 0..1 anomaly;
    every pattern carries the max anomaly over its nodes so downstream
    consumers can weight structural flags by unsupervised surprise.
    No labelled fraud data is used anywhere in this function."""
    anom_by = anom_by or {}
    patterns, flags = [], defaultdict(list)

    def add(kind, nodes, detail):
        peak = max([float(anom_by.get(n, 0.0)) for n in nodes] + [0.0])
        patterns.append({"type": kind, "nodes": nodes, "detail": detail, "max_anomaly": round(peak, 3)})
        for n in nodes:
            if kind not in flags[n]:
                flags[n].append(kind)

    for chain in peel_chains(g):
        add("peel_chain", chain, f"{len(chain)}-hop chain peeling small amounts off a large balance")

    for n, f in feats.items():
        ind, outd, pt = f[0], f[1], f[5]
        a = float(anom_by.get(n, 0.0))
        is_root = meta[n]["root"]
        if outd >= 5 and ind <= 2:
            add("fan_out", [n], f"1 source split to {int(outd)} recipients")
            if a >= ANOMALY_CONFIRM:
                add("anomalous_fan_out", [n],
                    f"burst split to {int(outd)} recipients with anomaly {a:.2f} — outlier, no labels needed")
        if ind >= 5 and outd <= 2:
            dest = f"into {int(outd)} recipient(s)" if outd > 1 else "into this wallet"
            add("fan_in", [n], f"{int(ind)} sources consolidated {dest}")
        if not is_root and 1 <= ind <= 2 and 1 <= outd <= 2 and pt >= 0.95:
            hs = hold_seconds(g, n)
            if hs is None or hs < 6 * 3600:
                when = f" within {int(hs // 60)} min" if hs is not None else ""
                add("rapid_pass_through", [n], f"forwards ~{pt:.0%} of received value{when}")
                if a >= ANOMALY_CONFIRM:
                    add("anomalous_relay", [n],
                        f"forwards ~{pt:.0%}{when} with anomaly {a:.2f} — pass-through + outlier")
        lab = meta[n]["label"]
        if lab == "MIXER":
            add("mixer", [n], "known mixer / tumbler")
        elif "BRIDGE" in lab:
            add("bridge", [n], "known cross-chain bridge")
    return patterns, flags


# ───────────────────────── helpers ─────────────────────────
def reasons_for(row, shap_row):
    if shap_row is None:
        return []
    out = []
    for k in np.argsort(-np.abs(shap_row))[:3]:
        push = "raises" if shap_row[k] > 0 else "lowers"
        out.append(f"{FEATURE_TEXT[FEATURES[k]]} = {row[k]:.2f} {push} exchange likelihood")
    return out


def cosine(a, b):
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    return float(a @ b / (na * nb)) if na > 0 and nb > 0 else 0.0


# ───────────────────────── endpoints ─────────────────────────
@app.get("/health")
def health():
    return {"ok": True, "model": "xgboost-synthetic-bootstrap"}


@app.post("/analyze")
def analyze(t: TraceIn):
    g, meta = build_graph(t)
    if not meta:
        return {"nodes": {}, "layering": [], "clusters": {}, "vasp": None, "alternatives": [],
                "anomaly_available": False, "suspected_mixers": []}

    feats = node_features(g, meta)
    ids = list(feats)
    X = np.array([feats[i] for i in ids], dtype=float)
    probs = MODEL.predict_proba(X)[:, 1]
    mix_probs = MIXER_MODEL.predict_proba(X)[:, 1]

    sv = None
    if EXPLAINER is not None:
        try:
            raw = EXPLAINER.shap_values(X)
            sv = np.array(raw[1] if isinstance(raw, list) else raw)
        except Exception:
            sv = None

    # Isolation Forest anomaly score. Unsupervised: fitted on THIS trace's own
    # feature rows, so outliers are relative to the case — no labelled fraud
    # data needed. Below 8 nodes there is nothing to be an outlier from, so the
    # service reports anomaly_available=false instead of fake all-zero scores.
    anomaly_available = len(ids) >= 8
    anom = np.zeros(len(ids))
    if anomaly_available:
        iso = IsolationForest(n_estimators=100, random_state=7).fit(X)
        raw = -iso.score_samples(X)
        span = raw.max() - raw.min()
        if span > 0:
            anom = (raw - raw.min()) / span

    anom_by = {n: float(anom[i]) for i, n in enumerate(ids)}
    patterns, flags = detect_layering(g, meta, feats, anom_by)

    # Label propagation: tabular feature similarity AND structural role-embedding
    # similarity to labelled exchanges in this trace. Unlabelled addresses
    # that behave like a labelled exchange inherit the label with a
    # confidence value — this is what lets a small curated registry cover
    # look-alike addresses. Embedding wins ties (role > counters).
    Z = (X - X.mean(0)) / (X.std(0) + 1e-9)
    emb = structural_embeddings(g)
    known_idx = [i for i, n in enumerate(ids) if meta[n]["label"] == "EXCHANGE"]
    propagated = {}
    if known_idx:
        for i, n in enumerate(ids):
            if meta[n]["label"] != "UNLABELED":
                continue
            best = None
            tab_sim, tab_k = max((cosine(Z[i], Z[k]), k) for k in known_idx)
            if tab_sim >= 0.85:
                best = (tab_sim, ids[tab_k], "tabular")
            if n in emb:
                es, ek = max(
                    (float(emb[n] @ emb[ids[k]]), k) for k in known_idx if ids[k] in emb
                )
                if es >= 0.90 and (best is None or es > best[0]):
                    best = (es, ids[ek], "embedding")
            if best is not None:
                propagated[n] = {
                    "similarity": round(best[0], 3),
                    "like": best[1],
                    "basis": best[2],
                }

    # Heuristic exchange clusters: sweeps, consolidation, siblings, co-input.
    hot = {n for i, n in enumerate(ids) if meta[n]["label"] == "EXCHANGE" or probs[i] >= 0.6}
    clusters = detect_clusters(g, meta, hot)

    # Per-node output
    nodes_out = {}
    for i, n in enumerate(ids):
        lab = meta[n]["label"]
        risk = 35 * anom[i] + 20 * len(flags[n])
        if lab == "MIXER":
            risk += 60
        if lab == "SANCTIONED":
            risk = 100
        nodes_out[n] = {
            "exchange_prob": round(float(probs[i]), 3),
            "mixer_prob": round(float(mix_probs[i]), 3),
            "risk_score": int(min(100, round(risk))),
            "anomaly": round(float(anom[i]), 3),
            "flags": flags[n],
            "reasons": reasons_for(X[i], sv[i] if sv is not None else None),
            "propagated": propagated.get(n),
            "cluster_hot_wallet": next((h for h, m in clusters.items() if n in m), None),
        }

    # Behavioural mixer suspects: unlabelled nodes shaped like a mixer pool
    # (high fan-in AND fan-out, fixed denominations). No registry hit needed —
    # this is what moves the mixer count on flows the 6 curated addresses miss.
    suspected_mixers = []
    for i, n in enumerate(ids):
        if meta[n]["label"] != "UNLABELED" or meta[n]["root"]:
            continue
        mp = float(mix_probs[i])
        if mp < 0.7:
            continue
        row = X[i]
        why = [f"{int(row[0])} senders / {int(row[1])} recipients pool through this wallet"]
        if row[8] < 0.6:
            why.append(f"fixed-denomination flow (variation {row[8]:.2f})")
        if row[5] < 0.9:
            why.append(f"pools value, forwards only {row[5]:.0%} onward")
        suspected_mixers.append({
            "address": n,
            "mixer_prob": round(mp, 3),
            "reasons": why,
        })
    suspected_mixers.sort(key=lambda s: -s["mixer_prob"])

    # Nearest VASP candidates
    roots = [n for n in ids if meta[n]["root"]] or [min(ids, key=lambda n: meta[n]["hop"])]
    dg = nx.DiGraph(g)
    dist = {}
    for r in roots:
        for n, d in nx.single_source_shortest_path_length(dg, r).items():
            dist[n] = min(d, dist.get(n, 10**9))
    all_value = sum(d["amount"] for _, _, d in g.edges(data=True))

    candidates = []
    for i, n in enumerate(ids):
        if n in roots or n not in dist:
            continue
        is_known = meta[n]["label"] == "EXCHANGE"
        if not (is_known or probs[i] >= 0.6 or n in propagated):
            continue
        hops = max(dist[n], 1)
        recv = sum(d["amount"] for _, _, d in g.in_edges(n, data=True))
        share = min(1.0, recv / all_value) if all_value > 0 else 0.0
        members = list(clusters.get(n, [])) + list(clusters.get(f"consolidation:{n}", []))
        sweep = min(1.0, len(members) / 3)
        prop_bonus = propagated[n]["similarity"] if n in propagated else 0.0
        if is_known:
            conf = min(0.98, 0.70 + 0.12 * (1 / hops) + 0.10 * sweep + 0.08 * share)
        else:
            conf = min(
                0.65,
                0.35 * prop_bonus + 0.25 * float(probs[i]) + 0.15 * (1 / hops) + 0.12 * sweep + 0.08 * share,
            )
        reasons = []
        if is_known:
            reasons.append("address carries a known exchange label")
        elif n in propagated:
            reasons.append(f"behaves like labelled exchange {propagated[n]['like'][:10]}… (similarity {propagated[n]['similarity']})")
        reasons.append(f"{hops} hop(s) from the reported wallet")
        if sweep > 0:
            reasons.append(f"{len(members)} deposit-style wallet(s) sweep into it")
        if (not is_known) or probs[i] >= 0.5:
            reasons.append(f"model exchange likelihood {probs[i]:.0%}")
        # Surface the top SHAP driver so the confidence score carries its explanation.
        top_driver = nodes_out[n]["reasons"][:1]
        if top_driver:
            reasons.append(f"key model driver: {top_driver[0]}")
        candidates.append({
            "address": n,
            "basis": "known_label" if is_known else "inferred",
            "confidence": round(min(conf, 0.99), 3),
            "hops": hops,
            "received": round(recv, 6),
            "reasons": reasons,
        })

    candidates.sort(key=lambda c: (-c["confidence"], c["hops"]))
    return {
        "nodes": nodes_out,
        "layering": patterns,
        "clusters": dict(clusters),
        "vasp": candidates[0] if candidates else None,
        "alternatives": candidates[1:4],
        "anomaly_available": anomaly_available,
        "suspected_mixers": suspected_mixers,
        "note": "XGBoost is bootstrapped on synthetic archetypes; not validated on real labels.",
    }
