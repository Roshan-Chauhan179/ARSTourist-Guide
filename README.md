# ARS Tourist Guide

## Setup

1. Copy `.env.example` to `.env` and set a long, random `JWT_SECRET`. Add an `OPENAI_API_KEY` to enable genuine AI itinerary generation and real AI chat. Keep this key only in `.env`; never place it in HTML or browser JavaScript.
2. Run `npm.cmd install` once.
3. Double-click `start.bat`; it opens `http://localhost:3010` automatically. You can also run `npm.cmd start` manually.

Do not open `index.HTML` directly in the browser: the website needs its Node server for login, saved plans, weather, maps, trip generation, and AI chat. Without an API key it clearly labels the generated result and chat as basic guidance.

## Optional live travel pricing

For Amadeus hotel offers, create a free Amadeus for Developers account and add both `AMADEUS_CLIENT_ID` and `AMADEUS_CLIENT_SECRET` to `.env`. With a destination and dates selected, the hotel page requests current offers from Amadeus through the server; credentials never reach browser code. The free test environment is for development and uses limited data; production credentials are needed for complete supplier data.

The transport explorer also uses those Amadeus credentials for live flight-offer searches. Add `BREVO_API_KEY` and a verified `NOTIFICATION_FROM_EMAIL` to send booking confirmations and password-reset links through Brevo. Twilio credentials are optional and reserved for SMS once a phone number is collected at checkout. Never commit `.env`.

For deployment, set `NODE_ENV=production`, use a unique `JWT_SECRET`, set `APP_ORIGIN` to the public frontend URL, run behind HTTPS, and set a persistent database backup policy. Authentication is stored in an `HttpOnly`, `SameSite=Lax` session cookie; it is not stored in localStorage. Helmet sets defensive HTTP headers, while same-origin CORS blocks unapproved browser origins.

The SQLite database is created automatically at `data/ars.db`. Live weather comes from Open-Meteo; live attractions and hotels are sourced from OpenStreetMap's Overpass API.

## Account and discovery features

The site now includes a global discovery panel (continent, visa, budget, duration, traveller-style and accessibility/food filters), browser voice input, and an authenticated travel profile. Each account can save up to five adult/child/infant traveller profiles plus passport, visa, insurance, and vaccine-document metadata.

This is one self-contained Node project: it does not require a copied second website folder. If `data/ars.db` is removed, the server recreates an empty database on the next start. Do not store passport scans in this demo; only document metadata is supported. Google, Apple, Phone OTP and KYC scanning are intentionally not treated as real until their respective secure OAuth/OTP/KYC providers and server-side credentials are configured.
