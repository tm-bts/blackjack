// Pure blackjack game logic.
// Rules: 6-deck shoe, dealer stands on soft 17, blackjack pays 3:2,
// double on any 2, split (one re-split allowed, split aces get one card each),
// insurance pays 2:1, surrender disabled.

export type Suit = '♠' | '♥' | '♦' | '♣'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export type Card = { rank: Rank; suit: Suit }

export const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function buildShoe(decks = 6): Card[] {
  const shoe: Card[] = []
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) for (const r of RANKS) shoe.push({ rank: r, suit: s })
  }
  return shuffle(shoe)
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function cardValue(c: Card): number {
  if (c.rank === 'A') return 11
  if (c.rank === 'J' || c.rank === 'Q' || c.rank === 'K' || c.rank === '10') return 10
  return parseInt(c.rank, 10)
}

// Returns best total <= 21 if possible, otherwise min total. Also reports if hand is soft.
export function handTotal(hand: Card[]): { total: number; soft: boolean } {
  let total = 0
  let aces = 0
  for (const c of hand) {
    total += cardValue(c)
    if (c.rank === 'A') aces++
  }
  let soft = aces > 0 && total <= 21
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
    soft = aces > 0
  }
  return { total, soft: soft && total <= 21 && hand.some((c) => c.rank === 'A') && total !== handHardTotal(hand) }
}

function handHardTotal(hand: Card[]): number {
  let total = 0
  for (const c of hand) total += c.rank === 'A' ? 1 : cardValue(c)
  return total
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handTotal(hand).total === 21
}

export function isBust(hand: Card[]): boolean {
  return handTotal(hand).total > 21
}

export type HandState = {
  cards: Card[]
  bet: number
  doubled: boolean
  fromSplit: boolean
  fromSplitAces: boolean
  finished: boolean
  surrendered: boolean
}

export type Phase =
  | 'betting'
  | 'player'
  | 'dealer'
  | 'payout'
  | 'insurance' // waiting on insurance decision when dealer shows A

export type GameState = {
  shoe: Card[]
  discardIdx: number // how many cards have been dealt from shoe
  dealer: Card[]
  hands: HandState[]
  activeHandIdx: number
  phase: Phase
  bet: number
  chips: number
  insuranceBet: number
  message: string
  lastDelta: number // net chip change last round
  reshuffleAt: number // when discardIdx reaches this, reshuffle before next round
}

export const MIN_BET = 5
export const MAX_BET = 10000

export function newGame(chips: number): GameState {
  const shoe = buildShoe(6)
  return {
    shoe,
    discardIdx: 0,
    dealer: [],
    hands: [],
    activeHandIdx: 0,
    phase: 'betting',
    bet: 25,
    chips,
    insuranceBet: 0,
    message: 'Place your bet.',
    lastDelta: 0,
    reshuffleAt: Math.floor(shoe.length * 0.75),
  }
}

function draw(state: GameState): Card {
  if (state.discardIdx >= state.shoe.length) {
    state.shoe = buildShoe(6)
    state.discardIdx = 0
    state.reshuffleAt = Math.floor(state.shoe.length * 0.75)
  }
  return state.shoe[state.discardIdx++]
}

export function startRound(prev: GameState, bet: number): GameState {
  if (bet < MIN_BET) throw new Error(`Min bet ${MIN_BET}`)
  if (bet > prev.chips) throw new Error('Not enough chips')
  const s: GameState = {
    ...prev,
    dealer: [],
    hands: [],
    activeHandIdx: 0,
    insuranceBet: 0,
    lastDelta: 0,
    message: '',
  }
  // Reshuffle if past cut card
  if (s.discardIdx >= s.reshuffleAt) {
    s.shoe = buildShoe(6)
    s.discardIdx = 0
    s.reshuffleAt = Math.floor(s.shoe.length * 0.75)
  }
  s.bet = bet
  s.chips -= bet
  const hand: HandState = {
    cards: [],
    bet,
    doubled: false,
    fromSplit: false,
    fromSplitAces: false,
    finished: false,
    surrendered: false,
  }
  s.hands = [hand]
  // Deal: player, dealer, player, dealer
  hand.cards.push(draw(s))
  s.dealer.push(draw(s))
  hand.cards.push(draw(s))
  s.dealer.push(draw(s))

  const playerBJ = isBlackjack(hand.cards)
  const dealerUp = s.dealer[0]
  if (dealerUp.rank === 'A') {
    // offer insurance, unless player already has BJ (we still offer insurance; even-money common but skip for simplicity)
    s.phase = 'insurance'
    s.message = 'Dealer shows Ace. Insurance?'
    return s
  }
  if (dealerUp.rank === '10' || dealerUp.rank === 'J' || dealerUp.rank === 'Q' || dealerUp.rank === 'K') {
    // peek for dealer BJ
    if (isBlackjack(s.dealer)) {
      hand.finished = true
      return settle(s)
    }
  }
  if (playerBJ) {
    hand.finished = true
    return settle(s)
  }
  s.phase = 'player'
  s.message = 'Your move.'
  return s
}

