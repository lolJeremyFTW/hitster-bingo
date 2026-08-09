# Hitster Bingo — Kampvuur Editie ⛺🎶

Digitale Hitster voor aan tafel: één laptop is de DJ, iedereen speelt mee op z'n
eigen telefoon. Twee spelvormen:

- **Klassieke Hitster (tijdlijn)** — luister naar een fragment, leg de kaart
  blind op de juiste plek in je tijdlijn, roep HITSTER om andermans kaart te
  stelen. Eerste met 10 kaarten wint.
- **Hitster Bingo** — bingokaarten op je telefoon bij je fysieke Hitster-kaarten
  of een Spotify-afspeellijst.

## Hoe het speelt (klassiek)

De **host runt de tafel**: die importeert de afspeellijst, trekt élke kaart (ook
voor andermans beurt), speelt de fragmenten af, draait de kaart om en start de
volgende beurt. De andere telefoons zijn puur speelbord: kaart plaatsen, stelen
door in de tijdlijn te tikken, meekijken. Kaarten tonen alleen het jaartal —
tik op een kaart voor titel en artiest.

Dit is een bewuste keuze, geen beperking: de afspeellijst leeft in de browser
van de host, en iOS Safari speelt de Spotify Web Playback SDK niet betrouwbaar
af. Wil je het geluid uit een telefoon of speaker laten komen, kies die dan als
speaker via **Spotify Connect** (speakerkeuze in het klassieke scherm).

## Opzetten

1. **Supabase** (multiplayer-kamers): maak een project, draai
   `supabase/migrations/001_hitster.sql` in de SQL Editor en zet het schema
   `hitster` bij *Settings → API → Exposed schemas*. Vul de URL en anon key in
   waar `supabaseClient.ts` ze verwacht.
2. **Spotify**: er zit een Client ID ingebakken, dus inloggen is één klik. De
   bijbehorende app staat in Development Mode — voeg elk Spotify-account dat
   moet kunnen inloggen toe onder *User Management* in het
   [developer dashboard](https://developer.spotify.com/dashboard). Eigen app
   gebruiken kan ook: klap in de Afspeellijst Studio "Eigen Spotify-app
   gebruiken" open. Afspelen in de browser vereist **Spotify Premium** (geen
   "mobile only"-abonnement).
3. **Afspeellijst**: Studio → Login met Spotify → plak een playlist-link of
   importeer alle officiële Hitster-edities in één keer. Jaartallen worden
   automatisch geverifieerd bij MusicBrainz (Spotify geeft remaster-jaren);
   corrigeer ze desnoods met de hand per nummer — dat wordt onthouden voor alle
   lijsten.

## Ontwikkelen

```bash
npm install
npm run dev        # draait op http://127.0.0.1:5173
```

Open de app op **127.0.0.1**, niet op `localhost` — Spotify weigert `localhost`
als redirect URI. Voor Spotify-login tijdens lokaal ontwikkelen moet
`http://127.0.0.1:5173` als redirect URI in het dashboard staan.

`npm run build` bouwt (met typecheck), `npm run lint` draait oxlint. Elke push
naar `main` deployt automatisch via Vercel.

## Goed om te weten

- Sinds 27-11-2024 geeft Spotify geen `preview_url` meer aan apps in
  Development Mode; audio loopt daarom via de Web Playback SDK of Spotify
  Connect, en elk nummer heeft een `spotifyUri` nodig om af te spelen.
- Spotify's eigen (editorial/algoritmische) playlists geven 404 voor
  dev-mode apps — kopieer zo'n lijst eerst naar een eigen playlist.
- Een telefoon die midden in het spel ververst, stapt automatisch terug in de
  kamer als dezelfde speler; opnieuw joinen met dezelfde naam neemt die speler
  ook over.
