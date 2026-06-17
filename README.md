# BigQuery Release Pulse 🚀

A sleek, responsive, and modern web application built using **Python Flask**, **Vanilla HTML5**, **Vanilla JS**, and **Vanilla CSS**. This app automatically tracks, parses, and displays release notes from the official Google Cloud BigQuery RSS/Atom feed. It also provides a robust "Tweet Composer" interface that lets users select specific updates to tweet about them with one click.

---

## Key Features

1. **Live Feed Fetcher**: Connects directly to Google's official BigQuery Atom release feed.
2. **Intelligent XML Parsing**: Parses feed entries dynamically, breaking them down by individual updates (`Feature`, `Announcement`, `Issue`, `Deprecated`, etc.) and assigning customized styled badges for each type.
3. **Interactive Tweet Composer**:
   - Checkboxes on each release card let users select one or more updates.
   - Text is auto-formatted based on selection (single vs. multiple items).
   - In-app composition box with a visual character progress ring indicating the Twitter 280-character limit.
   - Direct integration using Twitter Web Intents (`https://x.com/intent/tweet`) to post instantly without needing API keys.
4. **Instant Search & Filtering**:
   - Fast client-side text search across update titles and descriptions.
   - Tag-based filters to focus on features, announcements, issues, or deprecations.
5. **Robust Caching & Offline Fallbacks**: In-memory caching prevents rate-limiting, while hard refreshes are supported via the refresh button.
6. **Rich Aesthetics**: Premium dark theme featuring smooth hover transitions, glassmorphic layout cards, animated loading indicators, and modern typography (Outfit and Inter).

---

## Folder Structure

```text
C:\Users\toddn\Desktop\agy-cli-projects\agy-cli-projects/
├── app.py                 # Flask server & backend XML parser logic
├── templates/
│   └── index.html         # Plain HTML layout & Tweet Composer structure
├── static/
│   ├── css/
│   │   └── style.css      # Custom stylesheet (Design system, grids, and animations)
│   └── js/
│       └── main.js        # Client-side reactivity, search, filter, & state management
└── README.md              # Documentation
```

---

## How to Run Locally

### 1. Prerequisites
Ensure you have Python 3 installed. Verify with:
```bash
python --version
```

Make sure **Flask** and **Requests** are installed:
```bash
pip install flask requests
```

### 2. Launch the Application
Run the Flask server:
```bash
python app.py
```

By default, the application will start in debug mode on:
```text
http://127.0.0.1:5000/
```

### 3. Usage
- Click **Refresh** to force-fetch the latest live updates from Google Cloud.
- Type in the **Search bar** or click the **Filter chips** to filter notes dynamically.
- Click any card, or click **Select to Tweet**, to load that update into the Tweet Composer in the right sidebar.
- Click **Post** to tweet, or click the **Copy icon** to copy the text to your clipboard.
