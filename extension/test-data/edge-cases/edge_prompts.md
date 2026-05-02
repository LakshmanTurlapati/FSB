# AI Browser Agent Failure Prompts

## Category 1: Canvas, WebGL, & Spatial Reasoning
*Agents fail here because there are no DOM nodes to parse, requiring flawless vision-to-coordinate math.*

1. Navigate to a TradingView chart and draw a Fibonacci retracement from the local low to the local high.
2. Open Figma, create a new frame, and align three different sized rectangles horizontally by their centers.
3. Go to Google Maps, zoom in on Central Park, and trace a walking path around the reservoir.
4. Play a game of browser-based solitaire and move the 7 of Spades to the 8 of Hearts.
5. Open Photopea, upload an image, and use the magic wand tool to remove the background.
6. Interact with a 3D product viewer on a retail site and rotate the shoe exactly 180 degrees to view the sole.
7. Click the "Spin" button in a canvas-based web game where the button is painted pixels, not an HTML element.
8. Go to an online piano keyboard and play the first four notes of "Mary Had a Little Lamb."
9. Use an online PDF editor to place a signature exactly on the dotted line at the bottom of page 3.
10. Open a Miro board and group five scattered sticky notes into a single selectable cluster.

## Category 2: Continuous Input & Micro-Interactions
*Agents fail here because they send discrete commands rather than continuous, real-time event streams.*

11. Adjust the volume slider on a custom HTML5 video player to exactly 37%.
12. Click and hold the "record" button on a web-based voice memo app for exactly 5 seconds, then release.
13. Reorder a Jira board by dragging the bottom card in the "To Do" list to the top of the "Done" list.
14. Highlight exactly the second sentence of the third paragraph in a Wikipedia article.
15. Use a color picker tool to select a custom hex code by dragging the hue slider and the shade reticle.
16. Scroll horizontally through a carousel of Netflix shows without triggering the vertical page scroll.
17. Hover over a navigation menu, wait for the CSS animation to reveal the mega-menu, and click a deeply nested sub-link.
18. Drag a file from a local desktop folder and drop it precisely into a browser-based dropzone.
19. Solve a "slide-to-fit" puzzle CAPTCHA by dragging the puzzle piece at a human-like, variable speed.
20. Scrub a podcast audio timeline to exactly the 14:22 mark.

## Category 3: Infinite Scroll & Virtualized DOMs
*Agents fail here due to state bloat and the inability to read data that has been unmounted from the DOM.*

21. Scroll through a target user's X (Twitter) feed and extract the text of their 150th post.
22. Scrape the names of all 500 items on a dynamically loading e-commerce search results page.
23. Find a specific log entry from three days ago in an infinitely scrolling DataDog dashboard.
24. Navigate to the bottom of a heavily populated Reddit thread and reply to the very last comment.
25. Read a multi-page document in a viewer that uses virtualized rendering (unloading previous pages from the DOM as you scroll).
26. Expand all nested comment threads on a Hacker News post with over 1,000 comments.
27. Find an Airbnb listing by continuously panning the map interface until new pins populate.
28. Scroll down a TikTok web feed until you find a video containing a cat.
29. Extract the pricing data from a table that only loads rows when they are actively in the viewport.
30. Navigate an infinite-scroll news site and stop exactly when you reach articles published yesterday.

## Category 4: Context Bloat & Long-Running Workflows
*Agents fail here because token limits max out, causing them to forget early instructions or hallucinate screen states.*

31. Monitor a live sports ticker for 30 minutes and record a log every time the score changes.
32. Fork an Observable notebook, modify the data array in cell 3, but absolutely do not alter the formatting in cell 1.
33. Read a 50-page technical PDF, then fill out a web form using specific details found only on pages 4, 17, and 42.
34. Open five different tabs comparing flight prices, and switch back to the cheapest one after 20 minutes of searching.
35. Navigate a multi-step checkout process, intentionally input a wrong zip code, correct it, and verify the tax dynamically updates.
36. Converse with a customer support chatbot for 15 turns, then summarize the very first instruction it gave you.
37. Log into an account, trigger an email 2FA code, open a new tab to fetch the code, and return to complete the login.
38. Edit a Google Doc by replacing every instance of the word "synergy" with "collaboration" without using the Find/Replace tool.
39. Cross-reference a list of 50 employee names in a web CRM against a separate web-based HR portal.
40. Leave the browser idle for an hour, handle the "Session Expired" modal, re-authenticate, and resume the exact previous task.

## Category 5: Visual Ambiguity & Dark Patterns
*Agents fail here because they lack the human intuition to discern deceptive UI elements from genuine ones.*

41. Download a file from a freeware hosting site while ignoring the three fake "Download Now" advertisement buttons.
42. Opt out of all non-essential cookies on a European news site that hides the "reject all" option behind multiple vague menus.
43. Cancel a subscription on a site that repeatedly shuffles the "Keep My Plan" and "Cancel" button positions.
44. Close a pop-up ad where the "X" button is camouflaged against the background image.
45. Bypass a "Please disable your adblocker" modal that has no visible DOM exit button.
46. Select the cheapest flight option on an airline site that uses misleading highlighting for the premium tiers.
47. Uncheck the hidden "subscribe to newsletter" box that is dynamically injected into the DOM right before clicking submit.
48. Find the actual login link on a homepage that heavily prioritizes "Sign Up" calls to action.
49. Identify and click the "Skip Ad" button on a video player the exact millisecond the 5-second countdown finishes.
50. Successfully scrape text from a site that completely blocks right-clicks, disables text selection, and masks its CSS class names.