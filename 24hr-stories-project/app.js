(() => {
  "use strict";
  const STORAGE_KEY = "moments_stories_v1";
  const JOURNAL_KEY = "moments_journal_v1";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const STORY_DURATION = 5000;
  const MAX_WIDTH = 1080;
  const MAX_HEIGHT = 1920;

  const $ = (id) => document.getElementById(id);
  const input = $("imageInput");
  const rail = $("storiesRail");
  const viewer = $("viewer");
  const viewerImage = $("viewerImage");
  const progressBars = $("progressBars");
  const toast = $("toast");
  let stories = [];
  let activeIndex = 0;
  let timer = null;
  let progressTimer = null;
  let startedAt = 0;
  let paused = false;
  let touchStartX = 0;
  let toastTimer = null;

  function updateWordCount() {
    const entry = $("journalEntry");
    const words = entry.value.trim() ? entry.value.trim().split(/\s+/).length : 0;
    $("wordCount").textContent = `${words} ${words === 1 ? "word" : "words"}`;
  }

  function setupJournal() {
    const entry = $("journalEntry");
    try {
      entry.value = localStorage.getItem(JOURNAL_KEY) || "";
    } catch (error) {
      showToast("Your journal could not be loaded from this device.");
    }
    updateWordCount();
    entry.addEventListener("input", () => {
      updateWordCount();
      try {
        localStorage.setItem(JOURNAL_KEY, entry.value);
      } catch (error) {
        showToast("Your journal is full. Please clear some browser storage.");
      }
    });
  }

  function readStories() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const now = Date.now();
      stories = Array.isArray(stored) ? stored.filter(s =>
        s && typeof s.id === "string" && typeof s.image === "string" &&
        typeof s.createdAt === "number" && now - s.createdAt < DAY_MS
      ) : [];
      saveStories();
    } catch (error) {
      stories = [];
      showToast("Saved stories could not be read. Storage may be full.");
    }
  }

  function saveStories() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
      return true;
    } catch (error) {
      showToast("Browser storage is full. Delete an old story and try again.");
      return false;
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function timeAgo(timestamp) {
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return "Expired";
  }

  function renderStories() {
    rail.querySelectorAll(".story-person:not(.add-person)").forEach(el => el.remove());
    const addCard = $("addStoryCard");
    const emptyHint = $("emptyHint");
    $("storyCount").textContent = stories.length;
    $("storyCountLabel").textContent = stories.length === 1 ? "story" : "stories";
    emptyHint.hidden = stories.length > 0;

    stories.forEach((story, index) => {
      const button = document.createElement("button");
      button.className = `story-person${story.seen ? " seen" : ""}`;
      button.type = "button";
      button.setAttribute("aria-label", `View story ${index + 1}`);
      const thumb = document.createElement("span");
      thumb.className = "story-thumb";
      const img = document.createElement("img");
      img.src = story.image;
      img.alt = "";
      thumb.appendChild(img);
      const name = document.createElement("span");
      name.className = "person-name";
      name.textContent = story.label || "Your story";
      const note = document.createElement("span");
      note.className = "person-note";
      note.textContent = timeAgo(story.createdAt);
      button.append(thumb, name, note);
      button.addEventListener("click", () => openViewer(index));
      rail.insertBefore(button, addCard.nextSibling);
    });
  }

  function openPicker() {
    input.value = "";
    input.click();
  }

  async function resizeToDataUrl(file) {
    if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
    const sourceUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("That image could not be opened."));
        img.src = sourceUrl;
      });
      const scale = Math.min(1, MAX_WIDTH / image.naturalWidth, MAX_HEIGHT / image.naturalHeight);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, width, height);
      // JPEG compression helps keep localStorage usage manageable.
      return canvas.toDataURL("image/jpeg", 0.86);
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  input.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      showToast("Choose an image smaller than 20 MB.");
      return;
    }
    try {
      showToast("Preparing your moment…");
      const image = await resizeToDataUrl(file);
      const story = {
        id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        image,
        createdAt: Date.now(),
        label: "Your story",
        seen: false
      };
      stories.unshift(story);
      if (!saveStories()) {
        stories.shift();
        return;
      }
      renderStories();
      showToast("Your story is live for the next 24 hours.");
    } catch (error) {
      showToast(error.message || "Could not add that image.");
    }
  });

  function stopPlayback() {
    clearTimeout(timer);
    clearInterval(progressTimer);
    timer = null;
    progressTimer = null;
  }

  function closeViewer() {
    stopPlayback();
    viewer.classList.remove("open");
    viewer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    viewerImage.removeAttribute("src");
  }

  function buildProgress() {
    progressBars.replaceChildren();
    stories.forEach((_, i) => {
      const track = document.createElement("div");
      track.className = "progress-track";
      const fill = document.createElement("div");
      fill.className = "progress-fill";
      if (i < activeIndex) fill.classList.add("done");
      track.appendChild(fill);
      progressBars.appendChild(track);
    });
  }

  function openViewer(index) {
    if (!stories.length) return;
    activeIndex = Math.max(0, Math.min(index, stories.length - 1));
    viewer.classList.add("open");
    viewer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    showCurrentStory();
  }

  function showCurrentStory() {
    stopPlayback();
    if (activeIndex < 0 || activeIndex >= stories.length) {
      closeViewer();
      return;
    }
    const story = stories[activeIndex];
    story.seen = true;
    saveStories();
    renderStories();
    viewerImage.src = story.image;
    $("viewerName").textContent = story.label || "Your story";
    $("viewerTime").textContent = timeAgo(story.createdAt);
    $("viewerPosition").textContent = `${activeIndex + 1} / ${stories.length}`;
    $("prevStory").hidden = stories.length < 2;
    $("nextStory").hidden = stories.length < 2;
    buildProgress();
    startedAt = Date.now();
    paused = false;
    const fill = progressBars.children[activeIndex]?.firstElementChild;
    progressTimer = setInterval(() => {
      if (paused || !fill) return;
      const pct = Math.min(100, ((Date.now() - startedAt) / STORY_DURATION) * 100);
      fill.style.width = `${pct}%`;
    }, 40);
    timer = setTimeout(nextStory, STORY_DURATION);
  }

  function nextStory() {
    if (activeIndex < stories.length - 1) {
      activeIndex++;
      showCurrentStory();
    } else {
      closeViewer();
    }
  }

  function previousStory() {
    if (activeIndex > 0) {
      activeIndex--;
      showCurrentStory();
    } else {
      startedAt = Date.now();
      const fill = progressBars.children[activeIndex]?.firstElementChild;
      if (fill) fill.style.width = "0%";
      stopPlayback();
      timer = setTimeout(nextStory, STORY_DURATION);
    }
  }

  function deleteCurrentStory() {
    if (activeIndex < 0 || activeIndex >= stories.length) return;
    stories.splice(activeIndex, 1);
    saveStories();
    renderStories();
    if (!stories.length) {
      closeViewer();
    } else {
      activeIndex = Math.min(activeIndex, stories.length - 1);
      showCurrentStory();
    }
    showToast("Story deleted.");
  }

  $("heroAddBtn").addEventListener("click", openPicker);
  $("addStoryCard").addEventListener("click", openPicker);
  $("closeViewer").addEventListener("click", closeViewer);
  $("nextStory").addEventListener("click", nextStory);
  $("prevStory").addEventListener("click", previousStory);
  $("deleteStoryBtn").addEventListener("click", deleteCurrentStory);

  $("clearStoriesBtn").addEventListener("click", () => {
    if (!stories.length) {
      showToast("You don't have any stories yet.");
      return;
    }
    if (window.confirm("Delete all stories saved on this device?")) {
      closeViewer();
      stories = [];
      saveStories();
      renderStories();
      showToast("All stories cleared.");
    }
  });

  viewer.addEventListener("click", (event) => {
    if (event.target.classList.contains("viewer-backdrop")) closeViewer();
  });
  viewerImage.addEventListener("click", (event) => {
    const bounds = viewerImage.getBoundingClientRect();
    if (event.clientX < bounds.left + bounds.width / 2) previousStory();
    else nextStory();
  });
  viewer.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });
  viewer.addEventListener("touchend", (event) => {
    const delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 55) {
      if (delta < 0) nextStory();
      else previousStory();
    }
  }, { passive: true });
  viewer.addEventListener("mouseenter", () => { paused = true; });
  viewer.addEventListener("mouseleave", () => {
    if (viewer.classList.contains("open") && paused) {
      paused = false;
      const elapsed = Date.now() - startedAt;
      clearTimeout(timer);
      timer = setTimeout(nextStory, Math.max(100, STORY_DURATION - elapsed));
    }
  });
  document.addEventListener("keydown", (event) => {
    if (!viewer.classList.contains("open")) return;
    if (event.key === "Escape") closeViewer();
    if (event.key === "ArrowRight") nextStory();
    if (event.key === "ArrowLeft") previousStory();
  });

  // Expiration is enforced on startup and whenever the page becomes visible.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      const before = stories.length;
      stories = stories.filter(story => Date.now() - story.createdAt < DAY_MS);
      if (stories.length !== before) {
        saveStories();
        renderStories();
        if (viewer.classList.contains("open")) closeViewer();
      }
    }
  });

  readStories();
  renderStories();
  setupJournal();
})();
