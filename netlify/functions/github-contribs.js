// netlify/functions/github-contribs.js
// Fetch a year of GitHub contributions for a user via the GraphQL API.

const GITHUB_API = 'https://api.github.com/graphql';
const USERNAME = 'bangsluke';

exports.handler = async () => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GITHUB_TOKEN not configured' }),
    };
  }

  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(GITHUB_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables: { login: USERNAME } }),
    });

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: `GitHub GraphQL HTTP ${res.status}` }),
      };
    }

    const json = await res.json();
    const weeks =
      json.data?.user?.contributionsCollection?.contributionCalendar?.weeks ||
      [];

    const days = [];
    for (const week of weeks) {
      for (const d of week.contributionDays || []) {
        days.push({ date: d.date, count: d.contributionCount || 0 });
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GitHub contributions fetch failed', message: err.message }),
    };
  }
};

