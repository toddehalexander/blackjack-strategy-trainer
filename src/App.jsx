import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const SUITS = [
  { symbol: "♠", color: "text-slate-900" },
  { symbol: "♥", color: "text-rose-500" },
  { symbol: "♦", color: "text-rose-500" },
  { symbol: "♣", color: "text-slate-900" },
];

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const DEALER_KEYS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MOVE_COLORS = {
  H: "bg-emerald-500/18 text-emerald-200 ring-1 ring-emerald-400/20",
  S: "bg-rose-500/18 text-rose-200 ring-1 ring-rose-400/20",
  D: "bg-sky-500/18 text-sky-200 ring-1 ring-sky-400/20",
  P: "bg-fuchsia-500/18 text-fuchsia-200 ring-1 ring-fuchsia-400/20",
};
const ACTION_DETAILS = {
  H: "Take a card",
  S: "End turn",
  D: "2x bet & 1 card",
  P: "Split pairs",
};

const HARD_STRATEGY = {
  8: mapRow("H H H H H H H H H H"),
  9: mapRow("H D D D D H H H H H"),
  10: mapRow("D D D D D D D D H H"),
  11: mapRow("D D D D D D D D D D"),
  12: mapRow("H H S S S H H H H H"),
  13: mapRow("S S S S S H H H H H"),
  14: mapRow("S S S S S H H H H H"),
  15: mapRow("S S S S S H H H H H"),
  16: mapRow("S S S S S H H H H H"),
  17: mapRow("S S S S S S S S S S"),
  18: mapRow("S S S S S S S S S S"),
  19: mapRow("S S S S S S S S S S"),
  20: mapRow("S S S S S S S S S S"),
  21: mapRow("S S S S S S S S S S"),
};

const SOFT_STRATEGY = {
  13: mapRow("H H H D D H H H H H"),
  14: mapRow("H H H D D H H H H H"),
  15: mapRow("H H D D D H H H H H"),
  16: mapRow("H H D D D H H H H H"),
  17: mapRow("H D D D D H H H H H"),
  18: mapRow("D D D D D S S H H H"),
  19: mapRow("S S S S D S S S S S"),
  20: mapRow("S S S S S S S S S S"),
};

const PAIR_STRATEGY = {
  2: mapRow("P P P P P P H H H H"),
  3: mapRow("P P P P P P H H H H"),
  4: mapRow("H H H P P H H H H H"),
  5: mapRow("D D D D D D D D H H"),
  6: mapRow("P P P P P H H H H H"),
  7: mapRow("P P P P P P H H H H"),
  8: mapRow("P P P P P P P P P P"),
  9: mapRow("P P P P P S P P S S"),
  10: mapRow("S S S S S S S S S S"),
  11: mapRow("P P P P P P P P P P"),
};

const REFERENCE_SECTIONS = [
  { title: "Hard", strategy: HARD_STRATEGY, rows: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17], format: formatHardLabel },
  { title: "Soft", strategy: SOFT_STRATEGY, rows: [13, 14, 15, 16, 17, 18, 19, 20], format: formatSoftCompactLabel },
  { title: "Pairs", strategy: PAIR_STRATEGY, rows: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], format: formatPairLabel },
];
const CHART_LEGEND = [
  { key: "H", label: "Hit" },
  { key: "S", label: "Stand" },
  { key: "D", label: "Double" },
  { key: "P", label: "Split" },
];

function mapRow(serialized) {
  const values = serialized.split(" ");
  return DEALER_KEYS.reduce((row, dealer, index) => {
    row[dealer] = values[index];
    return row;
  }, {});
}

function buildShoe(decks = 6) {
  const cards = [];
  for (let deck = 0; deck < decks; deck += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push(createCard(rank, suit.symbol, suit.color));
      }
    }
  }
  return shuffle(cards);
}

