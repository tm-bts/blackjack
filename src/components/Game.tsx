import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameState } from '../lib/blackjack'
import {
  MIN_BET,
  canDouble,
  canSplit,
  double,
  handTotal,
  hit,
  isBlackjack,
  nextRound,
  newGame,
  split,
  stand,
  startRound,
  takeInsurance,
} from '../lib/blackjack'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Card } from './Card'

const BONUS_AMOUNT = 500
const BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000

export function Game() {
  const { profile, refreshProfile } = useAuth()
  const [game, setGame] = useState<GameState | null>(null)
  const [betInput, setBetInput] = useState(25)
  const [persisting, setPersisting] = useState(false)
  const initialized = useRef(false)

  // Initialize game when profile loads
  useEffect(() => {
    if (!profile || initialized.current) return
    setGame(newGame(profile.chips))
    setBetInput((b) => Math.min(Math.max(MIN_BET, b), profile.chips || MIN_BET))
    initialized.current = true
  }, [profile])

  // Persist chips + stats to Supabase when payout settles
  const persistAfterRound = async (g: GameState) => {
    if (!profile) return
    setPersisting(true)
    const handsPlayed = g.hands.length
    const handsWon = g.lastDelta > 0 ? 1 : 0 // coarse — counts a winning round
    const { error } = await supabase
      .from('profiles')
      .update({
        chips: g.chips,
        hands_played: profile.hands_played + handsPlayed,
        hands_won: profile.hands_won + handsWon,
      })
      .eq('id', profile.id)
    if (error) console.error(error)
    await refreshProfile()
    setPersisting(false)
  }

  // Daily bonus
  const bonusAvailable = useMemo(() => {
    if (!profile) return false
    if (!profile.last_bonus_at) return true
    return Date.now() - new Date(profile.last_bonus_at).getTime() >= BONUS_COOLDOWN_MS
  }, [profile])

  const bonusCountdown = useMemo(() => {
    if (!profile || !profile.last_bonus_at) return ''
    const ms = BONUS_COOLDOWN_MS - (Date.now() - new Date(profile.last_bonus_at).getTime())
    if (ms <= 0) return ''
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h}h ${m}m`
  }, [profile])

  async function claimBonus() {
    if (!profile || !game) return
    const newChips = profile.chips + BONUS_AMOUNT
    const { error } = await supabase
      .from('profiles')
      .update({ chips: newChips, last_bonus_at: new Date().toISOString() })
      .eq('id', profile.id)
    if (error) return alert(error.message)
    await refreshProfile()
    setGame({ ...game, chips: newChips })
  }

  if (!profile || !game) return <div className="loading">Dealing in…</div>

  const showDealerHole = game.phase === 'dealer' || game.phase === 'payout'
  const dealerVisible = showDealerHole ? game.dealer : [game.dealer[0]].filter(Boolean)
  const dealerTotal = showDealerHole && game.dealer.length ? handTotal(game.dealer).total : null
  const activeIdx = game.activeHandIdx

  function deal() {
    try {
      const g = startRound(game!, Math.min(betInput, game!.chips))
      setGame(g)
      if (g.phase === 'payout') persistAfterRound(g)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  function act(next: GameState) {
    setGame(next)
    if (next.phase === 'payout') persistAfterRound(next)
  }

  const playerTurn = game.phase === 'player'
  const insuranceTurn = game.phase === 'insurance'
  const betting = game.phase === 'betting'
  const payout = game.phase === 'payout'

  return (
    <div className="table">
      <div className="bonus-bar">
        {bonusAvailable ? (
          <button className="bonus" onClick={claimBonus}>Claim daily bonus +{BONUS_AMOUNT} 🪙</button>
        ) : (
          <span className="bonus-wait">Next daily bonus in {bonusCountdown}</span>
        )}
      </div>

      <section className="dealer-area">
        <div className="label">
          Dealer
          {dealerTotal !== null && <span className="total"> — {dealerTotal}</span>}
        </div>
        <div className="hand">
          {game.dealer.map((c, i) => (
            <Card key={i} card={i === 1 && !showDealerHole ? undefined : c} hidden={i === 1 && !showDealerHole} />
          ))}
          {dealerVisible.length === 0 && <div className="hand-empty">—</div>}
        </div>
      </section>

      <div className="felt-msg">
        {game.message}
        {payout && game.lastDelta !== 0 && (
          <span className={`delta ${game.lastDelta > 0 ? 'pos' : 'neg'}`}>
            {game.lastDelta > 0 ? `+${game.lastDelta}` : game.lastDelta}
          </span>
        )}
      </div>

      <section className="player-area">
        {game.hands.length === 0 ? (
          <div className="hand hand-empty">Place your bet to deal</div>
        ) : (
          game.hands.map((h, i) => {
            const total = handTotal(h.cards).total
            const isActive = i === activeIdx && (playerTurn || insuranceTurn)
            const bj = isBlackjack(h.cards) && !h.fromSplit
            return (
              <div key={i} className={`player-hand ${isActive ? 'active' : ''}`}>
                <div className="label">
                  You{game.hands.length > 1 ? ` (hand ${i + 1})` : ''}
                  <span className="total"> — {total}{bj ? ' BJ' : ''}</span>
                  <span className="bet">bet {h.bet}{h.doubled ? ' (d)' : ''}</span>
                </div>
                <div className="hand">
                  {h.cards.map((c, j) => <Card key={j} card={c} />)}
                </div>
              </div>
            )
          })
        )}
      </section>

      <section className="controls">
        {betting && (
          <div className="betting-row">
            <label className="bet-label">Bet</label>
            <input
              type="number"
              min={MIN_BET}
              max={game.chips}
              value={betInput}
              onChange={(e) => setBetInput(Math.max(MIN_BET, Math.min(game.chips, Number(e.target.value) || 0)))}
            />
            <div className="chip-btns">
              {[5, 25, 100, 500].map((v) => (
                <button key={v} onClick={() => setBetInput(Math.min(game.chips, betInput + v))}>+{v}</button>
              ))}
              <button onClick={() => setBetInput(MIN_BET)}>clear</button>
              <button onClick={() => setBetInput(game.chips)}>all-in</button>
            </div>
            <button className="primary" disabled={persisting || betInput < MIN_BET || betInput > game.chips} onClick={deal}>Deal</button>
          </div>
        )}
        {insuranceTurn && (
          <div className="action-row">
            <button className="primary" onClick={() => act(takeInsurance(game, true))}>Take insurance ({Math.floor(game.hands[0].bet / 2)})</button>
            <button onClick={() => act(takeInsurance(game, false))}>No insurance</button>
          </div>
        )}
        {playerTurn && (
          <div className="action-row">
            <button className="primary" onClick={() => act(hit(game))}>Hit</button>
            <button className="primary" onClick={() => act(stand(game))}>Stand</button>
            <button disabled={!canDouble(game)} onClick={() => act(double(game))}>Double</button>
            <button disabled={!canSplit(game)} onClick={() => act(split(game))}>Split</button>
          </div>
        )}
        {payout && (
          <div className="action-row">
            <button className="primary" onClick={() => setGame(nextRound(game))} disabled={persisting}>
              {persisting ? 'Saving…' : game.chips < MIN_BET ? 'Out of chips!' : 'Next hand'}
            </button>
          </div>
        )}
      </section>

      {game.chips < MIN_BET && payout && (
        <div className="broke">
          Out of chips. Claim your daily bonus when available, or top back up tomorrow.
        </div>
      )}
    </div>
  )
}
