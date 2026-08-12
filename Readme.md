# LinkedIn Connect Automation

A professional browser extension for the secure automation of networking and lead generation processes on LinkedIn, utilizing low-level mechanisms to simulate user behavior via the Chrome DevTools Protocol (CDP).

---

## 📋 Table of Contents

1. [Commit History](#-commit-history)
2. [Project Architecture & Directory Structure](#-project-architecture--directory-structure)
3. [Technical Approaches & Click Simulation Trade-offs](#-technical-approaches--click-simulation-trade-offs)
4. [Modal Handling & Exception Management](#-modal-handling--exception-management)
5. [Behavioral Fingerprinting & LinkedIn Anti-Fraud Mitigations](#anti-fraud)
6. [Rate Limiting & Limits Management](#%EF%B8%8F-rate-limiting--limits-management)
7. [Stability & Service Worker Resilience](#%EF%B8%8F-stability--service-worker-resilience)
8. [CI/CD Pipeline & Artifacts](#-cicd-pipeline--artifacts)

---

## 📋 Commit history

| Commit Name                   | Description of Added Functionality / Changes                                                                                                                                       |
| :---------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Initial commit**            | Initialized the base repository structure.                                                                                                                                         |
| **Add manifest config**       | Created the `manifest.json` configuration file of the **Manifest V3** standard with necessary permissions (`debugger`, `storage`, `activeTab`, `scripting`) and script injections. |
| **Add icon for my extention** | Added graphic icons for the interface and extension manifest.                                                                                                                      |
| **Add interface**             | Created the graphical extension interface (`popup.html`, `popup.css`, `popup.js`) with a control panel, status indicator, progress bar, and log terminal.                          |
| **Add telemetry**             | Created a client telemetry simulator (`telemetry.js`) for background transmission of micro-events to LinkedIn tracking domains.                                                    |
| **Add content logical**       | Added the main content script (`content_script.js`), which connects target searching, modal handling, and page turning.                                                            |
| **Add cpd logical**           | Implemented a low-level input module via the Chrome DevTools Protocol (`cpd.js` / `CDPInput`) to simulate natural mouse movements and safe clicks.                                 |
| **Add helper functions**      | Added recursive deep search functions for page elements considering Shadow DOM (`querySelectorAllDeep`).                                                                           |
| **Add selectors**             | Added logic for finding card elements (`getCardElements`) and analyzing connection button states (`resolveButtonState`).                                                           |
| **Rename selector file**      | Renamed selector/helper function files to maintain clean architecture.                                                                                                             |
| **Add storage manager**       | Implemented a statistics manager (`storageManager.js`) for tracking and updating daily and weekly account activity.                                                                |
| **Add constants file**        | Created a constants file (`constants.js`) with settings for delays, limits, and intervals.                                                                                         |
| **Add storage service**       | Implemented a Chrome local storage service (`storageService.js`) to store the bot's state and identifiers.                                                                         |
| **Add loger**                 | Created a logging service (`logger.js`) for saving event history, outputting colored logs to the console, and sending them to the UI.                                              |
| **Add language middleware**   | Added LinkedIn language environment checking (`languageMiddleware.js`) with startup blocking if the interface is not in English.                                                   |
| **Add limits middleware**     | Added middleware (`rateLimitsMiddleware.js`) to check daily and weekly invitation sending limits.                                                                                  |
| **Add dom scraper**           | Implemented a DOM parsing script (`domScraper.js`) to collect information about the current LinkedIn user (name, ID, Premium status).                                              |
| **Add runner**                | Added the core automation loop engine (`runner.js`), handling Gaussian delays, pagination, and modal windows.                                                                      |
| **Add message handlers**      | Implemented event handlers (`messageHandlers.js`) for routing actions (`START`, `STOP`, `GET_STATE`, `CLEAR_LOGS`) and retrieving account data.                                    |
| **Add service worker...**     | Created the main background service script (`background.js`), which restores the bot's operation after a restart and listens to global extension events.                           |

---

## 🛠 Project Architecture & Directory Structure

The extension is built on **Manifest V3** using ES modules (`type="module"`), structured logically across background, content scripts, and user interface layers:

- **`background/`** — Background processing layer:
  - `service_worker.js` — Main background service script managing the bot lifecycle and global events.
  - **`automation/`** — Business logic core (`runner.js` loop execution, `domScraper.js` account data harvesting).
  - **`config/`** — Configuration parameters (`constants.js` for delays and limits).
  - **`handlers/`** — Event and message routers (`messageHandlers.js`).
  - **`middlewares/`** — Validation checks (`languageMiddleware.js`, `rateLimitsMiddleware.js`).
  - **`services/`** — State persistence (`storageService.js`) and logging (`logger.js`).
  - **`utils/`** — Low-level input (`cpd.js`), DOM query utilities (`helperFunctions.js`, `selectors.js`), and statistics handling (`storageManager.js`).
- **`content/`** — Browser tab injected scripts:
  - `content_script.js` — Main scraper interacting with LinkedIn pages (card discovery, modal handling, pagination).
  - `telemetry.js` — Client telemetry simulator for periodic background micro-event tracking.
- **`popup/`** — Extension graphical UI (`popup.html`, `popup.css`, `popup.js`) featuring a control panel, live log terminal, and progress metrics.
- **`icons/`** — Graphic assets for extension UI and manifest.
- **`.github/`** — CI/CD GitHub Actions workflow configuration for build packaging.
- **`manifest.json`** — Core configuration file defining permissions and script injection maps.

---

## 🔬 Technical Approaches & Click Simulation Trade-offs

When designing automation scripts for modern secure platforms, choosing the right input simulation method is critical to bypass behavioral fingerprinting. Below is an evaluation of three core approaches:

| Approach                                                            | `isTrusted` | Description & Technical Rationale                                                                                                                                                                    |
| :------------------------------------------------------------------ | :---------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Standard DOM Events** (`el.click()` / `dispatchEvent`)         | ❌ `false`  | **Baseline method.** Dispatches synthetic DOM events directly within the renderer. Readily flagged by modern anti-bot frameworks as `isTrusted: false`.                                              |
| **2. Chrome DevTools Protocol** (`chrome.debugger` + `CDP Input`)   |  ✅ `true`  | **Selected Approach.** Low-level browser input pipeline injection. Generates synthetic mouse coordinates and events that natively register as trusted within the rendering engine.                   |
| **3. OS-Level Input** (RobotJS / xdotool / CGEvent via Native Host) |  ✅ `true`  | **True Hardware-level.** Real OS cursor movement, but unviable for production Chrome Web Store extensions because it requires installing an external native host binary outside the browser sandbox. |

---

### Why Approach #2 (`chrome.debugger` + CDP) was selected:

1. **Store Compliance & Portability:** Unlike OS-level native binaries (Approach #3), CDP is an official, built-in browser debugging interface. An extension using `chrome.debugger` can be packaged cleanly and distributed without forcing the end-user to compile or run external system daemons.
2. **`isTrusted: true` Validity:** By dispatching events directly through the browser's input pipeline via `Input.dispatchMouseEvent`, the generated click events successfully pass standard `Event.isTrusted` checks used by client-side event listeners.
3. **Advanced Behavioral Integration:** CDP allows pairing low-level coordinate manipulation with realistic quadratic Bézier curves, spatial jitter, and custom dwell delays, making it robust against basic heuristics without the heavy operational friction of external native host dependencies.

---

## 🛑 Modal Handling & Exception Management

During the automated sending of connection requests on LinkedIn, the interface frequently generates additional dialog windows (modals). The bot is equipped with an intelligent scanning and handling system (`handleModal`) that operates according to the following scenarios:

| Modal Type / Condition                           | Code Handling Logic                                                         | Bot Action                                                                                             |
| :----------------------------------------------- | :-------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| **Add a note / Invitation / Message**            | Found confirmation button without a note (`Send without a note` or `Send`). | Automatically clicks the button and sends the request without a custom note (`CLICK_SEND`).            |
| **How do you know <Name>? (Email verification)** | Detected an email input field (`input[type="email"]`).                      | Closes the modal via `closeModal` and skips the profile (`SKIPPED_EMAIL_REQUIRED`), logging the event. |
| **Weekly invitation limit / Limit**              | Detected text indicating the weekly invitation limit has been reached.      | Immediately stops the entire automation run (`LIMIT_STOP`) to prevent account restriction.             |
| **Unknown Modal**                                | A modal window appeared, but its text does not match known templates.       | Automatically closes the window for safety (`UNKNOWN_MODAL`) and records it in the system logs.        |

---

<a name="anti-fraud"></a>

## 🕵️‍♂️ Behavioral Fingerprinting & LinkedIn Anti-Fraud Mitigations

Relying solely on `Event.isTrusted === true` is a necessary baseline, but insufficient against modern security engines (such as DataDome and Akamai integrated into LinkedIn). Below is how our implementation addresses key client-side and server-side telemetry vectors:

### 1. Interval Entropy (Inter-action Timing)

- **The Threat:** Constant or uniformly distributed delays (e.g., a hardcoded `sleep(2000)`) create unnatural temporal frequencies that instantly flag automation loops.
- **Our Implementation:** We utilize a **Gaussian (Normal) Distribution delay engine** (`getGaussianDelay`), clustering action timestamps around a natural mean while introducing human-like hesitation and variance to defeat frequency-domain analysis.

### 2. Pre-Action Micro-Behaviors (`mousemove`, `scroll`, `hover-dwell`)

- **The Threat:** Direct programmatic `.click()` calls lack preceding viewport scrolling or cursor focusing, exposing headless or raw script execution.
- **Our Implementation:** Before any interaction, elements are smoothly brought into view using `scrollIntoView`, and synthetic `mouseenter` / `mouseover` events are dispatched alongside a randomized dwell timer to mimic biological focus allocation.

### 3. Cursor Trajectory (Bézier Curves & Spatial Jitter)

- **The Threat:** Instantaneous coordinate teleportation (`clientX`/`clientY` jumps) violates layout heuristics and screen-mapping physics.
- **Our Implementation:** The `CDPInput` module computes multi-step mouse routes via **quadratic Bézier curves** with randomized control points and sub-pixel spatial jitter (`jitterX`/`jitterY`), accurately replicating human trackpad/mouse movement arcs.

### 4. Client Telemetry Simulation (`li/track` Beacons)

- **The Threat:** Headless or isolated scripts omit background telemetry heartbeats. Ceasing to send periodic client event batches (`/li/track?action=client_event`) signals an inert or automated container.
- **Our Implementation:** An injected telemetry proxy (`LinkedInTelemetrySimulator`) runs from `document_start`, capturing micro-interactions, viewport metrics, and routing structured event batches via `navigator.sendBeacon` to mirror native telemetry.

### 5. Server-Side Heuristics & Account Scoring

- **The Threat:** Ignoring account age, acceptance rates, or connection pending/accepted ratios triggers immediate soft-locks and blocks.
- **Our Implementation:**
  - **Dynamic Account Profiling:** The DOM scraper inspects subscription details via the identity menu, adapting daily limits (5–10 for basic/new accounts vs. 20–30 for warmed/Premium accounts).
  - **State Verification:** Every action concludes with an async DOM check (`verifyTargetPending`) to ensure the target button transitions to _Pending_. If it fails, execution halts immediately.

### 6. The `chrome.debugger` Infobar Challenge

- **The Threat:** Attaching `chrome.debugger` triggers an OS-level infobar (_"Extension X is debugging this browser"_), altering the browser footprint and alerting users or advanced scripts.
- **Why `--silent-debugger-extension-api` fails:** Chrome Web Store production extensions cannot rely on command-line flags because standard consumer browser installations ignore them.
- **Our Architectural Mitigation:** We acknowledge this trade-off by strictly confining debugger attachment to high-value atomic clicks and automatically detaching via `finally` blocks to minimize session exposure windows.

---

### How the Modal Handling Module Works in Code:

The system initiates a retrying loop (up to 12 attempts with randomized delays) to wait for the complete rendering of the modal window within the Shadow DOM:

```javascript
async function handleModal() {
	let activeModal = null

	for (let attempt = 0; attempt < 12; attempt++) {
		const modals = querySelectorAllDeep(
			'[role="dialog"], div[aria-modal="true"]',
		)
		activeModal = modals.find((m) => {
			const text = (m.innerText || '').toLowerCase()
			return (
				text.includes('add a note') ||
				text.includes('invitation') ||
				text.includes('message')
			)
		})
		if (activeModal) break
		await new Promise((resolve) =>
			setTimeout(resolve, 200 + Math.random() * 150),
		)
	}
	// Further analysis of modal text and action dispatch...
}
```

---

## ⏱️ Rate Limiting & Limits Management

- **Observed Limits (2026):** ~100 invites per rolling 7-day window; daily soft-cap ~20–25 before throttling. Warmed/paid accounts get 20–30/day, while new/basic accounts get 5–10/day.
- **Dynamic Account Profiling:** The system automatically scales daily limits based on account type (detecting basic vs. warmed/Premium statuses).
- **Configurable & Persistent Limits:** Daily and weekly ceilings are persistent across browser restarts via `chrome.storage.local` and managed uniquely per account (`stats_${accountId}`). Counters automatically reset daily while retaining weekly history.
- **Gaussian Distribution Delays:** Instead of primitive linear or constant random intervals (`Math.random()`), action delays use a Normal (Gaussian) Distribution model (`GAUSSIAN_MIN: 3500ms`, `GAUSSIAN_MAX: 7000ms`) to faithfully mirror human pacing and defeat behavioral fingerprinting.
- **Middleware Interlocks:** Before executing any action, `checkRateLimitsMiddleware` evaluates current usage against limits, halting execution immediately upon hitting caps to protect the account from soft locks.

---

## 🛡️ Stability & Service Worker Resilience

- **Service Worker Lifecycle Management:** Since Manifest V3 service workers terminate after ~30 seconds of inactivity, the automation run is fully resumable.
- **State Persistence:** Critical runtime states (bot execution status, active tab ID, current account ID, and counters) are continuously synchronized and stored in `chrome.storage.local` via `StorageService`.
- **Automatic State Restoration:** Upon service worker restart or browser/tab reboot, the initialization hook checks the stored state and automatically restores active execution (`RUNNING`) or recovers metrics without losing progress.

---

## 🔗 CI/CD Pipeline & Artifacts

- **GitHub Actions Run:** [View Successful Workflow Run](https://github.com/Bodia06/lec/actions/runs/31623162036)
- **Download Build:** The artifact containing the built extension package (`.zip`) is available for download at the bottom of the specified run page (in the _Artifacts_ section).
