import { useEffect, useRef, useState } from 'react';
import { useGame } from './useGame';
import { monsterIcon } from './icons';
import type { BaseClassName } from '../game/types';
import warriorIdle from '../assets/avatars/warrior_idle.png';
import rogueIdle from '../assets/avatars/rogue_idle.png';
import wizardIdle from '../assets/avatars/wizard_idle.png';
import warriorAtk from '../assets/avatars/warrior_attack.png';
import rogueAtk from '../assets/avatars/rogue_attack.png';
import wizardAtk from '../assets/avatars/wizard_attack.png';

/** 4-frame idle sprite sheets (animated via CSS steps). */
const CLASS_SHEET: Record<BaseClassName, string> = {
  Warrior: warriorIdle,
  Rogue: rogueIdle,
  Wizard: wizardIdle,
};
/** Single attack-pose frame, shown while striking. */
const CLASS_ATK: Record<BaseClassName, string> = {
  Warrior: warriorAtk,
  Rogue: rogueAtk,
  Wizard: wizardAtk,
};

interface DamageFloat {
  id: number;
  text: string;
  side: 'enemy' | 'player';
}

/**
 * Visual combat stage: the player's class avatar trades blows with the current
 * monster. Animations are driven purely by watching HP deltas from the game
 * tick — no engine involvement.
 */
export function CombatArena() {
  const state = useGame();
  const p = state.player;
  const m = state.currentMonster;

  const [playerAttacking, setPlayerAttacking] = useState(false);
  const [enemyAttacking, setEnemyAttacking] = useState(false);
  const [enemyHit, setEnemyHit] = useState(false);
  const [playerHit, setPlayerHit] = useState(false);
  const [floats, setFloats] = useState<DamageFloat[]>([]);

  const prevMonsterHp = useRef<number | null>(null);
  const prevPlayerHp = useRef<number | null>(null);
  const prevName = useRef<string | undefined>(undefined);
  const floatId = useRef(0);

  const monsterHp = m?.hp ?? null;
  const monsterName = m?.name;
  const playerHp = p?.currentHp ?? null;

  const addFloat = (text: string, side: 'enemy' | 'player') => {
    const id = ++floatId.current;
    setFloats((f) => [...f, { id, text, side }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 850);
  };

  // Player landed a hit when the monster's HP drops.
  useEffect(() => {
    if (monsterHp == null) return;
    if (monsterName !== prevName.current) {
      prevName.current = monsterName;
      prevMonsterHp.current = monsterHp;
      return;
    }
    const prev = prevMonsterHp.current;
    prevMonsterHp.current = monsterHp;
    if (prev != null && monsterHp < prev) {
      setPlayerAttacking(true);
      setEnemyHit(true);
      addFloat(`-${Math.round(prev - monsterHp).toLocaleString()}`, 'enemy');
      setTimeout(() => setPlayerAttacking(false), 260);
      setTimeout(() => setEnemyHit(false), 260);
    }
  }, [monsterHp, monsterName]);

  // Monster landed a hit when the player's HP drops.
  useEffect(() => {
    if (playerHp == null) return;
    const prev = prevPlayerHp.current;
    prevPlayerHp.current = playerHp;
    if (prev != null && playerHp < prev) {
      setEnemyAttacking(true);
      setPlayerHit(true);
      addFloat(`-${Math.round(prev - playerHp).toLocaleString()}`, 'player');
      setTimeout(() => setEnemyAttacking(false), 260);
      setTimeout(() => setPlayerHit(false), 260);
    }
  }, [playerHp]);

  if (!p) return null;

  return (
    <div className="combat-arena">
      <div className={`fighter player${playerAttacking ? ' attacking' : ''}${playerHit ? ' hit' : ''}`}>
        <div
          className={`fighter-sprite${playerAttacking ? ' attack-frame' : ' idle-anim'}`}
          style={{
            backgroundImage: `url(${(playerAttacking ? CLASS_ATK : CLASS_SHEET)[p.baseClassName]})`,
          }}
          role="img"
          aria-label={p.className}
        />
        <div className="fighter-name">{p.className}</div>
      </div>

      <div className="vs">⚔</div>

      <div className={`fighter enemy${enemyAttacking ? ' attacking' : ''}${enemyHit ? ' hit' : ''}`}>
        <div className="fighter-emoji">{m ? monsterIcon(m.name) : '❓'}</div>
        <div className="fighter-name">{m?.name ?? '—'}</div>
      </div>

      {floats.map((f) => (
        <span key={f.id} className={`damage-float ${f.side}`}>{f.text}</span>
      ))}
    </div>
  );
}
