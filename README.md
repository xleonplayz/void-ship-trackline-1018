# Trackline

A dependency-free JavaScript delivery tracker: REST route discovery and previews, bounded SSE journeys, native browser EventSource, pause/resume and accessible responsive UI. Every route, parcel, destination and event is synthetic.

Run `npm start`; `PORT` defaults to 3000. No external services or persistent data.

`GET /api/health`, `GET /api/routes`, and `POST /api/preview` (JSON `{ "route": "river", "parcels": 2 }`) form the REST API. Preview accepts integer parcel counts 1–12 and at most 4096 body bytes.

`GET /api/stream?route=river&after=0` emits a connection comment, then named `checkpoint` events every 350ms, each with a numeric ID and JSON data, followed by a named `complete` event and EOF. `Last-Event-ID` overrides the `after` query. Cursors must be integers from zero through the release's checkpoint count. Resume only returns checkpoints after that ID. Streams are finite and disconnects clear their timer. There is no retry or infinite producer loop.

Release 2 adds the fourth Delivered checkpoint. Release 1 remains reproducible at its pinned commit. UI pause closes EventSource and resume sends its last checkpoint; a completed journey can be replayed. This is a demonstration of delivery status, not an operational courier service.
