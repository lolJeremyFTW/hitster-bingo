/**
 * Spotify Web Playback SDK wrapper
 *
 * Waarom dit bestaat: sinds 27-11-2024 geeft Spotify geen `preview_url` meer
 * aan apps in Development Mode. De 30-seconden previews waar de oude speler op
 * leunde zijn dus altijd leeg. De Web Playback SDK is niet geblokkeerd en
 * streamt hele nummers — daar knippen we zelf een fragment uit.
 *
 * Vereist: Spotify Premium, en een browser met Widevine/EME (Chrome, Edge,
 * Firefox met DRM aan). Safari werkt, iOS Safari niet betrouwbaar.
 */

import { getValidAccessToken, getMissingScopes } from './spotifyAuth';

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';

// Minimale typedefs voor de global die het SDK-script neerzet
interface SpotifyPlayerInstance {
  connect(): Promise<boolean>;
  disconnect(): void;
  pause(): Promise<void>;
  resume(): Promise<void>;
  setVolume(v: number): Promise<void>;
  seek(ms: number): Promise<void>;
  activateElement(): Promise<void>;
  addListener(event: string, cb: (payload: any) => void): boolean;
  removeListener(event: string): boolean;
}

declare global {
  interface Window {
    Spotify?: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayerInstance;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

export type PlayerStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'no-premium'
  | 'auth-error'
  /** Token geldig, maar zonder de scopes die afspelen vereist — opnieuw inloggen */
  | 'scope-error'
  | 'error';

export interface PlayerEvents {
  onStatus?: (status: PlayerStatus, detail?: string) => void;
  /** Resterende seconden binnen het fragment, telt af naar 0 */
  onTick?: (secondsLeft: number) => void;
  onSnippetEnd?: () => void;
}

let sdkLoadPromise: Promise<void> | null = null;

/** Laadt het SDK-script één keer en wacht tot het zichzelf klaarmeldt. */
function loadSdkScript(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    if (window.Spotify) {
      resolve();
      return;
    }

    // De SDK roept deze global aan zodra hij klaar is
    window.onSpotifyWebPlaybackSDKReady = () => resolve();

    const existing = document.querySelector(`script[src="${SDK_SRC}"]`);
    if (existing) return; // script laadt al, we wachten op de callback

    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onerror = () => reject(new Error('Kon de Spotify Web Playback SDK niet laden.'));
    document.body.appendChild(script);
  });

  return sdkLoadPromise;
}

/**
 * Eén speler per pagina. De SDK registreert een "device" bij Spotify; meerdere
 * instanties leveren spookapparaten op waar Spotify naartoe kan routeren.
 */
class SpotifySnippetPlayer {
  private player: SpotifyPlayerInstance | null = null;
  private deviceId: string | null = null;
  private events: PlayerEvents = {};
  private status: PlayerStatus = 'idle';

  private snippetTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  setEvents(events: PlayerEvents) {
    this.events = events;
  }

  getStatus(): PlayerStatus {
    return this.status;
  }

  isReady(): boolean {
    return this.status === 'ready' && !!this.deviceId;
  }

  private setStatus(status: PlayerStatus, detail?: string) {
    this.status = status;
    this.events.onStatus?.(status, detail);
  }