export function takeInsurance(prev: GameState, take: boolean): GameState {
  const s = { ...prev, hands: prev.hands.map((h) => ({ ...h, cards: [...h.cards] })), dealer: [...prev.dealer] }
  const hand = s.hands[0]
  const insuranceCost = take ? Math.floor(hand.bet / 2) : 0
  if (take && insuranceCost > s.chips) {
    s.message = 'Not enough chips for insurance.'
    return s
  }
  s.insuranceBet = insuranceCost
  s.chips -= insuranceCost

  const dealerBJ = isBlackjack(s.dealer)
  if (dealerBJ) {
    hand.finished = true
    // insurance pays 2:1; main bet lost (unless player also BJ -> push)
    return settle(s)
  } else {
    // insurance lost; continue play
    s.insuranceBet = -insuranceCost // mark lost for settle display
    if (isBlackjack(hand.cards)) {
      hand.finished = true
      return settle(s)
    }
    s.phase = 'player'
    s.message = 'Your move.'
    return s
  }
}

export function hit(prev: GameState): GameState {
  const s = deepClone(prev)
  const hand = s.hands[s.activeHandIdx]
  hand.cards.push(draw(s))
  const { total } = handTotal(hand.cards)
  if (total >= 21) {
    hand.finished = true
    return advance(s)
  }
  return s
}

export function stand(prev: GameState): GameState {
  const s = deepClone(prev)
  s.hands[s.activeHandIdx].finished = true
  return advance(s)
}

export function canDouble(state: GameState): boolean {
  const hand = state.hands[state.activeHandIdx]
  if (!hand) return false
  return hand.cards.length === 2 && !hand.doubled && state.chips >= hand.bet
}

export function double(prev: GameState): GameState {
  const s = deepClone(prev)
  const hand = s.hands[s.activeHandIdx]
  if (!canDouble(s)) return s
  s.chips -= hand.bet
  hand.bet *= 2
  hand.doubled = true
  hand.cards.push(draw(s))
  hand.finished = true
  return advance(s)
}

export function canSplit(state: GameState): boolean {
  const hand = state.hands[state.activeHandIdx]
  if (!hand) return false
  if (hand.cards.length !== 2) return false
  if (state.hands.length >= 4) return false
  if (state.chips < hand.bet) return false
  return cardValue(hand.cards[0]) === cardValue(hand.cards[1])
}

export function split(prev: GameState): GameState {
  const s = deepClone(prev)
  const hand = s.hands[s.activeHandIdx]
  if (!canSplit(s)) return s
  const aces = hand.cards[0].rank === 'A'
  const second = hand.cards.pop()!
  s.chips -= hand.bet
  const newHand: HandState = {
    cards: [second],
    bet: hand.bet,
    doubled: false,
    fromSplit: true,
    fromSplitAces: aces,
    finished: false,
    surrendered: false,
  }
  hand.fromSplit = true
  hand.fromSplitAces = aces
  hand.cards.push(draw(s))
  newHand.cards.push(draw(s))
  s.hands.splice(s.activeHandIdx + 1, 0, newHand)
  // Split aces: only one card each, no more actions
  if (aces) {
    hand.finished = true
    newHand.finished = true
    return advance(s)
  }
  // if either drew a 21, auto-finish that hand
  if (handTotal(hand.cards).total === 21) hand.finished = true
  return advance(s)
}

