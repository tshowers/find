import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { PlatformMenuComponent } from '../shared/platform-menu/platform-menu.component';
import { SeoService } from '../shared/seo.service';

interface HelpStep {
  number: string;
  title: string;
  copy: string;
  details: string[];
  action: string;
  // Each step's "try it" link actually demonstrates that step, rather than
  // every one landing on the bare homepage — a query param runs a real
  // search (via find-home.component's queryParamMap subscription) or opens
  // a specific tab (view=info) instead of just describing it.
  actionQueryParams?: { query?: string; view?: string };
}

@Component({
  selector: 'app-find-help',
  standalone: true,
  imports: [CommonModule, RouterLink, PlatformMenuComponent],
  templateUrl: './help.component.html',
  styleUrl: './help.component.css',
})
export class HelpComponent implements OnInit {
  constructor(
    private readonly title: Title,
    private readonly meta: Meta,
    private readonly seo: SeoService,
  ) {}

  ngOnInit(): void {
    const pageTitle = 'Find Help — How to search with Find | Taliferro Tech';
    const description = 'A walkthrough of how to use Find: ask a question, read the strongest answer first, explore alternatives, refine with context pills, and use quick actions.';
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: 'https://find.taliferro.tech/help' });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.seo.setCanonical('https://find.taliferro.tech/help');
  }

  readonly steps: HelpStep[] = [
    {
      number: '01',
      title: 'Ask Find anything',
      copy: 'Start with a plain-language question in the main search field. Find is designed to take you to a strong answer quickly instead of making you sort through a page of links.',
      details: [
        'Type a question, topic, place, person, or task into Search for anything…',
        'Press Enter or choose Find.',
        'Find classifies the request and chooses the most useful answer mode.',
        'The result includes the strongest source, answer context, and a path to explore further.',
      ],
      action: 'Try Find',
    },
    {
      number: '02',
      title: 'Use a quick search',
      copy: 'Quick actions give you a useful starting point when you do not want to write the query yourself.',
      details: [
        'News searches current news topics.',
        'Weather gives current conditions and forecast details.',
        'Sports opens sports-related search results.',
        'Conversion handles currency and unit conversions, including an interactive keypad.',
        'Restaurants searches for places to eat near you when location context is available.',
        'Events is marked coming soon in the current product.',
      ],
      action: 'Try a quick search',
      actionQueryParams: { query: 'weather' },
    },
    {
      number: '03',
      title: 'Read the strongest answer first',
      copy: 'Find presents the best-weighted result first. Open the source when you want the full context, then use the answer and supporting references to decide what to do next.',
      details: [
        'Read the answer card and its source context.',
        'Open the source link when you need the original article, page, or business details.',
        'Question results can include a grounded answer and references.',
        'Movie results combine ratings and details from IMDb, Rotten Tomatoes, and Metacritic when available.',
        'Business results can show contact information, hours, and related details.',
      ],
      action: 'Open the search screen',
      actionQueryParams: { query: 'What is the boiling point of water?' },
    },
    {
      number: '04',
      title: 'Explore alternatives and the grid',
      copy: 'When Find returns more than one useful result, move through alternatives instead of starting over.',
      details: [
        'Use the left and right result controls to move through the carousel.',
        'Swipe left or right on a touch device to move between results.',
        'Choose See all options to open the result grid.',
        'Open a card for a deeper detail view, then use the back control to return to the shelf or search.',
      ],
      action: 'Try the result grid',
      actionQueryParams: { query: 'running shoes' },
    },
    {
      number: '05',
      title: 'Refine with context pills',
      copy: 'Context pills let you change the active direction of a search without losing the original topic.',
      details: [
        'Choose a pill such as News, Weather, Sports, or another available refinement.',
        'Find keeps the original query visible while changing the active context.',
        'Use the bottom tab bar to move between the result grid, search history, Info, Awards, and Share.',
        'Use swipe or tilt navigation on supported devices to move through the experience.',
      ],
      action: 'Search with context',
      actionQueryParams: { query: 'Apple' },
    },
    {
      number: '06',
      title: 'Use History, Share, and Feedback',
      copy: 'Find keeps the experience lightweight, but gives you a few ways to return to useful searches and help improve the product.',
      details: [
        'Search History keeps your recent searches available for another look.',
        'Share lets you pass along a result when the browser or device supports sharing.',
        'Rate the experience after a result and optionally explain what was missing.',
        'Open Awards to see the milestones you have unlocked as you use Find.',
        'Use Info for the existing in-product explanation of Find and its philosophy.',
      ],
      action: 'Open Find Info',
      actionQueryParams: { view: 'info' },
    },
  ];
}
