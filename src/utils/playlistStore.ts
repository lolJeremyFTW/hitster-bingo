/**
 * Eén plek voor het bewaren en terughalen van afspeellijsten.
 *
 * Waarom dit bestaat: importeren zette de lijst alleen in React-state, en de
 * app las localStorage bij het opstarten nooit terug. Elke refresh viel dus
 * terug op het ingebouwde deck — dat geen Spotify-koppelingen heeft — en dan
 * "moest" je opnieuw importeren terwijl je lijst er gewoon nog stond.
 */

import type { CustomPlaylist, CustomTrack } from '../types/hitster';

const PLAYLISTS_KEY = 'hitster_custom_playlists';
const ACTIVE_KEY = 'hitster_active_playlist_id';

/** Meer bewaren we niet; localStorage is klein en oude imports stapelen op */
const MAX_PLAYLISTS = 15;

/** Een echt Spotify track-ID: 22 tekens base62 */
const SPOTIFY_ID = /^[0-9A-Za-z]{22}$/;

/**
 * Vult ontbrekende spotifyUri's aan uit gegevens die er al zijn.
 *
 * Lijsten die vóór de importer-fix zijn opgeslagen hebben wel een spotifyUrl
 * (en meestal een echt Spotify-ID als id), maar niet de URI waar de speler om
 * vraagt. Die is er één-op-één uit af te leiden — dat scheelt een verplichte
 * her-import van elke oude lijst.
 *
 * Geeft exact dezelfde array terug als er niets te herstellen viel.
 */
export function healTrackUris(tracks: CustomTrack[]): CustomTrack[] {
  let changed = false;

  const healed = tracks.map(t => {
    if (t.spotifyUri) return t;

    const fromUrl = t.spotifyUrl?.match(/track[/:]([0-9A-Za-z]{22})/)?.[1];
    const id = fromUrl ?? (SPOTIFY_ID.test(t.id) ? t.id : null);
    if (!id) return t;

    changed = true;
    return { ...t, spotifyUri: `spotify:track:${id}` };
  });

  return changed ? healed : tracks;
}

/**
 * Alle opgeslagen lijsten, met zelfherstel van ontbrekende URI's.
 * Herstelde data wordt meteen teruggeschreven zodat het eenmalig is.
 */
export function loadPlaylists(): CustomPlaylist[] {
  let parsed: CustomPlaylist[];
  try {
    const raw = localStorage.getItem(PLAYLISTS_KEY);
    if (!raw) return [];
    parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
  } catch {
    return [];
  }

  let healedAny = false;
  const healed = parsed.map(p => {
    if (!Array.isArray(p?.tracks)) return p;
    const tracks = healTrackUris(p.tracks);
    if (tracks === p.tracks) return p;
    healedAny = true;
    return { ...p, tracks };
  });

  if (healedAny) {
    try {
      localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(healed));
    } catch {
      // Opslag vol — dan herstellen we de volgende keer gewoon opnieuw
    }
  }

  return healed;
}

/** Lijst opslaan of bijwerken (op id), en meteen als actief onthouden. */
export function upsertPlaylist(playlist: CustomPlaylist): CustomPlaylist[] {
  const rest = loadPlaylists().filter(p => p.id !== playlist.id);
  const updated = [playlist, ...rest].slice(0, MAX_PLAYLISTS);

  try {
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(updated));
    localStorage.setItem(ACTIVE_KEY, playlist.id);
  } catch {
    // Vol; de app blijft werken met wat er in het geheugen staat
  }

  return updated;
}

/**
 * De lijst waar het spel de vorige keer mee draaide. Valt terug op de nieuwste
 * opgeslagen lijst, zodat één keer importeren altijd blijft plakken.
 */
export function loadActivePlaylist(): CustomPlaylist | null {
  const playlists = loadPlaylists();
  if (playlists.length === 0) return null;

  const activeId = localStorage.getItem(ACTIVE_KEY);
  return playlists.find(p => p.id === activeId) ?? playlists[0];
}
