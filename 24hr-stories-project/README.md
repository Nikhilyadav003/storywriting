# Moments — 24hr Stories

A responsive, client-side memory space for fleeting photos and everyday writing. Built with plain HTML, CSS and JavaScript.

## Features
- Add a photo from your device.
- Images are resized to fit within **1080 × 1920 px** and converted to JPEG Base64.
- Stories are saved in browser `localStorage`.
- Stories expire 24 hours after posting (checked on page load and when the tab becomes visible).
- Story viewer with progress bars, timed advance, previous/next navigation, keyboard controls and touch swipe.
- Mark stories as seen, delete a story, or clear all stories.
- A warm journal section with a daily prompt, autosaving text, and a live word count.
- A small rituals section with gentle prompts for slowing down.
- Responsive desktop and mobile layout.

## Run locally
1. Extract the ZIP.
2. Open `index.html` in a modern browser.
3. Click **Add to your story** and choose an image, or scroll to **The Journal** to start writing.

No backend, build tools, or installation required.

## Notes
- Stories are stored only in the browser on this device/profile. Clearing browser data removes them.
- `localStorage` has limited capacity. The app compresses images, but very large collections can still fill it.
- Journal entries are also stored in the browser on this device/profile.
- This is a frontend learning project, not a secure private-storage system.
