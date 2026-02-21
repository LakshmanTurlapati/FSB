/**
 * Site Guide: Stack Overflow
 * Per-site guide for Stack Overflow Q&A platform.
 */

registerSiteGuide({
  site: 'Stack Overflow',
  category: 'Coding Platforms',
  patterns: [
    /stackoverflow\.com/i
  ],
  guidance: `STACK OVERFLOW-SPECIFIC INTELLIGENCE:

SEARCH:
- Search box: input[name="q"]
- Type a search query and press Enter
- Results show questions sorted by relevance

QUESTION PAGES:
- Question title: #question-header h1 a
- Answers are below the question
- Vote buttons: .js-vote-up-btn and .js-vote-down-btn
- Accepted answers have a green checkmark

ANSWERING:
- Answer editor: #wmd-input (Markdown editor)
- Submit answer: #submit-button
- Use Markdown formatting for code blocks and formatting

NAVIGATION:
- Questions list shows title, tags, votes, answers count
- Filter by tags, newest, active, or unanswered
- Related questions appear in the sidebar`,
  selectors: {
    searchBox: 'input[name="q"]',
    answerEditor: '#wmd-input',
    postAnswer: '#submit-button',
    questionTitle: '#question-header h1 a',
    voteUp: '.js-vote-up-btn',
    voteDown: '.js-vote-down-btn'
  },
  workflows: {
    searchQuestion: [
      'Click the search box (input[name="q"])',
      'Type the search query',
      'Press Enter to search',
      'Browse results and click on the most relevant question',
      'Read the question and top answers'
    ],
    postAnswer: [
      'Navigate to the question page',
      'Read the question carefully',
      'Scroll to the answer editor (#wmd-input)',
      'Type the answer using Markdown formatting',
      'Click Submit (#submit-button)',
      'Verify the answer was posted'
    ]
  },
  warnings: [
    'Stack Overflow requires authentication for posting answers, voting, and commenting',
    'New users have reputation requirements for certain actions (commenting, voting)',
    'Use Markdown formatting in the answer editor -- code blocks use triple backticks or 4-space indent',
    'Be aware of duplicate question warnings when asking new questions'
  ],
  toolPreferences: ['click', 'type', 'waitForElement', 'waitForDOMStable', 'getText', 'getEditorContent', 'scroll', 'keyPress', 'focus', 'navigate', 'selectOption']
});
