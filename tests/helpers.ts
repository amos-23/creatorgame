import { act } from "../src/engine/actions";
import { createNewGame } from "../src/engine/state";
import type { GameState, PathId, ProductType } from "../src/engine/types";

export function newGame(path: PathId = "knowledge", seed = 42): GameState {
  return createNewGame({ seed, path });
}

/** Ends days, resolving any event with its first zero-cost choice. */
export function endDays(s: GameState, n: number): GameState {
  for (let i = 0; i < n && s.phase === "planning"; i++) {
    if (s.pendingEvent) {
      const c = s.pendingEvent.choices.find((x) => x.cost === 0 && !x.hoursCost) ?? s.pendingEvent.choices.find((x) => x.cost === 0)!;
      s = act(s, { type: "resolveEvent", choiceId: c.id });
    }
    s = act(s, { type: "endDay", expectedDay: s.day });
  }
  return s;
}

/** Create a product and fast-forward until it's live. */
export function launch(s: GameState, type: ProductType, price: number, maxDays = 10): GameState {
  s = act(s, { type: "createProduct", productType: type, topic: s.niche, price, effort: "standard" });
  const id = s.products[s.products.length - 1]!.id;
  s = act(s, { type: "setPlan", plan: { posts: 0 } });
  for (let i = 0; i < maxDays; i++) {
    s = endDays(s, 1);
    if (s.products.find((p) => p.id === id)!.status === "live") break;
  }
  return s;
}

/** Give the state a hand-edited tweak (tests only). */
export function tweak(s: GameState, f: (d: GameState) => void): GameState {
  const d = JSON.parse(JSON.stringify(s)) as GameState;
  f(d);
  return d;
}
