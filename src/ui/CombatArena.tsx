import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useGame } from './useGame';
import { monsterIcon } from './icons';
import { CLASS_SPRITE, monsterSprite } from './sprites';

type PlayerAnim = 'idle' | 'attack' | 'crit' | 'cast' | 'whiff' | 'hurt' | 'victory' | 'defeat';
type EnemyAnim = 'idle' | 'attack' | 'whiff' | 'hurt' | 'dying' | 'enter';
type VfxType = 'slash' | 'impact' | 'crit' | 'magic' | 'projectile' | 'guard';

interface Vfx { id: number; type: VfxType }
interface Float { id: number; text: string; side: 'enemy' | 'player'; crit?: boolean; heal?: boolean }
interface MonsterView { name: string; isChampion: boolean; isBoss: boolean }

/**
 * FFBE-style combat stage. Reads a per-tick `combatFx` packet from the store and
 * choreographs a full exchange: the player steps in to strike (or casts), the
 * enemy reacts and counters, hits spawn slash/impact/crit VFX, and slain enemies
 * play a death sequence before the next foe slides in. No engine involvement.
 */
export function CombatArena() {
  const state = useGame();
  const fx = useGameStore((s) => s.combatFx);
  const p = state.player;
  const live = state.currentMonster;

  const [playerAnim, setPlayerAnim] = useState<PlayerAnim>('idle');
  const [enemyAnim, setEnemyAnim] = useState<EnemyAnim>('idle');
  const [shake, setShake] = useState<'' | 'shake' | 'shake-hard'>('');
  const [vfx, setVfx] = useState<Vfx[]>([]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [view, setView] = useState<MonsterView | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seq = useRef(0);
  const lastFxId = useRef(0);
  const viewRef = useRef<MonsterView | null>(null);
  viewRef.current = view;

  const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
  const addVfx = (type: VfxType, life = 600) => {
    const id = ++seq.current;
    setVfx((v) => [...v, { id, type }]);
    at(life, () => setVfx((v) => v.filter((x) => x.id !== id)));
  };
  const addFloat = (text: string, side: 'enemy' | 'player', opts: { crit?: boolean; heal?: boolean } = {}) => {
    const id = ++seq.current;
    setFloats((f) => [...f, { id, text, side, ...opts }]);
    at(950, () => setFloats((f) => f.filter((x) => x.id !== id)));
  };
  const flash = (kind: '' | 'shake' | 'shake-hard') => { setShake(kind); if (kind) at(280, () => setShake('')); };

  const toView = (m: typeof live): MonsterView | null =>
    m ? { name: m.name, isChampion: !!(m as { isChampion?: boolean }).isChampion, isBoss: m.monsterType === 'boss' || !!(m as { isFinalBoss?: boolean }).isFinalBoss } : null;

  // Seed / hard-sync the displayed monster (first mount, or a non-kill swap such as a boss challenge).
  useEffect(() => {
    if (!live) { setView(null); return; }
    if (!viewRef.current) { setView(toView(live)); return; }
    if (viewRef.current.name !== live.name && fx.id === lastFxId.current) {
      // changed outside of a kill tick → slide the new foe in
      setView(toView(live)); setEnemyAnim('enter'); at(420, () => setEnemyAnim('idle'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.name]);

  // The heartbeat: one choreographed exchange per combat tick.
  useEffect(() => {
    if (fx.id === 0 || fx.id === lastFxId.current) return;
    lastFxId.current = fx.id;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const { playerDmg, monsterDmg, playerCrit, spell, playerMiss, monsterMiss, kill, death } = fx;

    // --- 1. Player's turn -------------------------------------------------
    if (spell) {
      setPlayerAnim('cast');
      addVfx('magic', 700);
      at(260, () => { addVfx('projectile', 360); });
      at(560, () => {
        if (playerDmg > 0) { setEnemyAnim('hurt'); addVfx('impact'); addFloat(`-${playerDmg.toLocaleString()}`, 'enemy', { crit: playerCrit }); flash('shake'); at(240, () => setEnemyAnim('idle')); }
      });
      at(820, () => setPlayerAnim('idle'));
    } else if (playerMiss) {
      setPlayerAnim('whiff');
      at(180, () => { setEnemyAnim('whiff'); addFloat('MISS', 'enemy'); at(220, () => setEnemyAnim('idle')); });
      at(460, () => setPlayerAnim('idle'));
    } else {
      setPlayerAnim(playerCrit ? 'crit' : 'attack');
      at(200, () => {
        addVfx('slash', 400);
        if (playerDmg > 0) {
          setEnemyAnim('hurt');
          addVfx(playerCrit ? 'crit' : 'impact');
          addFloat(`-${playerDmg.toLocaleString()}`, 'enemy', { crit: playerCrit });
          flash(playerCrit ? 'shake-hard' : 'shake');
          at(260, () => setEnemyAnim('idle'));
        }
      });
      at(playerCrit ? 520 : 420, () => setPlayerAnim('idle'));
    }

    // --- 2. Enemy's counter (staggered after the player's strike) ----------
    if (!kill) {
      at(430, () => {
        if (monsterMiss) {
          setEnemyAnim('attack');
          at(170, () => { setPlayerAnim('hurt'); addVfx('guard'); addFloat('MISS', 'player'); at(220, () => { setPlayerAnim('idle'); }); });
          at(380, () => setEnemyAnim('idle'));
        } else if (monsterDmg > 0) {
          setEnemyAnim('attack');
          at(190, () => {
            setPlayerAnim('hurt'); addFloat(`-${monsterDmg.toLocaleString()}`, 'player'); flash('shake');
            at(260, () => setPlayerAnim((a) => (a === 'hurt' ? 'idle' : a)));
          });
          at(420, () => setEnemyAnim('idle'));
        }
      });
    }

    // --- 3. Death & next-foe entrance -------------------------------------
    if (kill) {
      at(360, () => { setEnemyAnim('dying'); });
      at(900, () => {
        setView(toView(useGameStore.getState().state.currentMonster));
        setEnemyAnim('enter');
        at(420, () => setEnemyAnim('idle'));
      });
      at(420, () => { setPlayerAnim('victory'); at(380, () => setPlayerAnim('idle')); });
    }
    if (death) { setPlayerAnim('defeat'); flash('shake-hard'); at(800, () => setPlayerAnim('idle')); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx.id]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  if (!p) return null;
  const enemySprite = view ? monsterSprite(view.name) : null;

  return (
    <div className={`combat-arena ${shake}`}>
      <div className={`fighter player anim-${playerAnim}`}>
        <div className="fighter-shadow" />
        <div
          className="fighter-portrait"
          style={{ backgroundImage: `url(${CLASS_SPRITE[p.baseClassName]})` }}
          role="img"
          aria-label={p.className}
        />
        <div className="fighter-name">{p.className}</div>
      </div>

      <div className="vs">⚔</div>

      <div className={`fighter enemy anim-${enemyAnim}${view?.isBoss ? ' is-bossfoe' : ''}${view?.isChampion ? ' is-champion' : ''}`}>
        <div className="fighter-shadow" />
        {enemySprite
          ? <div className="fighter-portrait enemy-portrait" style={{ backgroundImage: `url(${enemySprite})` }} role="img" aria-label={view!.name} />
          : <div className="fighter-emoji">{view ? monsterIcon(view.name) : '❓'}</div>}
        <div className="fighter-name">{view?.name ?? '—'}</div>
      </div>

      {/* VFX layer */}
      {vfx.map((v) => <span key={v.id} className={`vfx vfx-${v.type}`} />)}

      {floats.map((f) => (
        <span key={f.id} className={`damage-float ${f.side}${f.crit ? ' crit' : ''}${f.heal ? ' heal' : ''}`}>{f.crit ? `${f.text}!` : f.text}</span>
      ))}
    </div>
  );
}