  /**
   * Verbindt met Spotify. Moet vanuit een user gesture komen (klik), anders
   * blokkeert de browser het audio-element dat de SDK aanmaakt.
   */
  async connect(): Promise<boolean> {
    if (this.isReady()) return true;

    this.setStatus('loading');

    const token = await getValidAccessToken();
    if (!token) {
      this.setStatus('auth-error', 'Niet ingelogd bij Spotify.');
      return false;
    }

    // Vooraf checken scheelt een mislukte SDK-verbinding en een 401 verderop
    const missing = getMissingScopes();
    if (missing.length > 0) {
      this.setStatus(
        'scope-error',
        'Je Spotify-sessie mist rechten om af te spelen. Log uit en opnieuw in ' +
        `met Spotify. (ontbreekt: ${missing.join(', ')})`
      );
      return false;
    }

    try {
      await loadSdkScript();
    } catch (err: any) {
      this.setStatus('error', err.message);
      return false;
    }

    if (!window.Spotify) {
      this.setStatus('error', 'Spotify SDK niet beschikbaar.');
      return false;
    }

    return new Promise<boolean>((resolve) => {
      const player = new window.Spotify!.Player({
        name: 'Hitster Bingo',
        // Wordt ook bij token-refresh aangeroepen, dus altijd vers ophalen
        getOAuthToken: (cb) => {
          getValidAccessToken().then(t => t && cb(t));
        },
        volume: 0.8,
      });

      this.player = player;

      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        this.deviceId = device_id;
        this.setStatus('ready');
        resolve(true);
      });

      player.addListener('not_ready', () => {
        this.deviceId = null;
        this.setStatus('error', 'Speler offline geraakt.');
      });

      player.addListener('initialization_error', ({ message }: { message: string }) => {
        this.setStatus('error', `Initialisatie mislukt: ${message}`);
        resolve(false);
      });

      player.addListener('authentication_error', ({ message }: { message: string }) => {
        this.setStatus('auth-error', `Authenticatie mislukt: ${message}`);
        resolve(false);
      });

      // Komt binnen als het account geen Premium heeft — de SDK weigert dan
      player.addListener('account_error', () => {
        this.setStatus(
          'no-premium',
          'Spotify Premium is vereist om nummers in de browser af te spelen.'
        );
        resolve(false);
      });

      player.addListener('playback_error', ({ message }: { message: string }) => {
        console.warn('[Spotify Player] Playback error:', message);
      });

      player.connect().then((ok) => {
        if (!ok) {
          this.setStatus('error', 'Verbinden met Spotify mislukt.');
          resolve(false);
        }
      });
    });
  }

  /**
   * Speelt `durationSec` seconden van een track en pauzeert daarna.
   *
   * startAtMs: waar in het nummer het fragment begint. 0 = vanaf het begin.
   */
  async playSnippet(
    trackUri: string,
    durationSec = 25,
    startAtMs = 0
  ): Promise<void> {
    this.clearTimers();

    if (!this.isReady()) {
      const ok = await this.connect();
      if (!ok) return;
    }

    const token = await getValidAccessToken();
    if (!token || !this.deviceId) return;

    // Nodig op mobiel/Safari: koppelt het audio-element aan de user gesture
    try {
      await this.player?.activateElement();
    } catch {
      // Niet fataal — desktop Chrome heeft dit niet nodig
    }

    const res = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: [trackUri], position_ms: startAtMs }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');

      // 401 "Permissions missing" = het token is uitgegeven vóór de scopes
      // werden uitgebreid. Refreshen lost dat niet op; alleen opnieuw
      // autoriseren wel.
      if (res.status === 401) {
        this.setStatus(
          'scope-error',
          'Je Spotify-sessie mist de rechten om af te spelen. Klik op "Uitloggen" ' +
          'in de Afspeellijst Studio en log opnieuw in met Spotify — dan wordt ' +
          'toestemming voor afspelen meteen meegevraagd.'
        );
      } else if (res.status === 403) {
        this.setStatus(
          'no-premium',
          'Afspelen geweigerd (403). Dit vereist Spotify Premium.'
        );
      } else if (res.status === 404) {
        this.setStatus('error', 'Speler niet gevonden. Probeer opnieuw te verbinden.');
        this.deviceId = null;
      } else {
        this.setStatus('error', `Afspelen mislukt (${res.status}). ${errText}`);
      }
      return;
    }

    // Aftellen en na afloop pauzeren
    let secondsLeft = durationSec;
    this.events.onTick?.(secondsLeft);

    this.tickTimer = setInterval(() => {
      secondsLeft -= 1;
      this.events.onTick?.(Math.max(0, secondsLeft));
    }, 1000);

    this.snippetTimer = setTimeout(() => {
      this.pause();
      this.events.onSnippetEnd?.();
    }, durationSec * 1000);
  }

  async pause(): Promise<void> {
    this.clearTimers();
    try {
      await this.player?.pause();
    } catch {
      // speler al weg
    }
  }

  async resume(): Promise<void> {
    try {
      await this.player?.resume();
    } catch {
      // speler al weg
    }
  }

  async setVolume(v: number): Promise<void> {
    try {
      await this.player?.setVolume(Math.min(1, Math.max(0, v)));
    } catch {
      // speler al weg
    }
  }

  private clearTimers() {
    if (this.snippetTimer) {
      clearTimeout(this.snippetTimer);
      this.snippetTimer = null;
    }
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  disconnect() {
    this.clearTimers();
    this.player?.disconnect();
    this.player = null;
    this.deviceId = null;
    this.setStatus('idle');
  }
}

export const spotifyPlayer = new SpotifySnippetPlayer();
