// Captions for assets/video/find-welcome.mp4 (Ty's cut with the Google voice
// and music, 63 s). Times follow the voiceover's line starts (0:01, 0:06,
// 0:10 ...), from design-stuff/find-video-voiceover/lines.tsv. Wording and the
// fill rules come from design-stuff/find-welcome-captions (Claude Design
// handoff):
//  - {name} is replaced with vars[name];
//  - [ ... ] is dropped entirely if any placeholder inside it is empty;
//  - a cue that ends up empty is skipped.
// Placeholders: firstName, timeOfDay (morning | afternoon | evening), weekday.

export interface FindWelcomeCue { from: number; to: number; text: string; }

export const FIND_WELCOME_CUES: readonly FindWelcomeCue[] = [
  { from: 1.0, to: 5.7, text: '[Good {timeOfDay}. ]Welcome to Find[, {firstName}].' },
  { from: 6.0, to: 9.7, text: 'Ask Find anything, the way you’d ask a person.' },
  { from: 10.0, to: 13.7, text: 'You get one clear answer, not a page of links.' },
  { from: 14.0, to: 17.7, text: 'Not sure what to ask? Start from a tile.' },
  { from: 18.0, to: 21.7, text: 'Time, weather and currency, anywhere in the world.' },
  { from: 22.0, to: 25.7, text: 'Live scores, college football, music and your shows.' },
  { from: 26.0, to: 29.7, text: 'Movies, shopping, and more.' },
  { from: 30.0, to: 34.7, text: 'Look up any company, and every summary names its sources.' },
  { from: 35.0, to: 39.7, text: 'Definitions come straight from the dictionary.' },
  { from: 40.0, to: 44.7, text: 'Guides collect the best independent shops, checked by people.' },
  { from: 45.0, to: 49.7, text: '[Free this {weekday}? ]Try a guide for your city.' },
  { from: 50.0, to: 54.7, text: 'You can even search any 16Ahead app to see how it works.' },
  { from: 55.0, to: 58.4, text: 'Your first search is one tap away[, {firstName}].' },
  { from: 58.4, to: 62.8, text: 'Find, at find.16ahead.com, or on the App Store.' },
];

export function fillCaptions ( cues: readonly FindWelcomeCue[], vars: Record<string, string | null | undefined> = {} ): FindWelcomeCue[] {
  const val = ( k: string ) => ( vars[ k ] == null ? '' : String( vars[ k ] ).trim() );
  const sub = ( s: string ) => s.replace( /\{(\w+)\}/g, ( _, k: string ) => val( k ) );
  return cues
    .map( ( c ) => {
      let text = c.text.replace( /\[([^\]]*)\]/g, ( _, seg: string ) => {
        const keys = [ ...seg.matchAll( /\{(\w+)\}/g ) ].map( ( m ) => m[ 1 ] );
        return keys.some( ( k ) => !val( k ) ) ? '' : sub( seg );
      } );
      text = sub( text ).replace( /\s{2,}/g, ' ' ).trim();
      return { from: c.from, to: c.to, text };
    } )
    .filter( ( c ) => c.text.length > 0 );
}

/** Time of day and weekday from the viewer's own clock. Late night skips the greeting. */
export function timeVars ( date = new Date() ): { timeOfDay: string; weekday: string } {
  const h = date.getHours();
  const timeOfDay = h < 5 ? '' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const weekday = date.toLocaleDateString( 'en-US', { weekday: 'long' } );
  return { timeOfDay, weekday };
}
