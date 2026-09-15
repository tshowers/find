import { Injectable } from '@angular/core';

export type FindAwardIcon =
  | 'rebel' | 'curious' | 'night-owl' | 'early-bird' | 'connector' | 'sharp-eye'
  | 'explorer' | 'specialist' | 'relentless' | 'tastemaker' | 'legend';

export type FindAwardState = 'unlocked' | 'locked' | 'mystery';

export interface FindAward {
  id: string;
  title: string;
  threshold: number;
  copy: string;
  icon: FindAwardIcon;
  hidden?: boolean;
}

export interface FindAwardView extends FindAward {
  state: FindAwardState;
}

export interface FindAwardsProgress {
  count: number;
  unlockedCount: number;
  totalCount: number;
  percent: number;
  nextAward: ( FindAward & { searchesToGo: number } ) | null;
}

interface UnlockedRecord {
  title: string;
  copy: string;
  icon: FindAwardIcon;
  unlockedAt: string;
}

// The Night Owl / Early Bird slot resolves to whichever title fits the
// moment it's earned, then keeps that resolution forever — a user who
// unlocks it at 2am shouldn't see it flip to "Early Bird" on a later visit.
const AWARD_LADDER: FindAward[] = [
  { id: 'rebel', title: 'The Rebel', threshold: 1, icon: 'rebel',
    copy: 'You don’t wait for permission — you go find it yourself.' },
  { id: 'curious-one', title: 'The Curious One', threshold: 3, icon: 'curious',
    copy: 'You can’t leave a question alone. Never could.' },
  { id: 'night-owl', title: 'The Night Owl / Early Bird', threshold: 6, icon: 'night-owl',
    copy: '3am and your mind’s still going. That’s not insomnia — that’s you.' },
  { id: 'connector', title: 'The Connector', threshold: 10, icon: 'connector',
    copy: 'You saw the thread before anyone said it out loud.' },
  { id: 'sharp-eye', title: 'The Sharp Eye', threshold: 15, icon: 'sharp-eye',
    copy: 'Something felt off and you were right.' },
  { id: 'explorer', title: 'The Explorer', threshold: 20, icon: 'explorer',
    copy: 'One answer was never going to be enough for you.' },
  { id: 'specialist', title: 'The Specialist', threshold: 30, icon: 'specialist',
    copy: 'You stopped skimming. You went all the way down.' },
  { id: 'relentless', title: 'The Relentless', threshold: 40, icon: 'relentless',
    copy: 'Something in you refused to close the tab.' },
  { id: 'tastemaker', title: 'The Tastemaker', threshold: 60, icon: 'tastemaker',
    copy: 'People catch up to what you already knew.' },
  { id: 'legend', title: 'The Legend', threshold: 100, icon: 'legend', hidden: true,
    copy: 'You stopped counting a while ago. So did we.' },
];

@Injectable( { providedIn: 'root' } )
export class FindAwardsService {
  private readonly COUNT_KEY = 'find-awards-count';
  private readonly UNLOCKED_KEY = 'find-awards-unlocked';

  private count = 0;
  private unlocked = new Map<string, UnlockedRecord>();

  constructor () {
    this.load();
  }

  get searchCount (): number {
    return this.count;
  }

  get awards (): FindAwardView[] {
    return AWARD_LADDER.map( ( award ) => {
      const record = this.unlocked.get( award.id );
      if ( record ) {
        return { ...award, title: record.title, copy: record.copy, state: 'unlocked' as const };
      }
      return { ...award, state: ( award.hidden ? 'mystery' : 'locked' ) as FindAwardState };
    } );
  }

  get progress (): FindAwardsProgress {
    const trackable = AWARD_LADDER.filter( ( award ) => !award.hidden );
    const unlockedCount = trackable.filter( ( award ) => this.unlocked.has( award.id ) ).length;
    const nextLadderAward = trackable.find( ( award ) => !this.unlocked.has( award.id ) ) || null;
    return {
      count: this.count,
      unlockedCount,
      totalCount: AWARD_LADDER.length,
      percent: trackable.length ? Math.round( ( unlockedCount / trackable.length ) * 100 ) : 0,
      nextAward: nextLadderAward
        ? { ...nextLadderAward, searchesToGo: Math.max( 0, nextLadderAward.threshold - this.count ) }
        : null
    };
  }

  /** Call once per completed search. Returns the award that was just unlocked, or null. */
  recordSearch (): FindAward | null {
    this.count += 1;
    this.save();

    let justUnlocked: FindAward | null = null;
    for ( const award of AWARD_LADDER ) {
      if ( this.unlocked.has( award.id ) || this.count < award.threshold ) continue;
      const resolved = this.resolveAward( award );
      this.unlocked.set( award.id, { title: resolved.title, copy: resolved.copy, icon: resolved.icon, unlockedAt: new Date().toISOString() } );
      justUnlocked = resolved;
    }
    if ( justUnlocked ) this.save();
    return justUnlocked;
  }

  private resolveAward ( award: FindAward ): FindAward {
    if ( award.id !== 'night-owl' ) return award;
    const hour = new Date().getHours();
    const isEarly = hour >= 4 && hour < 12;
    return isEarly
      ? { ...award, title: 'The Early Bird', icon: 'early-bird', copy: 'You were thinking before the world woke up.' }
      : { ...award, title: 'The Night Owl', icon: 'night-owl', copy: '3am and your mind’s still going. That’s not insomnia — that’s you.' };
  }

  private load (): void {
    try {
      this.count = Number( localStorage.getItem( this.COUNT_KEY ) ) || 0;
    } catch {
      this.count = 0;
    }
    try {
      const raw = localStorage.getItem( this.UNLOCKED_KEY );
      const parsed: Record<string, UnlockedRecord> = raw ? JSON.parse( raw ) : {};
      this.unlocked = new Map( Object.entries( parsed ) );
    } catch {
      this.unlocked = new Map();
    }
  }

  private save (): void {
    try {
      localStorage.setItem( this.COUNT_KEY, String( this.count ) );
      localStorage.setItem( this.UNLOCKED_KEY, JSON.stringify( Object.fromEntries( this.unlocked ) ) );
    } catch { /* ignore */ }
  }
}