function advance(s: GameState): GameState {
  // move to next unfinished hand
  while (s.activeHandIdx < s.hands.length && s.hands[s.activeHandIdx].finished) {
    s.activeHandIdx++
  }
  if (s.activeHandIdx >= s.hands.length) {
    return playDealer(s)
  }
  // auto-finish split aces (each gets one card only)
  const cur = s.hands[s.activeHandIdx]
  if (cur.fromSplitAces) {
    cur.finished = true
    return advance(s)
  }
  if (handTotal(cur.cards).total === 21) {
    cur.finished = true
    return advance(s)
  }
  s.phase = 'player'
  return s
}

function playDealer(s: GameState): GameState {
  s.phase = 'dealer'
  // if all player hands busted/surrendered, dealer doesn't need to draw further, but reveal hole anyway
  const anyLive = s.hands.some((h) => !isBust(h.cards) && !h.surrendered)
  if (anyLive) {
    // dealer stands on all 17 (soft 17 stands too)
    while (true) {
      const { total } = handTotal(s.dealer)
      if (total >= 17) break
      s.dealer.push(draw(s))
    }
  }
  return settle(s)
}

function settle(s: GameState): GameState {
  const dealerTotal = handTotal(s.dealer).total
  const dealerBJ = isBlackjack(s.dealer)
  let delta = 0
  for (const hand of s.hands) {
    if (hand.surrendered) {
      // already paid half-loss
      continue
    }
    const playerTotal = handTotal(hand.cards).total
    const playerBJ = isBlackjack(hand.cards) && !hand.fromSplit
    if (playerBJ && !dealerBJ) {
      // 3:2 payout on original bet
      const win = Math.floor(hand.bet * 1.5)
      s.chips += hand.bet + win
      delta += win
    } else if (playerBJ && dealerBJ) {
      s.chips += hand.bet // push
    } else if (isBust(hand.cards)) {
      delta -= hand.bet
    } else if (dealerBJ) {
      delta -= hand.bet
    } else if (dealerTotal > 21 || playerTotal > dealerTotal) {
      s.chips += hand.bet * 2
      delta += hand.bet
    } else if (playerTotal === dealerTotal) {
      s.chips += hand.bet // push
    } else {
      delta -= hand.bet
    }
  }
  // insurance resolution
  if (s.insuranceBet > 0) {
    // took insurance and dealer has BJ → 2:1
    s.chips += s.insuranceBet * 3
    delta += s.insuranceBet * 2
  } else if (s.insuranceBet < 0) {
    // took insurance, dealer no BJ, lost
    delta += s.insuranceBet // negative
  }
  s.lastDelta = delta
  s.phase = 'payout'
  s.message = describeOutcome(delta, s.hands, s.dealer)
  return s
}

function describeOutcome(delta: number, hands: HandState[], dealer: Card[]): string {
  const dealerBJ = isBlackjack(dealer)
  if (hands.length === 1) {
    const h = hands[0]
    if (isBlackjack(h.cards) && !dealerBJ) return `Blackjack! +${delta}`
    if (isBlackjack(h.cards) && dealerBJ) return 'Both blackjack — push'
    if (dealerBJ) return 'Dealer blackjack'
    if (isBust(h.cards)) return 'Bust'
    if (delta > 0) return `You win +${delta}`
    if (delta < 0) return `You lose ${delta}`
    return 'Push'
  }
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `${delta}`
  return 'Push'
}

export function nextRound(prev: GameState): GameState {
  return {
    ...prev,
    dealer: [],
    hands: [],
    activeHandIdx: 0,
    phase: 'betting',
    insuranceBet: 0,
    message: 'Place your bet.',
    lastDelta: 0,
  }
}

function deepClone(s: GameState): GameState {
  return {
    ...s,
    shoe: s.shoe, // shoe is large, keep reference, mutate discardIdx
    dealer: [...s.dealer],
    hands: s.hands.map((h) => ({ ...h, cards: [...h.cards] })),
  }
}
