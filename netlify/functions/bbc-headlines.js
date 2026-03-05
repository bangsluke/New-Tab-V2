// netlify/functions/bbc-headlines.js
// Serverless proxy that fetches BBC News & Sport RSS and returns the top headline from each.

const NEWS_RSS = 'https://feeds.bbci.co.uk/news/rss.xml';
const SPORT_RSS = 'https://feeds.bbci.co.uk/sport/rss.xml?edition=uk';

async function fetchRss(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`RSS HTTP ${res.status}`);
  }
  return res.text();
}

function parseFirstItem(rssText) {
  // Very small, robust-enough RSS parser: pull out the first <item> block.
  const itemMatch = rssText.match(/<item[\s\S]*?<\/item>/i);
  if (!itemMatch) return null;
  const item = itemMatch[0];

  const textOrNull = (regex) => {
    const m = item.match(regex);
    return m && m[1] ? m[1].trim() : null;
  };

  const title = textOrNull(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i) ||
    textOrNull(/<title>([\s\S]*?)<\/title>/i);
  const link = textOrNull(/<link>([\s\S]*?)<\/link>/i);
  const pubDate = textOrNull(/<pubDate>([\s\S]*?)<\/pubDate>/i);

  if (!title || !link) return null;
  return { title, link, pubDate };
}

exports.handler = async () => {
  try {
    const [newsRss, sportRss] = await Promise.all([
      fetchRss(NEWS_RSS),
      fetchRss(SPORT_RSS),
    ]);

    const payload = {
      news: parseFirstItem(newsRss),
      sport: parseFirstItem(sportRss),
      fetchedAt: Date.now(),
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(payload),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'BBC headlines fetch failed', message: err.message }),
    };
  }
};

