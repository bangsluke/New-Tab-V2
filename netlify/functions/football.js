/**
 * football.js — Netlify Function
 * Server-side proxy for football-data.org API calls.
 * Bypasses the CORS restriction on the free tier (which only allows http://localhost).
 *
 * Query params:
 *   type=standings  → GET /v4/competitions/PL/standings
 *   type=fixtures   → GET /v4/teams/64/matches?status=SCHEDULED&limit=5
 */

const LIVERPOOL_ID = 64;

const ENDPOINTS = {
  standings: 'https://api.football-data.org/v4/competitions/PL/standings',
  fixtures:  `https://api.football-data.org/v4/teams/${LIVERPOOL_ID}/matches?status=SCHEDULED&limit=5`,
};

exports.handler = async (event) => {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'FOOTBALL_DATA_API_KEY not configured' }),
    };
  }

  const type = event.queryStringParameters?.type;
  const url = ENDPOINTS[type];

  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid type. Use standings or fixtures.' }),
    };
  }

  const res = await fetch(url, {
    headers: { 'X-Auth-Token': token },
  });

  const body = await res.text();
  return {
    statusCode: res.status,
    headers: { 'Content-Type': 'application/json' },
    body,
  };
};
