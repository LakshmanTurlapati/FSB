/**
 * Site Guide: Google Maps
 * Per-site guide for Google Maps navigation, zoom, and pan interactions.
 *
 * Google Maps renders the map on an HTML5 <canvas> element with overlay divs
 * for controls, search, and info panels. Map interactions (zoom, pan) use
 * mouse wheel events and drag events on the canvas area.
 *
 * Zoom: Use scroll_at (CDP mouseWheel) at map center coordinates.
 * Pan: Use drag (CDP drag) to move the map view -- drag does NOT draw lines.
 * Navigation: Use URL parameters or the search box.
 *
 * Created for Phase 49, CANVAS-03 diagnostic.
 */

registerSiteGuide({
  site: 'Google Maps',
  category: 'Maps & Navigation',
  patterns: [
    /google\.com\/maps/i,
    /maps\.google\.com/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic CANVAS-03):
- [canvas] Use scroll_at (CDP mouseWheel) at map center for zoom; repeat 8-12x with wait_for_stable
- [canvas] cdpDrag PANS the map view -- does NOT draw lines; understand map vs drawing app distinction
- [canvas] Dismiss consent/cookie popup BEFORE any map interaction -- overlay blocks canvas events
- [canvas] Side panel is ~408px left; offset canvas center coords when panel is open
- [canvas] Verify zoom/pan via URL @lat,lng,zoomz format -- most reliable check

GOOGLE MAPS-SPECIFIC INTELLIGENCE:

NAVIGATION:
- Direct URL navigation: google.com/maps/search/[query] or google.com/maps/@lat,lng,zoom
- Search box: #searchboxinput (text input for location queries)
- Search button: #searchbox-searchbutton or button[aria-label="Search"]
- URL updates after navigation to include @lat,lng,zoomLevel format

MAP CANVAS:
- Google Maps renders the map on a <canvas> element inside #map or div[aria-label="Map"]
- The main map container uses role="presentation" or id="map"
- Canvas does NOT respond to content script dispatchEvent() -- use CDP tools exclusively
- Map canvas typically fills most of the viewport (exclude top search bar ~64px and left panel ~408px when open)
- Get canvas center for zoom: approximately (viewport.width / 2 + 200, viewport.height / 2) when side panel is open

CONSENT / COOKIE POPUPS:
- Google consent dialog may appear on first visit (GDPR regions)
- Look for: form[action*="consent"], button containing "Accept all" or "Reject all"
- Alternative selectors: [aria-label="Accept all"], button.tHlp8d
- Dismiss before interacting with the map -- the overlay blocks map events

ZOOM INTERACTION:
- Use scroll_at tool with deltaY=-120 (zoom in one tick) or deltaY=120 (zoom out one tick)
- Target the map canvas center coordinates (not the zoom buttons)
- Repeat scroll_at 8-12 times to go from city overview to street level
- Call wait_for_stable between every 2-3 scroll events to allow tile loading
- Google Maps zoom levels range from ~3 (continent) to ~21 (building level)
- Street level for walking paths is approximately zoom 16-18
- Keyboard alternatives: + key zooms in, - key zooms out (when map has focus)

ZOOM CONTROLS (DOM buttons):
- Zoom in button: button[aria-label="Zoom in"], #widget-zoom-in
- Zoom out button: button[aria-label="Zoom out"], #widget-zoom-out
- These are regular DOM buttons but scroll_at is preferred for finer control

PAN / DRAG INTERACTION:
- CDP drag on the map canvas PANS the map view (moves the viewport)
- Drag does NOT draw lines or create paths on Google Maps
- Use drag(startX, startY, endX, endY, steps=15, stepDelayMs=30) for smooth panning
- Map tiles reload after each pan -- call wait_for_stable after each drag
- Dragging right-to-left pans the view eastward (reveals east), and vice versa
- The URL updates with new coordinates after panning

MAP SCALE AND ZOOM VERIFICATION:
- Zoom level may appear in the URL as the third parameter: @lat,lng,zoomz (e.g., @40.785,-73.963,17z)
- Scale bar: div.widget-scale-text or div[jstcache] with distance text
- Satellite/terrain toggle: button[aria-label="Show satellite imagery"] or [data-value="satellite"]

SIDE PANEL AND INFO:
- Left side panel shows place details when a location is selected
- Panel selector: div[role="main"], div.widget-pane
- Close panel: button[aria-label="Close"], button.hYBOP
- The panel can obscure part of the map canvas -- account for panel width (~408px) in coordinate calculations

KEYBOARD SHORTCUTS:
- + / = : Zoom in
- - : Zoom out
- Arrow keys: Pan map in that direction
- / : Focus search box

MAP TILE LOADING:
- After zoom or pan, map tiles load asynchronously (typically 500ms-2s)
- Always call wait_for_stable after zoom/pan sequences
- Large zoom changes (multiple scroll_at calls) may need longer waits
- Check for loading spinner or tile placeholders via DOM if needed`,
  selectors: {
    mapContainer: 'div[role="application"][aria-label*="Map"], #map, div[aria-label="Map"], div[role="presentation"]',
    mapCanvas: 'div[role="application"][aria-label*="Map"] canvas, #map canvas, div[aria-label="Map"] canvas',
    searchBox: '[role="combobox"].UGojuc, #searchboxinput, input[aria-label="Search Google Maps"]',
    searchButton: '#searchbox-searchbutton, button[aria-label="Search"]',
    zoomIn: 'button[aria-label="Zoom in"], #widget-zoom-in',
    zoomOut: 'button[aria-label="Zoom out"], #widget-zoom-out',
    consentDialog: 'form[action*="consent"], div[aria-modal="true"]',
    consentAccept: 'button[aria-label="Accept all"], form[action*="consent"] button:first-of-type',
    consentReject: 'button[aria-label="Reject all"]',
    scaleBar: 'div.widget-scale-text, div.widget-scale',
    sidePanel: 'div[role="main"], div.widget-pane, div.section-layout',
    sidePanelClose: 'button[aria-label="Collapse side panel"], button[aria-label="Close"], button.hYBOP',
    satelliteToggle: 'button[aria-label="Show satellite imagery"], button[data-value="satellite"]',
    streetViewToggle: 'button[aria-label="Pegman"], div.widget-pegman',
    directionsButton: 'button[aria-label="Directions"]',
    layersButton: 'button[aria-label="Layers"]'
  },
  workflows: {
    navigateToLocation: [
      'Use navigate tool with URL: google.com/maps/search/[location+name]',
      'Wait for map to load via wait_for_stable',
      'Dismiss consent/cookie popup if present (click Accept all button)',
      'Verify location loaded by checking URL for coordinates or DOM for place name'
    ],
    zoomToStreetLevel: [
      'Identify map canvas center coordinates (viewport center, offset for side panel if open)',
      'Call scroll_at(centerX, centerY, deltaY=-120) to zoom in one tick',
      'Repeat scroll_at 8-12 times, calling wait_for_stable every 2-3 scrolls',
      'Verify zoom level by checking URL parameter (target zoom 16-18 for street view)',
      'Alternative: use press_key with + key if scroll_at is not responsive'
    ],
    panMap: [
      'Use drag(startX, startY, endX, endY, steps=15, stepDelayMs=30) on map canvas',
      'Drag direction determines pan: drag left-to-right reveals western portion, etc.',
      'Call wait_for_stable after each drag to allow tile reloading',
      'Verify pan by checking URL coordinate changes',
      'Repeat drag segments to trace a path around a geographic feature'
    ],
    searchAndNavigate: [
      'Click search box (#searchboxinput) to focus it',
      'Type location name into search box',
      'Press Enter or click search button to execute search',
      'Wait for map to animate to the search result location',
      'Verify by checking the URL or side panel for place information'
    ]
  },
  warnings: [
    'Google Maps canvas requires CDP trusted events (scroll_at, click_at, drag) -- content script events are ignored',
    'Drag on Google Maps PANS the map view -- it does NOT draw lines or create routes',
    'Consent/cookie popup blocks all map interactions until dismissed -- always check and dismiss first',
    'Map tiles load asynchronously after zoom/pan -- always wait_for_stable before next interaction',
    'Side panel (place details) covers ~408px on the left -- offset canvas center coordinates accordingly',
    'Large DOM snapshots: Google Maps DOM can be very large with many tile/overlay elements -- use targeted selectors',
    'Zoom level 16-18 is ideal for seeing walking paths and street-level detail',
    'URL coordinates update after navigation but may lag behind rapid zoom/pan sequences'
  ],
  toolPreferences: ['scroll_at', 'click_at', 'cdpDrag', 'navigate', 'waitForDOMStable', 'click', 'getAttribute', 'press_key', 'wait_for_stable']
});
