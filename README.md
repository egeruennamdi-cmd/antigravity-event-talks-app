# BigQuery Release Hub

A premium, responsive, single-page dashboard for tracking and sharing official Google Cloud BigQuery Release Notes in real time.

👉 **GitHub Repository:** [https://github.com/egeruennamdi-cmd/antigravity-event-talks-app](https://github.com/egeruennamdi-cmd/antigravity-event-talks-app)

---

## 🌟 Key Features

1. **Semantic Topic Splitting:** BigQuery release feed entries group multiple updates by date. The frontend JS deconstructs these into individual, stand-alone cards based on subtopics (Features, Changes, Notices, Deprecations).
2. **Category Classification:** Color-coded badges and icons classify each micro-update automatically:
   - **Features:** Emerald Green (Spark/Star Icon)
   - **Changes:** Violet/Purple (Clock Icon)
   - **Deprecations:** Rose/Red (Warning Icon)
   - **Notices:** Amber/Yellow (Info Icon)
3. **Keyword Filtering:** Reactive client-side search box updates the display grid instantaneously as you type.
4. **Multi-Selection Dock:** Select multiple update cards using custom checkmarks, sliding up a bottom action dock indicating the total count.
5. **High-Fidelity Tweet Composer:** Houses a modal mocking the layout of an X/Twitter post.
   - Pre-populates update date, type, link, and a cleaned summary.
   - Embeds a circular progress ring ($2\pi r$) character limit gauge that shifts colors (Green -> Amber -> Red) based on text boundaries.
   - Offers Web Intent sharing to post on Twitter without OAuth keys, or a mock simulation option.

---

## 🛠️ Technology Stack

* **Backend:** Python 3, Flask (REST JSON API)
* **Frontend:** Semantic HTML5, Vanilla CSS3 (Glassmorphism design, radial backdrop glows), Vanilla ES6 JavaScript
* **Data Source:** Official BigQuery RSS XML Feed

---

## 📂 Project Structure

```text
antigravity-event-talks-app/
├── app.py                  # Flask Application server & XML-to-JSON API
├── templates/
│   └── index.html          # Base HTML5 semantic layout
├── static/
│   ├── style.css           # Custom dark mode glassmorphism styles
│   └── app.js              # State management, HTML parser, and composer logic
├── .gitignore              # Pre-configured Python and environment exclusions
└── README.md               # Setup and usage guide
```

---

## 🚀 Getting Started & Local Setup

### Prerequisites
Make sure Python 3.x is installed on your local machine.

### Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/egeruennamdi-cmd/antigravity-event-talks-app.git
   cd antigravity-event-talks-app
   ```
2. Install Flask:
   ```bash
   pip install flask
   ```

### Running Locally
1. Start the Flask server:
   ```bash
   python app.py
   ```
2. Open your web browser and navigate to:
   👉 **http://localhost:5000**
