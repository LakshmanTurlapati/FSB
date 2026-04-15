/**
 * Site Guide: Google Calendar
 * Per-site guide for Google Calendar event management application.
 * CRITICAL: Keyboard shortcuts are DISABLED by default — first workflow enables them.
 */

registerSiteGuide({
  site: 'Google Calendar',
  category: 'Productivity Tools',
  patterns: [
    /calendar\.google\.com/i
  ],
  guidance: `GOOGLE CALENDAR-SPECIFIC INTELLIGENCE:

PREREQUISITE — KEYBOARD SHORTCUTS MUST BE ENABLED:
  Google Calendar keyboard shortcuts are DISABLED by default.
  The user MUST enable them before any single-key shortcuts will work:
    Settings (gear icon) > Settings > Keyboard shortcuts > toggle ON
  Without this step, shortcuts like C, E, D, T, J, K, 1-6 will NOT work.
  The enableShortcuts workflow below handles this. Run it first.

KEYBOARD SHORTCUTS (after enabling):
  C               — Create new event (opens quick-create popover)
  E               — Edit the selected event
  Delete/Backspace — Delete the selected event
  /               — Focus search input
  T               — Go to today
  J or N          — Next period (day/week/month depending on current view)
  K or P          — Previous period
  1               — Switch to Day view
  2               — Switch to Week view
  3               — Switch to Month view
  4               — Switch to Custom view
  5               — Switch to Year view
  6               — Switch to Schedule/Agenda view
  G               — Go to a specific date (opens date picker)
  R               — Refresh calendar
  S               — Open settings
  Tab             — Navigate between events in current view
  Enter           — Open event details for the focused event
  Escape          — Close popover/modal/overlay

CREATING EVENTS:
  Method 1 (keyboard): Press C to open quick-create popover > type event title >
    click "More options" for full editor OR just press Enter/click Save for quick create.
  Method 2 (click on grid): Click directly on a time slot in the calendar grid >
    a popover appears pre-filled with that time > type title > save.
  Method 3 (all-day): Click the date header area (above the time grid in Week/Day view) >
    creates an all-day event for that date.

EVENT POPOVER vs FULL EDITOR:
  Quick create (from C or grid click) shows a MINIMAL popover with just title, date, time.
  Click "More options" to open the FULL event editor with: guests, location, description,
    notifications, repeat, visibility, calendar selection, color.
  "More options" opens in the same tab (replaces calendar view), NOT as a modal.

TIME GRID INTERACTION:
  Clicking on the time grid creates an event at the clicked time.
  The exact click coordinate determines the event start time (snaps to 15-min intervals).
  Dragging on the time grid sets both start and end time.
  Events on the grid can be resized by dragging their top/bottom edges.

DATE NAVIGATION:
  T — jump to today
  J/N — forward one period (day in day view, week in week view, month in month view)
  K/P — back one period
  G — type a specific date to jump to it

VIEW SWITCHING:
  1=Day, 2=Week, 3=Month, 4=Custom, 5=Year, 6=Schedule
  These only work with keyboard shortcuts enabled.

COMMON PATTERNS:
  # Create a simple event:
  key "c"                    # opens quick-create popover
  type "Meeting with team"   # type event title
  key "Enter"                # save with defaults (or click Save)

  # Create event with full details:
  key "c"                    # opens quick-create popover
  type "Project Review"      # type title
  click "More options"       # opens full event editor
  # fill in time, guests, location, description
  click "Save"               # save event

  # Navigate to a specific date:
  key "g"                    # opens go-to-date picker
  type "2026-04-15"          # type the target date
  key "Enter"                # navigate to that date

  # RSVP to an invitation:
  click on the event in the calendar grid
  look for Yes/No/Maybe RSVP buttons in the event popover
  click the desired response

FEEDBACK LOOP:
  After creating an event, it should appear on the calendar grid at the specified time.
  After navigating dates, the header should show the new date range.
  After switching views, the layout changes (single column for Day, 7 columns for Week, etc.).
  Event changes auto-save when using the full editor and clicking Save.`,
  fsbElements: {
    'create-event-button': {
      label: 'Create / + button for new event',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Create"]' },
        { strategy: 'data-testid', selector: '[data-testid="create-button"]' },
        { strategy: 'role', selector: '[role="button"][aria-label="Create"]' },
        { strategy: 'class', selector: '.VfPpkd-LgbsSe[aria-label="Create"], .FAuoAc' },
        { strategy: 'context', selector: 'header [aria-label="Create"], [data-view-heading] ~ [aria-label="Create"]' }
      ]
    },
    'today-button': {
      label: 'Today navigation button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Today" i]' },
        { strategy: 'data-testid', selector: '[data-testid="today-button"]' },
        { strategy: 'role', selector: '[role="button"][data-value="today"]' },
        { strategy: 'class', selector: '.navigation-button-today, .VfPpkd-LgbsSe[data-value="today"]' },
        { strategy: 'context', selector: 'header [aria-label="Today" i], .calendar-header [data-value="today"]' }
      ]
    },
    'forward-button': {
      label: 'Next period button (>)',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Next"]' },
        { strategy: 'data-testid', selector: '[data-testid="next-button"]' },
        { strategy: 'role', selector: '[role="button"][aria-label="Next"]' },
        { strategy: 'class', selector: '.navigation-button-next, [data-view="forward"]' },
        { strategy: 'context', selector: 'header [aria-label="Next"], .calendar-header [aria-label="Next"]' }
      ]
    },
    'back-button': {
      label: 'Previous period button (<)',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Previous"]' },
        { strategy: 'data-testid', selector: '[data-testid="previous-button"]' },
        { strategy: 'role', selector: '[role="button"][aria-label="Previous"]' },
        { strategy: 'class', selector: '.navigation-button-previous, [data-view="back"]' },
        { strategy: 'context', selector: 'header [aria-label="Previous"], .calendar-header [aria-label="Previous"]' }
      ]
    },
    'view-switcher': {
      label: 'Day/Week/Month/Year/Schedule view selector',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="View picker"]' },
        { strategy: 'data-testid', selector: '[data-testid="view-picker"]' },
        { strategy: 'role', selector: '[role="tablist"], [role="listbox"][aria-label*="view" i]' },
        { strategy: 'class', selector: '.view-switcher, .VfPpkd-O1htCb[aria-label*="view" i]' },
        { strategy: 'context', selector: 'header [aria-label*="view" i], .calendar-header [role="tablist"]' }
      ]
    },
    'search-bar': {
      label: 'Search events input',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Search"]' },
        { strategy: 'data-testid', selector: '[data-testid="search-input"]' },
        { strategy: 'role', selector: 'input[role="search"], input[role="combobox"][aria-label*="Search" i]' },
        { strategy: 'class', selector: '.header-search-input, #searchInput' },
        { strategy: 'context', selector: 'header input[type="text"], header [aria-label="Search"]' }
      ]
    },
    'calendar-grid': {
      label: 'Main calendar grid/time grid area',
      selectors: [
        { strategy: 'aria', selector: '[aria-label*="Calendar" i][role="grid"]' },
        { strategy: 'data-testid', selector: '[data-testid="calendar-grid"]' },
        { strategy: 'role', selector: '[role="grid"], [role="presentation"][data-datekey]' },
        { strategy: 'class', selector: '.tg-mainGrid, [data-viewkey] [role="grid"]' },
        { strategy: 'context', selector: 'main [role="grid"], .calendar-main [role="grid"]' }
      ]
    },
    'mini-calendar': {
      label: 'Small month navigation calendar in sidebar',
      selectors: [
        { strategy: 'aria', selector: '[aria-label*="Date picker" i]' },
        { strategy: 'data-testid', selector: '[data-testid="mini-calendar"]' },
        { strategy: 'role', selector: '[role="grid"][aria-label*="calendar" i]' },
        { strategy: 'class', selector: '.minical, .navigation-calendar' },
        { strategy: 'context', selector: 'aside [role="grid"], .side-panel [role="grid"]' }
      ]
    },
    'sidebar-calendars': {
      label: 'Calendar list in sidebar (my calendars, other calendars)',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="My calendars"]' },
        { strategy: 'data-testid', selector: '[data-testid="sidebar-calendars"]' },
        { strategy: 'role', selector: '[role="tree"][aria-label*="calendar" i]' },
        { strategy: 'class', selector: '.calendarList, .side-panel-calendars' },
        { strategy: 'context', selector: 'aside [role="tree"], .side-panel [aria-label*="calendars" i]' }
      ]
    },
    'settings-gear': {
      label: 'Settings gear icon',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Settings menu"]' },
        { strategy: 'data-testid', selector: '[data-testid="settings-button"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Settings" i]' },
        { strategy: 'class', selector: '.settings-button, [data-tooltip="Settings"]' },
        { strategy: 'context', selector: 'header [aria-label*="Settings" i], .calendar-header [aria-label*="Settings" i]' }
      ]
    },
    'event-popover': {
      label: 'Event quick-create popover (when visible)',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="New event"]' },
        { strategy: 'data-testid', selector: '[data-testid="event-popover"]' },
        { strategy: 'role', selector: '[role="dialog"][aria-label*="event" i]' },
        { strategy: 'class', selector: '.ep-popup, [data-eventid] [role="dialog"]' },
        { strategy: 'context', selector: '[role="dialog"][aria-label*="event" i], .quick-add-popover' }
      ]
    },
    'event-detail-title': {
      label: 'Event title input in create/edit form',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Add title"]' },
        { strategy: 'data-testid', selector: '[data-testid="event-title-input"]' },
        { strategy: 'role', selector: 'input[aria-label*="title" i], [role="textbox"][aria-label*="title" i]' },
        { strategy: 'class', selector: '.ep-title input, [data-key="title"] input' },
        { strategy: 'context', selector: '[role="dialog"] input[aria-label*="title" i], .event-editor input:first-of-type' }
      ]
    },
    'event-detail-time': {
      label: 'Time picker in event form',
      selectors: [
        { strategy: 'aria', selector: '[aria-label*="Start time" i]' },
        { strategy: 'data-testid', selector: '[data-testid="event-time-picker"]' },
        { strategy: 'role', selector: 'input[aria-label*="time" i], [role="combobox"][aria-label*="time" i]' },
        { strategy: 'class', selector: '.ep-time input, [data-key="time"] input' },
        { strategy: 'context', selector: '[role="dialog"] [aria-label*="time" i], .event-editor [aria-label*="time" i]' }
      ]
    },
    'event-detail-date': {
      label: 'Date picker in event form',
      selectors: [
        { strategy: 'aria', selector: '[aria-label*="Start date" i]' },
        { strategy: 'data-testid', selector: '[data-testid="event-date-picker"]' },
        { strategy: 'role', selector: 'input[aria-label*="date" i]' },
        { strategy: 'class', selector: '.ep-date input, [data-key="date"] input' },
        { strategy: 'context', selector: '[role="dialog"] [aria-label*="date" i], .event-editor [aria-label*="date" i]' }
      ]
    },
    'event-detail-description': {
      label: 'Description field in event form',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Description" i]' },
        { strategy: 'data-testid', selector: '[data-testid="event-description"]' },
        { strategy: 'role', selector: '[role="textbox"][aria-label*="description" i]' },
        { strategy: 'class', selector: '.ep-description [contenteditable], [data-key="description"] [contenteditable]' },
        { strategy: 'context', selector: '.event-editor [aria-label*="description" i], [role="dialog"] [contenteditable]' }
      ]
    },
    'event-detail-save': {
      label: 'Save button in event form',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Save"]' },
        { strategy: 'data-testid', selector: '[data-testid="event-save-button"]' },
        { strategy: 'role', selector: '[role="button"][aria-label="Save"]' },
        { strategy: 'class', selector: '.ep-save-button, [data-action="save"]' },
        { strategy: 'context', selector: '.event-editor [aria-label="Save"], [role="dialog"] [aria-label="Save"]' }
      ]
    },
    'event-detail-guests': {
      label: 'Add guests field',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Add guests"]' },
        { strategy: 'data-testid', selector: '[data-testid="event-guests-input"]' },
        { strategy: 'role', selector: 'input[aria-label*="guests" i], [role="combobox"][aria-label*="guests" i]' },
        { strategy: 'class', selector: '.ep-guests input, [data-key="guests"] input' },
        { strategy: 'context', selector: '.event-editor [aria-label*="guests" i], [role="dialog"] [aria-label*="guests" i]' }
      ]
    },
    'event-detail-location': {
      label: 'Add location field',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Add location"]' },
        { strategy: 'data-testid', selector: '[data-testid="event-location-input"]' },
        { strategy: 'role', selector: 'input[aria-label*="location" i]' },
        { strategy: 'class', selector: '.ep-location input, [data-key="location"] input' },
        { strategy: 'context', selector: '.event-editor [aria-label*="location" i], [role="dialog"] [aria-label*="location" i]' }
      ]
    }
  },
  selectors: {
    createButton: '[aria-label="Create"], .FAuoAc',
    todayButton: '[aria-label="Today" i], [data-value="today"]',
    forwardButton: '[aria-label="Next"]',
    backButton: '[aria-label="Previous"]',
    viewSwitcher: '[aria-label="View picker"], [role="tablist"]',
    searchBar: 'header [aria-label="Search"], #searchInput',
    calendarGrid: '[role="grid"], .tg-mainGrid',
    miniCalendar: 'aside [role="grid"], .minical',
    settingsGear: '[aria-label="Settings menu"], [data-tooltip="Settings"]',
    eventPopover: '[role="dialog"][aria-label*="event" i]',
    eventTitle: 'input[aria-label*="title" i], [aria-label="Add title"]',
    eventSave: '[aria-label="Save"]',
    eventMoreOptions: '[aria-label="More options"], [data-action="more-options"]'
  },
  workflows: {
    enableShortcuts: [
      'PREREQUISITE: This workflow MUST be run before any keyboard shortcuts will work',
      'Click the settings gear icon in the top-right header area',
      'In the dropdown menu, click "Settings"',
      'The Settings page opens in the same tab',
      'Look for "Keyboard shortcuts" section (usually under General settings)',
      'Find the "Enable keyboard shortcuts" toggle/checkbox',
      'If it is OFF, click to toggle it ON',
      'Click "Back to Calendar" or navigate back to calendar.google.com',
      'VERIFY: Press "?" — if a keyboard shortcuts overlay appears, shortcuts are enabled',
      'STUCK: If settings page layout has changed, use the browser search (Ctrl+F) to find "keyboard" on the settings page. If toggle is already ON, shortcuts should work — test with "?" key'
    ],
    createEvent: [
      'Press C to open the quick-create event popover (shortcuts must be enabled first)',
      'ALTERNATIVE: Click the "Create" / "+" button in the header',
      'The quick-create popover appears with a title input focused',
      'Type the event title',
      'Optionally Tab to the date/time fields and modify them',
      'Press Enter or click "Save" to create the event with defaults',
      'For more details: click "More options" to open the full event editor',
      'In full editor: fill in guests, location, description, repeat, etc.',
      'Click "Save" in the full editor to create the event',
      'VERIFY: The event appears on the calendar grid at the specified date/time',
      'STUCK: If C does not work, keyboard shortcuts may not be enabled — run enableShortcuts workflow first. If popover does not appear, click the Create button directly'
    ],
    editEvent: [
      'Navigate to the event on the calendar grid using Tab or click it',
      'Press Enter or click the event to open its detail popover',
      'In the popover, click the edit (pencil) icon or press E',
      'ALTERNATIVE: Double-click the event to open directly in edit mode',
      'The full event editor opens with all fields editable',
      'Modify the desired fields (title, time, guests, etc.)',
      'Click "Save" to apply changes',
      'VERIFY: The event on the calendar grid reflects the updated details',
      'STUCK: If the edit icon is not visible in the popover, try clicking "Open" to view full detail, then click the edit icon. If E key does not work, ensure shortcuts are enabled'
    ],
    navigateDates: [
      'Press T to jump to today (current date highlighted)',
      'Press J or N to move forward one period (day/week/month depending on view)',
      'Press K or P to move backward one period',
      'Press G to open the go-to-date picker — type a date and press Enter',
      'ALTERNATIVE: Click the forward (>) and back (<) arrows in the header',
      'ALTERNATIVE: Click a date in the mini-calendar sidebar to jump to it',
      'VERIFY: The header date range text updates to reflect the new period',
      'STUCK: If J/K/G shortcuts do not work, shortcuts may not be enabled. Use the arrow buttons in the header or the mini-calendar sidebar as click-based alternatives'
    ],
    switchViews: [
      'Press 1 for Day view, 2 for Week view, 3 for Month view',
      'Press 4 for Custom view, 5 for Year view, 6 for Schedule/Agenda view',
      'ALTERNATIVE: Click the view switcher dropdown/tabs in the header',
      'The calendar grid layout changes to match the selected view',
      'VERIFY: The layout changes — Day shows single column with hours, Week shows 7 columns, Month shows a month grid, Schedule shows a list',
      'STUCK: If number keys do not switch views, ensure keyboard shortcuts are enabled. Use the view switcher dropdown in the header as a click-based alternative'
    ],
    rsvpInvitation: [
      'Find the event on the calendar grid (events you are invited to show differently)',
      'Click the event to open its detail popover',
      'Look for RSVP buttons: "Yes", "No", "Maybe" (only visible on events you are invited to)',
      'Click the desired response button',
      'ALTERNATIVE: Open the event in full detail view and find RSVP options there',
      'VERIFY: The event color/status indicator changes to reflect your response',
      'STUCK: If RSVP buttons are not visible, this may be an event you created (not an invitation). RSVP is only available for events others have invited you to. Open the event detail and look for "Going?" section'
    ],
    searchEvents: [
      'Press / to focus the search input in the header',
      'ALTERNATIVE: Click the search icon/input in the header',
      'Type the search query (event title, guest name, location, etc.)',
      'Press Enter to execute the search',
      'Search results appear showing matching events',
      'Click a result to navigate to that event on the calendar',
      'VERIFY: Search results display events matching the query text',
      'STUCK: If / does not focus search, click the search icon directly. If no results appear, broaden the search terms or check the date range filter'
    ],
    createAllDayEvent: [
      'Navigate to the target date in Day or Week view',
      'Click the date header area ABOVE the time grid (the row showing the date number)',
      'A quick-create popover appears pre-set as an all-day event',
      'Type the event title',
      'Press Enter or click Save',
      'ALTERNATIVE: Press C, type title, then in the popover check "All day" checkbox before saving',
      'For multi-day events: use "More options" and set a date range',
      'VERIFY: The event appears in the all-day section at the top of the day/week column',
      'STUCK: If clicking the date header does not open a popover, try pressing C and manually toggling "All day". In Month view, clicking a date cell also creates an event for that date'
    ]
  },
  warnings: [
    'CRITICAL: Keyboard shortcuts MUST be enabled in Settings first — they are OFF by default. Without enabling, all single-key shortcuts (C, E, D, T, J, K, 1-6) will be ignored. Run enableShortcuts workflow before any other keyboard workflow.',
    'Event quick-create popover AUTO-POSITIONS and may render off-screen on small viewports or near screen edges. If the popover is not visible after pressing C, try scrolling or resizing the window.',
    'Time grid click-to-create uses COORDINATE-BASED positioning — the exact click location determines the event start time. Events snap to the nearest 15-minute boundary by default.',
    '"More options" in the quick-create popover opens the FULL EVENT EDITOR in the same tab (it replaces the calendar view). It is NOT a modal. Use the browser back button or "Back to calendar" to return.',
    'Calendar uses 15-MINUTE TIME SLOTS by default — events snap to the nearest 15-minute boundary. For precise times, use the time input field in the event editor.',
    'RSVP buttons (Yes/No/Maybe) only appear on events you are INVITED TO — they do not appear on events you created yourself.',
    'Dragging events to reschedule uses HTML5 drag — the dragdrop mechanical tool may work for this. Test with dragdrop first, fall back to editing event time fields if it fails.',
    'View switching keys (1-6) ONLY work with keyboard shortcuts enabled. They are single-key shortcuts that conflict with normal text input.',
    'Google Calendar at calendar.google.com is NOT the same as the Calendar panel in the Google Workspace sidebar (in Gmail, Drive, etc.). This guide is for the full calendar.google.com app.',
    'RECURRING EVENTS: Editing a recurring event prompts "This event", "This and following events", or "All events" — choose carefully. The wrong choice can modify many events at once.',
    'Event colors default to the calendar color unless manually changed in the event editor. Different calendars may show events in different colors.',
    'The mini-calendar in the sidebar (small month view) can be used for quick date navigation by clicking dates. It does not create events.'
  ],
  toolPreferences: ['navigate', 'click', 'type', 'keyPress', 'waitForTabLoad', 'getText', 'waitForElement', 'getAttribute', 'waitForDOMStable']
});
