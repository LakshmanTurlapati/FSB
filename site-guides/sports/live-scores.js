/**
 * Site Guide: Live Sports Scores
 * Per-site guide for monitoring live sports scoreboards and detecting score
 * changes over a sustained polling period (30 minutes).
 *
 * Sports scoreboards display live game scores that update via WebSocket or
 * AJAX without page reload. Score monitoring uses periodic read_page polling
 * to capture game state snapshots, compare against previous snapshot, and
 * log any score changes detected between polls.
 *
 * Primary target: ESPN (espn.com). Also covers common patterns across
 * CBS Sports, NBA.com, NFL.com, and other major sports score sites.
 *
 * Created for Phase 77, CONTEXT-01 edge case validation.
 * Target: monitor live sports ticker for 30 minutes logging score changes.
 */

registerSiteGuide({
  site: 'Live Sports Scores',
  category: 'Sports',
  patterns: [
    /espn\.com/i,
    /cbssports\.com\/scores/i,
    /nba\.com\/games/i,
    /nfl\.com\/scores/i,
    /mlb\.com\/scores/i,
    /sports\.yahoo\.com/i
  ],
  guidance: `LIVE SPORTS SCORE MONITORING (CONTEXT-01):

SPORTS SCOREBOARD DOM STRUCTURE:
- Sports sites display live games in a scoreboard layout with one container per game
- Each game container shows: two team names, two scores (home and away), game status (live/final/upcoming/delayed), period/quarter/half indicator, and game clock time remaining
- Scores update via WebSocket or AJAX calls -- the DOM changes without page reload
- Game containers are typically div or section elements with data attributes identifying the game (event ID, game ID)
- Team names appear as spans or divs with team abbreviation (e.g., "LAL", "BOS") and optionally full name
- Scores appear as numeric text inside span or div elements, often with separate elements for each team
- Game status indicators: "LIVE", "FINAL", "1st Qtr", "2nd Half", "7th Inning", time remaining ("4:32")
- Some sites group games by sport or league; ESPN groups by sport on the main scoreboard

SCORE SNAPSHOT AND CHANGE DETECTION:
- Take a "snapshot" of all game scores by extracting: game identifier, team 1 name, team 1 score, team 2 name, team 2 score, game status
- Store each snapshot as a structured record keyed by game identifier
- On each subsequent poll: extract current scores, compare against previous snapshot
- A "score change" = any game where team 1 score or team 2 score differs from previous snapshot
- Also track status changes: game going from "upcoming" to "live", or "live" to "final"
- Log each detected change with: timestamp of detection, game identifier, old scores, new scores, game status
- If no score changes for several consecutive polls, the game may be in a break or timeout -- keep polling

POLLING STRATEGY (30-MINUTE MONITORING):
- Polling interval: 30-60 seconds (30s for fast-paced sports like basketball, 60s for slower like baseball)
- Total duration: 30 minutes = approximately 30-60 polling cycles at 30-60s intervals
- Each poll: use read_page to extract all game scores from the scoreboard
- Between polls: compare current scores to previous snapshot
- Log format for each change: "[HH:MM:SS] Game: TeamA vs TeamB -- Score changed from X-Y to X-Z (status: 3rd Qtr)"
- Context management: only store the CURRENT and PREVIOUS snapshots, not all 60 snapshots (avoids context bloat)
- At end of 30 minutes: produce a summary of all detected changes

PRIMARY TARGET -- ESPN (espn.com):
- Main scoreboard URL: https://www.espn.com/ (homepage shows scoreboard ticker at top)
- Sport-specific: https://www.espn.com/nba/scoreboard, https://www.espn.com/nfl/scoreboard, https://www.espn.com/mlb/scoreboard
- ESPN scoreboard renders game cards in a horizontal scrollable ticker (top of page) and a main content area with expanded game cards
- Game containers: section or div elements with data-game-id or data-event-id attributes
- Team names: spans or divs with class containing "team" or "competitor" or "TeamName"
- Score values: span or div elements with class containing "score" or "ScoreCell"
- Game status: span with "game status" text (LIVE, FINAL, time remaining)
- ESPN uses React client-side rendering -- scoreboard content may be in script data or rendered via JavaScript
- Scoreboard API data may be embedded in __NEXT_DATA__ or window.__espnfitt__ JSON objects

FALLBACK TARGET -- CBS SPORTS (cbssports.com/scores):
- URL: https://www.cbssports.com/scores/
- CBS Sports scores page groups games by sport/league
- Game containers: div elements with game result cards
- Scores displayed in structured containers with team names and numeric scores
- Server-rendered content more likely than ESPN

FALLBACK TARGET -- NBA.COM (nba.com/games):
- URL: https://www.nba.com/games
- NBA-specific scoreboard with game tiles
- Each tile shows: team logos, team abbreviations, scores, quarter, game clock
- Client-rendered React application

CONTEXT BLOAT MITIGATION:
- This is a 30-minute sustained task -- context management is critical
- Only retain CURRENT snapshot and PREVIOUS snapshot (not full history)
- Log changes as simple text lines, not full DOM snapshots
- Use minimal read_page depth -- extract only score-relevant elements, not entire page DOM
- If context grows large, summarize older change logs into a compact format
- Do NOT re-read the full page structure on each poll -- only re-read score values
- First poll: read full page to understand DOM structure, subsequent polls: targeted score extraction`,
  selectors: {
    // Generic sports scoreboard selectors
    gameContainer: 'section[class*="Scoreboard"], div[class*="scoreboard"], div[class*="game-card"], div[data-game-id], div[data-event-id], article[class*="game"]',
    teamName: 'span[class*="TeamName"], span[class*="team-name"], div[class*="competitor"], span[class*="team"], a[class*="team-name"]',
    homeScore: 'span[class*="ScoreCell"], span[class*="score"], div[class*="score-home"], td[class*="score"]',
    awayScore: 'span[class*="ScoreCell"], span[class*="score"], div[class*="score-away"], td[class*="score"]',
    gameStatus: 'span[class*="GameStatus"], span[class*="game-status"], div[class*="status"], span[class*="StatusText"]',
    gameClock: 'span[class*="GameClock"], span[class*="clock"], span[class*="time-remaining"]',
    periodIndicator: 'span[class*="period"], span[class*="quarter"], span[class*="inning"], span[class*="half"]',
    // ESPN-specific selectors
    espnScoreboard: 'section[class*="Scoreboard"], div[id="scoreboard-page"], div[class*="ScoreboardPage"]',
    espnGameCard: 'section[class*="Scoreboard__Event"], div[class*="ScoreCell"], article[class*="scoreboard"]',
    espnTeamName: 'span[class*="ScoreCell__TeamName"], div[class*="Truncate"], a[class*="AnchorLink"][href*="/team/"]',
    espnScore: 'span[class*="ScoreCell__Score"], div[class*="ScoreCell__Value"]',
    espnGameStatus: 'span[class*="ScoreCell__GameStatus"], span[class*="StatusText"]',
    espnGameLink: 'a[class*="AnchorLink"][href*="/game/"], a[href*="/gamecast/"]',
    // CBS Sports-specific selectors
    cbsGameCard: 'div[class*="game-card"], div[class*="single-score"], tr[class*="game-row"]',
    cbsTeamName: 'span[class*="team-name"], a[class*="team-name-link"]',
    cbsScore: 'span[class*="score"], td[class*="total"]',
    cbsStatus: 'span[class*="game-status"], div[class*="game-state"]',
    // NBA.com-specific selectors
    nbaGameTile: 'div[class*="GameCard"], a[class*="GameCardLink"], div[data-game-id]',
    nbaTeamName: 'span[class*="MatchupCardTeamName"], p[class*="TeamName"]',
    nbaScore: 'span[class*="TeamScore"], p[class*="MatchupCardScore"]',
    nbaStatus: 'span[class*="GameCardGameStatus"], p[class*="StatusText"]'
  },
  workflows: {
    monitorLiveScores: [
      'Navigate to a live sports scoreboard page using navigate tool (e.g., espn.com/nba/scoreboard or espn.com for the homepage ticker)',
      'Wait for page to fully load via wait_for_stable -- verify scoreboard content visible with game containers',
      'Dismiss any cookie consent banners, ad overlays, or notification permission prompts',
      'Identify which sport/league is currently showing live games -- check for games with LIVE status',
      'INITIAL SNAPSHOT: Use read_page or get_dom_snapshot to capture all visible game scores',
      'For each game: extract game identifier (teams playing), team names, scores, game status (live/final/upcoming), and period/clock',
      'Store initial snapshot as the baseline -- format: { gameId: { team1, score1, team2, score2, status, period } }',
      'Record monitoring start time -- target duration is 30 minutes from this point',
      'BEGIN POLLING LOOP: Wait 30-60 seconds before next read (30s for basketball/hockey, 60s for baseball/football)',
      'Use read_page to extract current game scores -- same extraction as initial snapshot',
      'CHANGE DETECTION: Compare current scores against previous snapshot for each game',
      'For each detected change: log timestamp, game (team1 vs team2), old score, new score, current status and period',
      'Also detect and log status changes: upcoming->live, live->halftime, live->final',
      'Replace previous snapshot with current snapshot (keep only current and previous to minimize context)',
      'CHECK DURATION: If elapsed time < 30 minutes, return to step 9 (continue polling loop)',
      'AFTER 30 MINUTES: Stop polling and generate monitoring summary',
      'Summary must include: total duration, number of polling cycles completed, total score changes detected, list of all changes with timestamps, final scores of all monitored games'
    ],
    extractGameScores: [
      'On current scoreboard page: find all game containers using gameContainer selectors',
      'For each game container: locate team name elements and score value elements',
      'Extract: team1 name, team1 score, team2 name, team2 score, game status, period/quarter/inning',
      'Create unique game identifier from team names (e.g., "LAL-vs-BOS")',
      'Return structured array of game score records'
    ]
  },
  warnings: [
    'ESPN and most sports sites use heavy client-side rendering -- scoreboard content may not be in initial server HTML',
    'Live scores update via WebSocket/SSE -- the DOM changes without page reload but read_page only captures point-in-time state',
    'If no live games are currently playing, the scoreboard shows only final scores or upcoming games -- monitoring may detect zero changes (PARTIAL outcome)',
    'ESPN may show different sports on the main scoreboard depending on season -- NBA in winter, MLB in summer, NFL on Sundays',
    'Game containers can be in a horizontal ticker (top of ESPN homepage) or vertical list (sport-specific scoreboard page) -- prefer the sport-specific page for clearer DOM',
    'Score values are typically just numeric text ("105") but may include leading zeros or dashes for upcoming games',
    'Context bloat risk: 30 minutes of polling generates significant data -- only retain current and previous snapshots, log changes as compact text lines',
    'Polling too frequently (under 15 seconds) may trigger rate limiting or CAPTCHA -- 30-60 second intervals are safe',
    'Some games go to overtime or extra innings which extends the monitoring window -- continue polling until 30 minutes elapsed regardless',
    'ESPN __NEXT_DATA__ or window.__espnfitt__ may contain structured JSON with game data as an alternative to DOM scraping'
  ],
  toolPreferences: ['navigate', 'read_page', 'get_dom_snapshot', 'getText', 'scroll', 'click', 'waitForElement', 'waitForDOMStable', 'wait_for_stable']
});
