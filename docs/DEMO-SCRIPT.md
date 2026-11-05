# WalimApp AI — Three-minute demo script

Goal: show the **real running application** and **real, live Meta API calls**. No mocked or cached responses are presented as live AI.

## Pre-flight checklist (do this before recording)

1. `.env` contains a valid `MODEL_API_KEY` (do **not** open or show `.env` on screen). Internet is on.
2. Reset test data: `data/inquiries.json` must contain exactly `[]`.
3. Free port 3000. In a terminal sized to be readable, run `npm start`. It must print
   `Meta API: key configured (https://api.meta.ai/v1)` — if it prints "no key — cached demo mode", **stop**: the demo would not be live.
4. **Warm the 360° panorama once** (open any hall → *Load the sample tour*) so the 1.6 MB sample image is cached, then reload the app.
5. Browser at 1280×800, language **EN**, zoom 100 %, no bookmarks bar. Layout: browser on the left ~70 %, terminal visible on the right ~30 % (or Alt-Tab cut) so the `[meta]` log line can be shown.
6. Prepare the prompt in a note (paste it, don't type it live):
   `I need an elegant wedding hall in Algiers for 250 guests, with parking and catering, and a budget of 450,000 DZD.`
7. Make sure the header badge currently says **DEMO** (it only turns **LIVE AI** after a successful live response).

## Timeline

| Time | On screen | Say (concise) |
|---|---|---|
| **0:00–0:15** | Landing page. Terminal visible showing the server banner and "key configured". | "Finding a wedding hall in Algeria means calling many owners and repeating your needs. WalimApp AI is a web prototype where you describe your wedding once, **Meta Muse Spark** matches it to real catalogue halls, and the owner confirms from a dashboard. All venues here are fictional sample data." |
| **0:15–0:55** | Paste the prompt into the concierge → click **Rank with Muse Spark**. While it runs (≈6–15 s) point to the **DEMO** badge, then cut/point to the terminal where the new line appears: `[meta] POST /chat/completions model=muse-spark-1.3 -> HTTP 200 in …ms`. Badge flips to **LIVE AI**. Show the *Extracted criteria* chips and the two ranked cards with their score and reason. | "The badge is DEMO until Meta answers. This is a real call to `api.meta.ai` — here is the server log: model `muse-spark-1.3`, HTTP 200. Muse Spark ranked the halls and explained each match. The second hall is clearly marked **over budget** — 480,000 against 450,000." |
| **0:55–1:10** | Optional: show one row of `data/halls.json` (e.g. `h-alger-nour`: price 320000, capacity 120–450, parking, cuisine) next to the card. | "Prices, capacity and amenities come from our dataset. The server drops any hall ID the model invents, and falls back to a labelled DEMO ranking if Meta fails — it never calls that live." |
| **1:10–1:45** | Click **Details** on the first hall. Click through the gallery. Scroll to *360° tour* → click **Load the sample tour** once → the panorama renders → drag to look around. Point at the caption. | "Each hall page has a gallery and a 360° viewer. The scene you see is a **generic placeholder panorama** — it only demonstrates the Pannellum viewer, it is **not this hall and not a 3D scan**. Genuine hall panoramas would come from the owners." |
| **1:45–2:10** | Scroll to the booking form → fill name, phone, a free date (e.g. 2027-06-12), 250 guests, a short message → tick consent → **Send inquiry**. Show the `WAL-XXXXXX` reference. | "The couple sends an inquiry with explicit consent. It starts *pending* and does not block the date." |
| **2:10–2:45** | Click **Owner**. Show the tiles (1 pending) and the new inquiry. Add a note → **Accept**. Tiles update to 1 confirmed. | "The owner sees the request with client and event details and accepts it. If another request for the same hall and date is accepted, the server refuses with a 409 conflict. This demo owner area has **no authentication** — that is a known prototype limitation." |
| **2:45–3:00** | Click **Tracking** → paste the reference → **Confirmed** with the owner's note. End on the marketplace. | "The client tracks the same reference and sees *Confirmed*. Live Muse Spark discovery, a real booking workflow, and an owner dashboard — built with Muse Code. Thank you." |

## Evidence to capture

- Terminal: the server banner (`key configured`) and the `[meta] POST /chat/completions model=muse-spark-1.3 -> HTTP 200` line **during** the discovery request.
- Browser: header badge **DEMO → LIVE AI** and the "Extracted criteria" chips after the response.
- Optional extra proof: open `http://localhost:3000/api/meta-status` (shows the base URL, model IDs and `keyConfigured: true` — it never shows the key).

## Do not

- Do not show `.env`, the API key, browser dev-tools network headers (they contain no key, but avoid the question), or any real personal phone number.
- Do not describe the app as a native Android app, the panorama as a 3D scan, or the halls as real businesses.
- Do not mention SAM 3.1 or Muse Image as features: they are not part of the supported product.
- If Meta is slow or fails during recording, **say so**: the badge will stay DEMO and the result is a cached demo ranking. Re-record rather than presenting it as live.

## After recording

Restore the demo data: `data/inquiries.json` back to `[]`, and stop the server.
