import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Input, OnChanges, PLATFORM_ID, SimpleChanges, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FindCardVideo } from '../../services/find-experience.service';

const YOUTUBE_ID = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

// The card's video slot (design_handoff_find_taliferro_results, "Video
// player"): a 16:9 poster with a play button that turns into the player in
// place, never a new page. A YouTube link plays in its embed; anything else
// in <video>. More than one clip adds a playlist (rows, or chips on a phone);
// picking one plays it. No clips: a placeholder with no play button.
@Component( {
  selector: 'app-find-video-player',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './find-video-player.component.html',
  styleUrls: [ './find-video-player.component.css' ],
} )
export class FindVideoPlayerComponent implements OnChanges {
  @Input() videos: FindCardVideo[] = [];
  /** Chips under the player instead of rows (layout B). */
  @Input() chips = false;
  /** Shown on the placeholder when there's no clip yet. */
  @Input() name = '';
  @Input() logoUrl: string | null = null;

  index = 0;
  playing = false;

  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );
  private readonly sanitizer = inject( DomSanitizer );
  private embed: { id: string; url: SafeResourceUrl } | null = null;

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes[ 'videos' ] ) {
      this.index = 0;
      this.playing = false;
    }
  }

  get current (): FindCardVideo | null {
    return this.videos[ this.index ] || null;
  }

  /** The light-theme version on a light page, when the clip has one. */
  get source (): string {
    const video = this.current;
    if ( !video ) return '';
    return video.urlLight && !this.isDark ? video.urlLight : video.url;
  }

  poster ( video: FindCardVideo | null ): string | null {
    if ( !video ) return null;
    return ( video.posterLight && !this.isDark ? video.posterLight : video.poster ) || this.youtubeThumb( video.url );
  }

  get youtubeEmbed (): SafeResourceUrl | null {
    const id = YOUTUBE_ID.exec( this.source )?.[ 1 ];
    if ( !id ) return null;
    // Built from the id alone, so only YouTube's own embed page can load.
    if ( this.embed?.id !== id ) this.embed = { id, url: this.sanitizer.bypassSecurityTrustResourceUrl( `https://www.youtube.com/embed/${ id }?autoplay=1&rel=0` ) };
    return this.embed.url;
  }

  play ( index = this.index ): void {
    this.index = index;
    this.playing = true;
  }

  private youtubeThumb ( url: string ): string | null {
    const id = YOUTUBE_ID.exec( url )?.[ 1 ];
    return id ? `https://i.ytimg.com/vi/${ id }/hqdefault.jpg` : null;
  }

  /** Find's theme: a chosen one on <html>, else the system's. */
  private get isDark (): boolean {
    if ( !this.isBrowser ) return true;
    const root = document.documentElement;
    if ( root.classList.contains( 'dark' ) || root.dataset[ 'theme' ] === 'dark' ) return true;
    if ( root.classList.contains( 'light' ) || root.dataset[ 'theme' ] === 'light' ) return false;
    return window.matchMedia?.( '(prefers-color-scheme: dark)' ).matches ?? true;
  }
}
