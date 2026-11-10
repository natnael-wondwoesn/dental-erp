# Booking relay (appointment form → clinic's Telegram)

A landing site is static, so it cannot send a message by itself. This tiny service receives
the form and forwards it to the clinic's Telegram chat through the clinic's own bot.

- Settings are env vars in a root-only file, e.g. `/etc/sunny-smile/dalian-bot.env`
  (`BOT_TOKEN`, `CHAT_ID`, `ALLOWED_ORIGIN`, `CLINIC_NAME`). Never commit the token.
- Run (python image, on the Caddy network so Caddy reaches it as `dalian-booking:8080`):

  ```bash
  docker run -d --name dalian-booking --restart unless-stopped --network kora_default \
    --env-file /etc/sunny-smile/dalian-bot.env -v /opt/booking-relay:/app:ro \
    python:3.12-slim python /app/server.py
  ```

- Caddy: inside the site's block add `handle /api/book { reverse_proxy dalian-booking:8080 }`
  **before** the `file_server`. (The worker's Pause/Restore rewrites the site's snippet; if it
  is restored, add the line again.)
- The site opts in with `clinic.bookingEndpoint: "/api/book"` in its `content.json`. If the relay
  is down, the form falls back to opening Telegram with the request copied.
- Limits: 5 requests / 10 min per visitor, 8 KB body, same-origin only, honeypot field ignored.
