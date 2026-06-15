# BigQuery Release Hub

A premium, responsive web application built using Python Flask (backend) and plain vanilla HTML, JavaScript, and CSS (frontend) to fetch, parse, and interact with the official Google BigQuery Release notes.

## Features

- **GCP Feed Fetcher**: Pulls live release notes from the Google Cloud feeds site.
- **5-Minute Server Cache**: Minimizes feed bandwidth and speeds up load times using a memory-based backend cache.
- **Granular Segment Parser**: Automatically splits aggregate single-day feed entries into individual cards grouped by change type (*Feature*, *Change*, *Deprecated*, *Bug Fix*).
- **Search & Filters**: Real-time keyword search and tag filtering (e.g. show only features or bug fixes).
- **Theme Toggle**: A premium toggle switch in the header that swaps the color scheme between a dark mode and a light mode.
- **Copy to Clipboard**: One-click copying of individual update texts to the clipboard.
- **Export to CSV**: Download the currently active/filtered list of release notes as a clean CSV spreadsheet.
- **X (Twitter) Sharing Composer**: A slide-out panel that generates a beautiful, pre-formatted draft of the update. It handles Twitter's 280-character limit dynamically and takes into account Twitter's `t.co` URL compression.

---

## Tech Stack

- **Backend**: Python, Flask, Requests, XML ElementTree
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom Variables, Shimmer Animations, Transitions), Vanilla JS (DOMParser, Clipboard API, Blob Export)

---

## Getting Started

### 1. Installation

Clone or locate this directory and install the python dependencies:

```bash
pip install -r requirements.txt
```

### 2. Run the Development Server

Execute the following command to start the Flask application:

```bash
python app.py
```

The server runs locally on:
**[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## Folder Structure

```text
bq-releases-notes/
│
├── app.py                # Flask Server (Atom XML fetching, parsing, caching)
├── requirements.txt      # Python dependencies
├── README.md             # Project documentation
├── .gitignore            # Git exclusion rules
│
├── templates/
│   └── index.html        # Single-page application template
│
└── static/
    ├── css/
    │   └── style.css     # Dark/Light theme styles, animations, layouts
    └── js/
        └── app.js        # Feed segmentation, composer, actions controller
```
