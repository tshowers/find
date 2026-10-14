import { TestBed } from '@angular/core/testing';

import { FindRankedResult, FindSearchResponse } from './find-experience.service';
import { HeadlineFeedsService } from './headline-feeds.service';

const ESPN = { source: 'ESPN', url: 'https://www.espn.com/espn/rss/nfl/news' };

function headline(title: string, hoursAgo: number, url = `https://example.com/${encodeURIComponent(title)}`): FindRankedResult {
  return {
    rank: 0, title, summary: '', url, displayUrl: 'CBS Sports', imageUrl: '', sourceType: 'publisher',
    confidence: 0.95, pills: [], rssSource: 'CBS Sports', publishedAt: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
  };
}

function response(results: FindRankedResult[]): FindSearchResponse {
  return { success: true, query: 'sports news', normalizedQuery: 'sports news', queryType: 'sports', rssBacked: true, results, selectedIndex: 0 };
}

describe('HeadlineFeedsService', () => {
  let service: HeadlineFeedsService;

  beforeEach(() => {
    service = TestBed.inject(HeadlineFeedsService);
  });

  it('serves the same queries as headlines as the backend', () => {
    expect(service.sectionForQuery('sports news')).toBe('sports');
    expect(service.sectionForQuery('Sports')).toBe('sports');
    expect(service.sectionForQuery("Today's News")).toBe('news');
    expect(service.sectionForQuery('sports bar near me')).toBeNull();
  });

  it('parses an ESPN feed item like the backend does', () => {
    const [item] = service.parseFeed(`<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
      <image><url>https://a.espncdn.com/logo.gif</url></image>
      <item>
        <title><![CDATA[NFL suspends Rams LT Jackson two games]]></title>
        <description><![CDATA[The NFL on Tuesday <b>suspended</b> Alaric Jackson.]]></description>
        <dc:creator><![CDATA[ESPN]]></dc:creator>
        <link><![CDATA[https://www.espn.com/nfl/story/_/id/50166454]]></link>
        <pubDate>Tue, 13 Oct 2026 19:46:10 EST</pubDate>
      </item></channel></rss>`, ESPN);

    expect(item.title).toBe('NFL suspends Rams LT Jackson two games');
    expect(item.summary).toBe('The NFL on Tuesday suspended Alaric Jackson.');
    expect(item.url).toBe('https://www.espn.com/nfl/story/_/id/50166454');
    expect(item.rssSource).toBe('ESPN');
    expect(item.displayUrl).toBe('ESPN');
    expect(item.imageUrl).toBe('');
    expect(item.publishedAt).toBe('2026-10-14T00:46:10.000Z');
  });

  it('takes an item image from media tags or the item markup', () => {
    const [media, markup] = service.parseFeed(`<rss xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
      <item><title>A</title><link>https://npr.org/a</link><media:content url="https://img/a.jpg"/></item>
      <item><title>B</title><link>https://npr.org/b</link><content:encoded><![CDATA[<p><img src="https://img/b.jpg"></p>]]></content:encoded></item>
    </channel></rss>`, ESPN);
    expect(media.imageUrl).toBe('https://img/a.jpg');
    expect(markup.imageUrl).toBe('https://img/b.jpg');
  });

  it('returns nothing for a page that is not a feed', () => {
    expect(service.parseFeed('<html><body>Checking your browser</body></html', ESPN)).toEqual([]);
  });

  it('merges newest first, drops duplicate links and old stories, and keeps 20', () => {
    const backend = Array.from({ length: 19 }, (_, i) => headline(`Backend ${i}`, i + 2));
    const extra = [
      headline('ESPN newest', 1),
      headline('Duplicate', 3, backend[0].url),
      headline('Too old', 24 * 8),
      headline('ESPN later', 30),
    ];

    const merged = service.merge(response(backend), extra);

    expect(merged.results.length).toBe(20);
    expect(merged.results[0].title).toBe('ESPN newest');
    expect(merged.results.filter(r => r.url === backend[0].url).length).toBe(1);
    expect(merged.results.some(r => r.title === 'Too old')).toBeFalse();
    expect(merged.results.map(r => r.rank)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('adds at most the 6 newest stories from each added source', () => {
    const backend = [headline('Backend', 48)];
    const espn = Array.from({ length: 10 }, (_, i) => ({ ...headline(`ESPN ${i}`, i + 1), rssSource: 'ESPN' }));

    const merged = service.merge(response(backend), espn);

    expect(merged.results.map(r => r.title)).toEqual(['ESPN 0', 'ESPN 1', 'ESPN 2', 'ESPN 3', 'ESPN 4', 'ESPN 5', 'Backend']);
  });

  it('drops duplicate stories before taking the 6 newest from a source', () => {
    const story = (i: number) => ({ ...headline(`ESPN ${i}`, i + 1), rssSource: 'ESPN' });
    // The top and NFL feeds both carry stories 0-2.
    const espn = [0, 1, 2, 0, 1, 2, 3, 4, 5, 6].map(story);

    const merged = service.merge(response([headline('Backend', 48)]), espn);

    expect(merged.results.filter(r => r.rssSource === 'ESPN').length).toBe(6);
  });

  it('leaves the response alone when there is nothing to add', () => {
    const original = response([headline('Only', 1)]);
    expect(service.merge(original, [])).toBe(original);
  });

  it('treats a blocked or failed feed as no headlines', async () => {
    spyOn(window, 'fetch').and.callFake(async () => { throw new TypeError('Failed to fetch'); });
    expect(await service.extraHeadlines('sports')).toEqual([]);
  });

  it('fetches nothing for News in the browser', async () => {
    const fetchSpy = spyOn(window, 'fetch');
    expect(await service.extraHeadlines('news')).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
