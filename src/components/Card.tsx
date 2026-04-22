import type { Card as CardT } from '../lib/blackjack'

export function Card({ card, hidden }: { card?: CardT; hidden?: boolean }) {
  if (hidden || !card) {
    return <div className="card card-back" aria-label="face down card" />
  }
  const red = card.suit === '♥' || card.suit === '♦'
  return (
    <div className={`card ${red ? 'red' : 'black'}`} aria-label={`${card.rank}${card.suit}`}>
      <div className="corner tl">
        <div className="rank">{card.rank}</div>
        <div className="suit">{card.suit}</div>
      </div>
      <div className="center">{card.suit}</div>
      <div className="corner br">
        <div className="rank">{card.rank}</div>
        <div className="suit">{card.suit}</div>
      </div>
    </div>
  )
}