function shuffle(cards) {
  const copy = [...cards];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function createCard(rank, suit, color) {
  return {
    id: `${rank}-${suit}-${Math.random().toString(36).slice(2, 9)}`,
    rank,
    suit,
    color,
  };
}

function cardValue(card) {
  if (card.rank === "A") {
    return 11;
  }
  if (["K", "Q", "J"].includes(card.rank)) {
    return 10;
  }
  return Number(card.rank);
}

function handValue(cards) {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += cardValue(card);
    if (card.rank === "A") {
      aces += 1;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return {
    total,
    soft: aces > 0,
    blackjack: cards.length === 2 && total === 21,
    bust: total > 21,
  };
}

function isPair(cards) {
  return cards.length === 2 && normalizedRank(cards[0]) === normalizedRank(cards[1]);
}

function normalizedRank(card) {
  if (["J", "Q", "K"].includes(card.rank)) {
    return "10";
  }
  return card.rank;
}

function dealerUpcardValue(card) {
  return card.rank === "A" ? 11 : Math.min(cardValue(card), 10);
}

function strategyDecision(cards, dealerCard) {
  const dealerKey = dealerUpcardValue(dealerCard);
  const { total, soft } = handValue(cards);

  if (isPair(cards)) {
    const pairKey = normalizedRank(cards[0]) === "A" ? 11 : Number(normalizedRank(cards[0]));
    const pairMove = PAIR_STRATEGY[pairKey]?.[dealerKey];
    if (pairMove) {
      return {
        move: pairMove,
        category: "pair",
        label: formatPairLabel(pairKey),
      };
    }
  }

  if (soft && cards.length >= 2 && total >= 13) {
    const softMove = SOFT_STRATEGY[Math.min(total, 20)]?.[dealerKey];
    if (softMove) {
      return {
        move: softMove,
        category: "soft",
        label: formatSoftLabel(total),
      };
    }
  }

  const hardKey = Math.max(8, Math.min(total, 21));
  return {
    move: HARD_STRATEGY[hardKey]?.[dealerKey] ?? "H",
    category: "hard",
    label: formatHardLabel(total),
  };
}

function explainDecision(cards, dealerCard, move, categoryLabel) {
  const dealerLabel = dealerCard.rank === "A" ? "Ace" : dealerUpcardValue(dealerCard);
  return `${categoryLabel} versus dealer ${dealerLabel} is a ${moveName(move)} in the H17 infinite-deck basic strategy chart.`;
}

function moveName(move) {
  return {
    H: "Hit",
    S: "Stand",
    D: "Double",
    P: "Split",
  }[move];
}

function formatHardLabel(total) {
  return total >= 17 ? "17+" : `Hard ${total}`;
}

function formatSoftLabel(total) {
  return `Soft ${total}`;
}

function formatSoftCompactLabel(total) {
  if (total >= 20) {
    return "A,8+";
  }
  return `A,${total - 11}`;
}

function formatPairLabel(value) {
  const label = value === 11 ? "A" : value === 10 ? "10" : String(value);
  return `${label},${label}`;
}

function compareHands(playerHand, dealerCards) {
  const playerScore = handValue(playerHand.cards);
  const dealerScore = handValue(dealerCards);

  if (playerScore.bust) {
    return { label: "Bust", payout: -1 * handMultiplier(playerHand) };
  }
  if (playerScore.blackjack && !playerHand.split && !dealerScore.blackjack) {
    return { label: "Blackjack", payout: 1.5 };
  }
  if (dealerScore.bust) {
    return { label: "Win", payout: 1 * handMultiplier(playerHand) };
  }
  if (dealerScore.blackjack && !playerScore.blackjack) {
    return { label: "Lose", payout: -1 * handMultiplier(playerHand) };
  }
  if (playerScore.total > dealerScore.total) {
    return { label: "Win", payout: 1 * handMultiplier(playerHand) };
  }
  if (playerScore.total < dealerScore.total) {
    return { label: "Lose", payout: -1 * handMultiplier(playerHand) };
  }
  return { label: "Push", payout: 0 };
}

function handMultiplier(hand) {
  return hand.doubled ? 2 : 1;
}

function drawCardFromShoe(shoe) {
  if (shoe.length < 52) {
    const resetShoe = buildShoe();
    return {
      card: resetShoe[0],
      shoe: resetShoe.slice(1),
      reshuffled: true,
    };
  }

  return {
    card: shoe[0],
    shoe: shoe.slice(1),
    reshuffled: false,
  };
}

function autoPlayHand(hand, dealerCard, shoe, options = {}) {
  const currentHand = {
    ...hand,
    cards: [...hand.cards],
    doubled: Boolean(hand.doubled),
  };
  let currentShoe = shoe;
  let reshuffled = false;
  let allowDouble = options.allowDouble ?? false;

  while (true) {
    const score = handValue(currentHand.cards);
    if (score.bust || score.total >= 21) {
      currentHand.finished = true;
      return { hand: currentHand, shoe: currentShoe, reshuffled };
    }

    const nextMove = strategyDecision(currentHand.cards, dealerCard).move;
    if (nextMove === "S" || nextMove === "P") {
      currentHand.finished = true;
      return { hand: currentHand, shoe: currentShoe, reshuffled };
    }

    const { card, shoe: nextShoe, reshuffled: reshuffledNow } = drawCardFromShoe(currentShoe);
    currentShoe = nextShoe;
    reshuffled ||= reshuffledNow;
    currentHand.cards.push(card);

    if (nextMove === "D" && allowDouble && currentHand.cards.length === 3) {
      currentHand.doubled = true;
      currentHand.finished = true;
      return { hand: currentHand, shoe: currentShoe, reshuffled };
    }

    allowDouble = false;
  }
}

function playDealer(dealerCards, shoe) {
  const cards = [...dealerCards];
  let currentShoe = shoe;
  let reshuffled = false;

  while (true) {
    const score = handValue(cards);
    if (score.total > 17) {
      return { cards, shoe: currentShoe, reshuffled };
    }
    if (score.total === 17 && !score.soft) {
      return { cards, shoe: currentShoe, reshuffled };
    }

    const { card, shoe: nextShoe, reshuffled: reshuffledNow } = drawCardFromShoe(currentShoe);
    currentShoe = nextShoe;
    reshuffled ||= reshuffledNow;
    cards.push(card);
  }
}

function initialState() {
  return {
    shoe: buildShoe(),
    playerHands: [],
    dealerCards: [],
    message: "Deal a hand and choose the book move.",
    feedback: null,
    resultSummary: "",
    score: 0,
    streak: 0,
    roundActive: false,
    dealerRevealed: false,
    chartOpen: false,
  };
}

export default function App() {
  const [game, setGame] = useState(initialState);
  const [resultFlash, setResultFlash] = useState(null);

  const currentHand = game.playerHands[0];
  const dealerUpcard = game.dealerCards[0];
  const playerSummary = currentHand ? handValue(currentHand.cards) : null;
  const dealerSummary = game.dealerCards.length ? handValue(game.dealerCards) : null;
  const visibleDealerCards = game.dealerCards.map((card, index) => {
    if (!game.dealerRevealed && index === 1) {
      return { ...card, hidden: true };
    }
    return card;
  });

  const canSplit = Boolean(currentHand && isPair(currentHand.cards) && game.roundActive);
  const canDouble = Boolean(currentHand && currentHand.cards.length === 2 && game.roundActive);

  useEffect(() => {
    if (!game.feedback || (game.feedback.tone !== "correct" && game.feedback.tone !== "incorrect")) {
      return undefined;
    }

    const flash = {
      tone: game.feedback.tone,
      id: `${game.feedback.tone}-${Date.now()}`,
    };

    setResultFlash(flash);

    const timeoutId = window.setTimeout(() => {
      setResultFlash((current) => (current?.id === flash.id ? null : current));
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [game.feedback]);

  useEffect(() => {
    const setAppHeight = () => {
      document.documentElement.style.setProperty("--app-height", window.innerHeight + "px");
    };

    setAppHeight();
    window.addEventListener("resize", setAppHeight);
    window.addEventListener("orientationchange", setAppHeight);

    return () => {
      window.removeEventListener("resize", setAppHeight);
      window.removeEventListener("orientationchange", setAppHeight);
    };
  }, []);

  function dealRound() {
    if (game.roundActive) {
      return;
    }

    setResultFlash(null);

    setGame((current) => {
      let shoe = current.shoe;
      let reshuffled = false;
      const drawn = [];

      for (let count = 0; count < 4; count += 1) {
        const next = drawCardFromShoe(shoe);
        shoe = next.shoe;
        reshuffled ||= next.reshuffled;
        drawn.push(next.card);
      }

      const playerCards = [drawn[0], drawn[2]];
      const dealerCards = [drawn[1], drawn[3]];
      const playerHand = { cards: playerCards, doubled: false, finished: false, split: false };
      const playerResult = handValue(playerCards);
      const dealerResult = handValue(dealerCards);

      let feedback = null;
      let resultSummary = "";
      let dealerRevealed = false;
      let roundActive = true;
      let message = reshuffled
        ? "Fresh shoe shuffled. Choose your move."
        : "Choose the optimal basic-strategy play.";

      if (playerResult.blackjack || dealerResult.blackjack) {
        const outcome = compareHands(playerHand, dealerCards);
        dealerRevealed = true;
        roundActive = false;
        feedback = {
          tone: "neutral",
          title: playerResult.blackjack ? "Natural blackjack" : "Round resolved automatically",
          detail: playerResult.blackjack
            ? "Blackjack pays 3:2 unless the dealer also has blackjack."
            : "Dealer blackjack ends the round immediately.",
        };
        resultSummary = outcome.label;
        message = "Round resolved automatically.";
      }

      return {
        ...current,
        shoe,
        playerHands: [playerHand],
        dealerCards,
        message,
        feedback,
        resultSummary,
        roundActive,
        dealerRevealed,
      };
    });
  }

  function takeAction(move) {
    if (!game.roundActive || !currentHand || !dealerUpcard) {
      return;
    }

    setGame((current) => {
      const playerHand = current.playerHands[0];
      const dealerCard = current.dealerCards[0];
      const correct = strategyDecision(playerHand.cards, dealerCard);
      const isCorrect = move === correct.move;
      let shoe = current.shoe;
      let reshuffled = false;
      let playerHands = [{ ...playerHand, cards: [...playerHand.cards], split: false }];

      if (move === "H") {
        const next = drawCardFromShoe(shoe);
        shoe = next.shoe;
        reshuffled ||= next.reshuffled;
        playerHands[0].cards.push(next.card);
        if (!handValue(playerHands[0].cards).bust) {
          const auto = autoPlayHand(playerHands[0], dealerCard, shoe, { allowDouble: false });
          playerHands[0] = auto.hand;
          shoe = auto.shoe;
          reshuffled ||= auto.reshuffled;
        }
      } else if (move === "D") {
        const next = drawCardFromShoe(shoe);
        shoe = next.shoe;
        reshuffled ||= next.reshuffled;
        playerHands[0].cards.push(next.card);
        playerHands[0].doubled = true;
        playerHands[0].finished = true;
      } else if (move === "P" && isPair(playerHand.cards)) {
        const firstHand = { cards: [playerHand.cards[0]], doubled: false, finished: false, split: true };
        const secondHand = { cards: [playerHand.cards[1]], doubled: false, finished: false, split: true };

        for (const splitHand of [firstHand, secondHand]) {
          const next = drawCardFromShoe(shoe);
          shoe = next.shoe;
          reshuffled ||= next.reshuffled;
          splitHand.cards.push(next.card);
        }

        playerHands = [firstHand, secondHand].map((splitHand) => {
          if (normalizedRank(splitHand.cards[0]) === "A") {
            return { ...splitHand, finished: true };
          }
          return splitHand;
        });

        playerHands = playerHands.map((splitHand) => {
          if (splitHand.finished) {
            return splitHand;
          }
          const auto = autoPlayHand(splitHand, dealerCard, shoe, { allowDouble: true });
          shoe = auto.shoe;
          reshuffled ||= auto.reshuffled;
          return auto.hand;
        });
      } else {
        playerHands[0].finished = true;
      }

      const dealerPlay = playDealer(current.dealerCards, shoe);
      shoe = dealerPlay.shoe;
      reshuffled ||= dealerPlay.reshuffled;
      const outcomes = playerHands.map((hand) => compareHands(hand, dealerPlay.cards));
      const netUnits = outcomes.reduce((sum, outcome) => sum + outcome.payout, 0);

      return {
        ...current,
        shoe,
        playerHands,
        dealerCards: dealerPlay.cards,
        dealerRevealed: true,
        roundActive: false,
        score: isCorrect ? current.score + 1 : current.score,
        streak: isCorrect ? current.streak + 1 : 0,
        feedback: {
          tone: isCorrect ? "correct" : "incorrect",
          title: isCorrect ? "Correct move" : "Wrong move",
          detail: `${explainDecision(playerHand.cards, dealerCard, correct.move, correct.label)} You chose ${moveName(move)}.`,
        },
        message: reshuffled
          ? "Round complete. The shoe was refreshed during play."
          : "Round complete. Deal again to keep training.",
        resultSummary:
          playerHands.length === 1
            ? `${outcomes[0].label}${netUnits !== 0 ? ` • ${formatUnits(netUnits)}` : ""}`
            : `${outcomes.map((outcome, index) => `Hand ${index + 1}: ${outcome.label}`).join(" | ")}${netUnits !== 0 ? ` • ${formatUnits(netUnits)}` : ""}`,
      };
    });
  }

  return (
    <div
      className="min-h-screen px-2 py-2 text-[#e8efe9] sm:px-4 sm:py-4 lg:px-6"
      style={{ minHeight: "var(--app-height)" }}
    >
      <AnimatePresence>
        {resultFlash && <ResultFlash key={resultFlash.id} tone={resultFlash.tone} />}
      </AnimatePresence>

      <div className="mx-auto flex max-w-[1180px] min-h-full flex-col gap-2.5 sm:gap-4">
        <header className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] px-3 py-2.5 shadow-[0_14px_32px_rgba(0,0,0,0.18)] backdrop-blur-sm sm:px-4 sm:py-3">
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-[0.8rem] font-semibold tracking-[-0.03em] text-slate-100 sm:text-[0.95rem]">
                Blackjack Basic Strategy Trainer
              </p>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-400 sm:text-[11px]">
                Dealer hits soft 17. Blackjack pays 3:2. No surrender.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Score" value={game.score} accent="text-white" />
              <StatCard label="Streak" value={game.streak} accent="text-emerald-300" />
              <StatCard label="Result" value={game.resultSummary || "Waiting"} accent="text-slate-200" />
            </div>
          </div>
        </header>

        <section
          className="relative overflow-hidden rounded-[1.6rem] border border-emerald-500/18 bg-[#061411] p-2.5 shadow-[0_24px_70px_rgba(0,0,0,0.34)] flex-1 min-h-0 sm:p-4 lg:p-5"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(9,31,24,0.92),rgba(6,20,17,0.96))]" />
          <div className="pointer-events-none absolute inset-2 rounded-[1.35rem] border border-emerald-400/10 sm:inset-3 sm:rounded-[1.5rem]" />

          <div className="relative mx-auto flex h-full max-w-[760px] flex-col justify-center gap-3 sm:max-w-3xl sm:gap-5">
            <TableLane
              label="Dealer"
              total={dealerSummary ? String(game.dealerRevealed ? dealerSummary.total : dealerUpcardValue(dealerUpcard)) : "?"}
              cards={visibleDealerCards}
              summary={game.dealerCards.length ? handSummary(game.dealerCards, game.dealerRevealed) : "Waiting for deal"}
            />

            

            <TableLane
              label="You"
              total={playerSummary ? String(playerSummary.total) : "?"}
              cards={currentHand?.cards ?? []}
              summary={playerSummary ? handSummary(currentHand.cards, true) : "Click Deal to begin"}
              mobileSpacing="pb-3"
            />

            {game.playerHands.length > 1 && (
              <div className="grid grid-cols-2 gap-2">
                {game.playerHands.map((hand, index) => (
                  <div
                    key={`split-${index + 1}`}
                    className="rounded-[1.55rem] border border-white/8 bg-white/[0.04] px-4 py-4 backdrop-blur-sm"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-400/70">
                      Split Hand {index + 1}
                    </p>
                    <p className="mt-2 text-sm text-white/70">{handSummary(hand.cards, true)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section
          className={`rounded-[1.2rem] border px-3 py-2.5 shadow-[0_14px_38px_rgba(0,0,0,0.18)] backdrop-blur-sm sm:px-4 sm:py-4 ${
            game.feedback?.tone === "correct"
              ? "border-emerald-400/20 bg-emerald-400/[0.08]"
              : game.feedback?.tone === "incorrect"
                ? "border-rose-400/20 bg-rose-400/[0.08]"
                : "border-white/8 bg-white/[0.04]"
          }`}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2.5 sm:items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-xl text-slate-300 sm:h-12 sm:w-12">
                i
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">
                  Strategy Feedback
                </p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-100 sm:text-xl">
                  {game.feedback?.title ?? "Your turn. What is the book move?"}
                </p>
                <p className="mt-1 hidden max-w-4xl text-xs leading-5 text-slate-300/75 sm:block sm:text-sm sm:leading-6">
                  {game.feedback?.detail ??
                    "Choose Hit, Stand, Double, or Split. The trainer checks the chart immediately, then finishes the round so you can reset and go again."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={dealRound}
                disabled={game.roundActive}
                className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200 transition hover:bg-emerald-400/[0.14] disabled:cursor-not-allowed disabled:opacity-35 sm:px-4 sm:text-sm"
              >
                Deal
              </button>
              <button
                type="button"
                onClick={() =>
                  setGame((current) => ({
                    ...current,
                    chartOpen: !current.chartOpen,
                  }))
                }
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/78 transition hover:bg-white/[0.07] sm:px-4 sm:text-sm"
              >
                {game.chartOpen ? "Hide Chart" : "Show Chart"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
          {["H", "S", "D", "P"].map((move) => (
            <ActionButton
              key={move}
              move={move}
              onClick={() => takeAction(move)}
              disabled={!game.roundActive || (move === "P" && !canSplit) || (move === "D" && !canDouble)}
            />
          ))}
        </section>

        <AnimatePresence initial={false}>
          {game.chartOpen && (
            <motion.section
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <StrategyReference
                onClose={() =>
                  setGame((current) => ({
                    ...current,
                    chartOpen: false,
                  }))
                }
              />
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-[0.95rem] border border-white/8 bg-black/20 px-2.5 py-2 sm:px-3">
      <p className="text-[8px] font-semibold uppercase tracking-[0.24em] text-white/35">{label}</p>
      <p className={`mt-1 text-xs font-semibold sm:text-sm ${accent}`}>{value}</p>
    </div>
  );
}

function TableLane({ label, total, cards, summary, mobileSpacing = "" }) {
  return (
    <div className={`flex flex-col items-center ${mobileSpacing}`}>
      <div className="mb-2 flex items-center gap-2 sm:mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-400/75">{label}</p>
        <span className="rounded-xl border border-white/8 bg-black/25 px-2.5 py-1 text-base font-medium text-white/90 sm:px-3 sm:text-lg">
          {total}
        </span>
      </div>
      <div className="flex min-h-24 flex-wrap justify-center gap-2 sm:min-h-32 sm:gap-3">
        {cards.map((card, index) => (
          <PlayingCard key={card.id} card={card} index={index} />
        ))}
      </div>
      <p className="mt-1 text-center text-[10px] uppercase tracking-[0.18em] text-white/18 sm:mt-3 sm:text-[12px] sm:tracking-[0.3em]">
        {summary}
      </p>
    </div>
  );
}

function PlayingCard({ card, index }) {
  if (card.hidden) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10, rotate: -6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
        transition={{ delay: index * 0.08, type: "spring", stiffness: 220, damping: 18 }}
        className="relative h-[6.8rem] w-[4.7rem] rounded-[1rem] border border-white/12 bg-[linear-gradient(145deg,_#d40e10,_#7d0607)] shadow-[0_14px_32px_rgba(0,0,0,0.28)] sm:h-[7.8rem] sm:w-[5.3rem] sm:rounded-[1.1rem] lg:h-[8.4rem] lg:w-[5.8rem]"
      >
        <div className="absolute inset-2 rounded-[1rem] border border-white/25 bg-[radial-gradient(circle,_rgba(255,255,255,0.14),_transparent_58%)]" />
        <div className="absolute inset-[10px] rounded-[0.95rem] border border-white/18 [background-image:radial-gradient(circle,_rgba(255,255,255,0.28)_1.2px,transparent_1.2px)] [background-size:12px_12px]" />
        <div className="absolute inset-0 flex items-center justify-center text-3xl text-white/75 sm:text-4xl">◈</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, rotate: -7, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 230, damping: 20 }}
      className="relative h-[6.8rem] w-[4.7rem] rounded-[1rem] border border-slate-200/35 bg-[linear-gradient(165deg,_#f7f5ef,_#ece5d8)] p-2 shadow-[0_14px_32px_rgba(0,0,0,0.28)] sm:h-[7.8rem] sm:w-[5.3rem] sm:rounded-[1.1rem] sm:p-2.5 lg:h-[8.4rem] lg:w-[5.8rem]"
    >
      <div className={`relative h-full ${card.color}`}>
        <div className="absolute left-1.5 top-1.5 text-left leading-none sm:left-2 sm:top-2">
          <div className="text-[1.15rem] font-bold sm:text-[1.3rem]">{card.rank}</div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center text-[2.35rem] sm:text-[2.9rem]">{card.suit}</div>
        <div className="absolute bottom-1.5 right-1.5 rotate-180 text-left leading-none sm:bottom-2 sm:right-2">
          <div className="text-[1.15rem] font-bold sm:text-[1.3rem]">{card.rank}</div>
        </div>
      </div>
    </motion.div>
  );
}

function ActionButton({ move, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group rounded-[0.95rem] border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left shadow-[0_12px_32px_rgba(0,0,0,0.14)] transition hover:border-white/14 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35 sm:px-4 sm:py-3 lg:py-2.5"
    >
      <p className="text-lg font-semibold tracking-[-0.05em] text-white sm:text-2xl">{moveName(move).toUpperCase()}</p>
      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-slate-500 transition group-hover:text-slate-400 sm:mt-1.5 sm:text-[11px]">
        {ACTION_DETAILS[move]}
      </p>
    </button>
  );
}

function StrategyReference({ onClose }) {
  return (
    <div className="rounded-[1.5rem] border border-white/8 bg-[#121212]/95 px-3 py-3 shadow-[0_20px_56px_rgba(0,0,0,0.22)] backdrop-blur-sm sm:px-4 sm:py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-400/70">
            Basic Strategy Reference
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">
            Basic Strategy Reference
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close strategy reference"
          className="rounded-full border border-white/10 px-3 py-2 text-sm text-slate-400 transition hover:border-white/18 hover:bg-white/[0.05] hover:text-white"
        >
          ×
        </button>
      </div>

      <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex flex-col gap-5">
          {REFERENCE_SECTIONS.map((section) => (
            <ReferenceGridSection key={section.title} section={section} />
          ))}
        </div>

        <aside className="hidden flex-col gap-4 rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4 xl:flex">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Legend</p>
            <div className="mt-4 grid gap-3">
              {CHART_LEGEND.map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-xl font-semibold ${MOVE_COLORS[item.key]}`}>
                    {item.key}
                  </span>
                  <span className="text-xl text-slate-200">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto rounded-[1.35rem] border border-emerald-500/10 bg-emerald-500/[0.05] p-4 text-sm leading-8 text-slate-300/85">
            Basic strategy is the mathematically optimal way to play every hand. Following the book reduces the house edge to less than 0.5%.
          </div>
        </aside>
      </div>
    </div>
  );
}

function ResultFlash({ tone }) {
  if (tone === "correct") {
    return (
      <motion.div
        className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.16),_transparent_48%)]" />
        <div className="absolute inset-x-0 top-[14%] text-center">
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/12 px-4 py-2 text-sm font-semibold uppercase tracking-[0.28em] text-emerald-100 shadow-[0_14px_40px_rgba(16,185,129,0.22)] backdrop-blur-sm sm:text-base"
          >
            Correct
          </motion.div>
        </div>
        {Array.from({ length: 26 }).map((_, index) => {
          const chipClass =
            index % 4 === 0
              ? "bg-emerald-300"
              : index % 4 === 1
                ? "bg-cyan-300"
                : index % 4 === 2
                  ? "bg-yellow-200"
                  : "bg-white";

          return (
            <motion.span
              key={`confetti-${index}`}
              className={`absolute top-[-12%] h-3 w-2 rounded-full ${chipClass}`}
              style={{
                left: `${4 + index * 3.6}%`,
                rotate: `${(index % 6) * 18}deg`,
              }}
              initial={{ y: -40, opacity: 0, scale: 0.7 }}
              animate={{
                y: ["0vh", `${82 + (index % 4) * 5}vh`],
                x: [0, index % 2 === 0 ? -18 : 18],
                opacity: [0, 1, 1, 0],
                rotate: [0, index % 2 === 0 ? -220 : 220],
                scale: [0.7, 1, 0.9],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 1.05 + (index % 5) * 0.06,
                ease: "easeOut",
                delay: (index % 6) * 0.025,
              }}
            />
          );
        })}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(239,68,68,0.14),_transparent_52%)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.75, rotate: -10 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, scale: 0.86 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="flex h-40 w-40 items-center justify-center rounded-full border border-rose-400/25 bg-rose-500/10 text-[7rem] font-black leading-none text-rose-500 shadow-[0_20px_70px_rgba(239,68,68,0.28)] sm:h-52 sm:w-52 sm:text-[9rem]"
      >
        ×
      </motion.div>
    </motion.div>
  );
}
function ReferenceGridSection({ section }) {
  return (
    <div>
      <div className="mb-2 grid grid-cols-[52px_repeat(10,minmax(0,1fr))] gap-1 text-center text-[11px] font-semibold text-slate-400 sm:grid-cols-[88px_repeat(10,minmax(0,1fr))]">
        <div className="text-left text-[11px] uppercase tracking-[0.3em] text-slate-500">{section.title}</div>
        {DEALER_KEYS.map((dealer) => (
          <div key={`${section.title}-head-${dealer}`}>{dealer === 11 ? "A" : dealer}</div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {section.rows.map((row) => (
          <div key={`${section.title}-${row}`} className="grid grid-cols-[52px_repeat(10,minmax(0,1fr))] gap-1 sm:grid-cols-[88px_repeat(10,minmax(0,1fr))]">
            <div className="flex items-center justify-center rounded-lg text-[11px] font-semibold text-slate-300 sm:text-sm">
              {section.format(row)}
            </div>
            {DEALER_KEYS.map((dealer) => {
              const move = section.strategy[row][dealer];
              return (
                <div
                  key={`${section.title}-${row}-${dealer}`}
                  className={`flex h-8 items-center justify-center rounded-lg text-[11px] font-semibold sm:h-10 sm:text-sm ${MOVE_COLORS[move]}`}
                >
                  {move}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function handSummary(cards, revealAll) {
  if (!cards.length) {
    return "No cards";
  }

  if (!revealAll) {
    return `${cards[0].rank}${cards[0].suit} showing`;
  }

  const score = handValue(cards);
  const labels = cards.map((card) => `${card.rank}${card.suit}`).join(" ");
  const suffix = score.blackjack ? " • Blackjack" : score.soft ? " • Soft" : "";
  return `${labels} • ${score.total}${suffix}`;
}

function formatUnits(units) {
  const prefix = units > 0 ? "+" : "";
  return `${prefix}${units.toFixed(1)}u`;
}
