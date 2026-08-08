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
  /**
   * De speler stond nog niet klaar toen er getikt werd, dus de browser heeft het
   * audio-element niet ontgrendeld. Eén keer opnieuw tikken lost dit op.
   */
  | 'needs-gesture'
  | 'error';

/** Een toestel waar Spotify Connect naartoe kan streamen */
export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isRestricted: boolean;
}

/** Onthoudt de gekozen speaker, zodat je niet elke ronde opnieuw moet kiezen */
const TARGET_DEVICE_KEY = 'hitster_sp_target_device';

/**
 * iOS Safari speelt via de Web Playback SDK niet betrouwbaar af: de browser
 * geeft het audio-element vaak niet vrij, hoe netjes je de user gesture ook
 * afhandelt. Op zo'n toestel is Spotify Connect de enige route die werkt.
 */
export function isIosLikeDevice(): boolean {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS meldt zich als macOS, maar heeft wel touch
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * Toestellen waar deze Spotify-account naartoe kan streamen: de telefoon-app,
 * een laptop, een speaker. Alleen zichtbaar als de Spotify-app daar recent
 * actief is geweest.
 */
export async function fetchSpotifyDevices(): Promise<SpotifyDevice[]> {
  const token = await getValidAccessToken();
  if (!token) return [];

  const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.devices ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    isActive: !!d.is_active,
    isRestricted: !!d.is_restricted,
  }));
}

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

  /** Heeft de browser het audio-element van de SDK vrijgegeven? */
  private audioUnlocked = false;
  /** Lopende activateElement()-poging, zodat playSnippet erop kan wachten */
  private activation: Promise<void> | null = null;

  /**
   * Extern toestel waar we naartoe streamen (Spotify Connect). Is dit gezet,
   * dan slaan we de Web Playback SDK volledig over — dat is de enige manier om
   * op een iPhone geluid te krijgen.
   */
  private targetDeviceId: string | null =
    typeof localStorage !== 'undefined' ? localStorage.getItem(TARGET_DEVICE_KEY) : null;

  setEvents(events: PlayerEvents) {
    this.events = events;
  }

  /** `null` = in deze browser afspelen via de SDK */
  setTargetDevice(deviceId: string | null) {
    this.targetDeviceId = deviceId;
    if (deviceId) {
      localStorage.setItem(TARGET_DEVICE_KEY, deviceId);
      // De ingebouwde speler is nu overbodig en zou alleen als spookapparaat
      // in Spotify blijven staan
      this.player?.disconnect();
      this.player = null;
      this.deviceId = null;
      this.audioUnlocked = false;
      this.setStatus('ready');
    } else {
      localStorage.removeItem(TARGET_DEVICE_KEY);
      this.setStatus('idle');
    }
  }

  getTargetDevice(): string | null {
    return this.targetDeviceId;
  }

  /** Speelt af via een extern toestel in plaats van in deze browser */
  private usingConnectDevice(): boolean {
    return !!this.targetDeviceId;
  }

  /**
   * Ontgrendelt het audio-element van de SDK.
   *
   * MOET synchroon vanuit de klik-handler worden aangeroepen, vóór elke `await`.
   * Mobiele browsers (iOS Safari voorop) staan afspelen alleen toe zolang de tik
   * "vers" is; na een netwerkrondje is dat venster dicht en blijft de telefoon
   * stil terwijl Spotify's API gewoon 204 teruggeeft.
   *
   * Fire-and-forget: de aanroep moet starten binnen de gesture, het resultaat
   * mag daarna binnenkomen.
   */
  activateFromGesture(): void {
    if (this.audioUnlocked || !this.player) return;

    this.activation = this.player
      .activateElement()
      .then(() => { this.audioUnlocked = true; })
      .catch(() => { this.audioUnlocked = false; });
  }

  /**
   * Verbindt alvast, zonder af te spelen.
   *
   * Zonder dit bestaat de speler nog niet op het moment dat iemand op play tikt,
   * en valt er dus niets te ontgrendelen — precies de reden dat de eerste tik op
   * een telefoon stil bleef.
   */
  prewarm(): void {
    // Extern toestel doet het werk; een SDK-speler zou alleen in de weg zitten
    if (this.usingConnectDevice()) return;
    if (this.status === 'loading' || this.isReady()) return;
    void this.connect();
  }

  getStatus(): PlayerStatus {
    return this.status;
  }

  isReady(): boolean {
    // Bij een extern toestel is er niets te verbinden: de Spotify-app daar is
    // de speler, wij sturen alleen commando's
    if (this.usingConnectDevice()) return true;
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
      // Zonder vangnet blijft de knop eeuwig op "Verbinden…" staan als de SDK
      // nooit een 'ready' of een fout stuurt (komt voor op flaky mobiel netwerk)
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimeout);
        resolve(ok);
      };

      const connectTimeout = setTimeout(() => {
        if (this.status === 'loading') {
          this.setStatus('error', 'Verbinden met Spotify duurde te lang. Probeer opnieuw.');
        }
        finish(false);
      }, 20_000);

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
        finish(true);
      });

      player.addListener('not_ready', () => {
        this.deviceId = null;
        this.setStatus('error', 'Speler offline geraakt.');
      });

      player.addListener('initialization_error', ({ message }: { message: string }) => {
        this.setStatus('error', `Initialisatie mislukt: ${message}`);
        finish(false);
      });

      player.addListener('authentication_error', ({ message }: { message: string }) => {
        this.setStatus('auth-error', `Authenticatie mislukt: ${message}`);
        finish(false);
      });

      // Komt binnen als het account geen Premium heeft — de SDK weigert dan.
      // Let op: "mobile only"-Premium telt voor Spotify niet mee voor de SDK.
      player.addListener('account_error', () => {
        this.setStatus(
          'no-premium',
          'Spotify Premium is vereist om nummers in de browser af te spelen. ' +
          'Let op: een "mobile only"-abonnement wordt door Spotify niet geaccepteerd.'
        );
        finish(false);
      });

      player.addListener('playback_error', ({ message }: { message: string }) => {
        console.warn('[Spotify Player] Playback error:', message);
      });

      player.connect().then((ok) => {
        if (!ok) {
          this.setStatus('error', 'Verbinden met Spotify mislukt.');
          finish(false);
        }
      });
    });
  }

  /**
   * Speelt `durationSec` seconden van een track en pauzeert daarna.
   *
   * startAtMs: waar in het nummer het fragment begint. 0 = vanaf het begin.
   *
   * Roep dit aan vanuit een klik-handler, en zet `spotifyPlayer.activateFromGesture()`
   * als eerste regel in die handler. Geeft `false` terug als er niets is gaan
   * spelen, zodat de UI niet blijft hangen op "speelt af".
   */
  async playSnippet(
    trackUri: string,
    durationSec = 25,
    startAtMs = 0
  ): Promise<boolean> {
    this.clearTimers();

    // Extern toestel: geen SDK, geen browser-audio, geen gesture-gedoe
    if (this.usingConnectDevice()) {
      const ok = await this.sendPlay(this.targetDeviceId!, trackUri, startAtMs);
      if (ok) this.startSnippetTimers(durationSec);
      return ok;
    }

    // Vangnet voor het geval de aanroeper dit vergeet. Werkt alleen als de
    // speler al bestaat — vandaar prewarm() bij het openen van het spel.
    this.activateFromGesture();

    if (!this.isReady()) {
      const ok = await this.connect();
      if (!ok) return false;

      // De speler bestond nog niet tijdens de tik, dus er viel niets te
      // ontgrendelen. Nu wel proberen, maar de gesture is verlopen: op mobiel
      // faalt dit en moet de gebruiker gewoon nog een keer tikken.
      this.activateFromGesture();
    }

    // Niet onbeperkt wachten: een activateElement() die nooit resolvet mag de
    // knop niet opnieuw laten vastlopen op "speelt af"
    if (this.activation) {
      await Promise.race([
        this.activation,
        new Promise<void>(r => setTimeout(r, 3000)),
      ]);
    }

    if (!this.audioUnlocked) {
      this.setStatus(
        'needs-gesture',
        'De speler is nu verbonden. Tik nog één keer op afspelen — je telefoon ' +
        'geeft het geluid pas vrij bij een tik op een speler die al klaarstaat.'
      );
      return false;
    }

    if (!this.deviceId) {
      this.setStatus('error', 'Speler niet gevonden. Probeer opnieuw te verbinden.');
      return false;
    }

    const ok = await this.sendPlay(this.deviceId, trackUri, startAtMs);
    if (ok) this.startSnippetTimers(durationSec);
    return ok;
  }

  /**
   * Stuurt het afspeelcommando naar een toestel — de ingebouwde SDK-speler of
   * een extern Spotify Connect-toestel. Beide gaan via dezelfde Web API.
   */
  private async sendPlay(
    deviceId: string,
    trackUri: string,
    startAtMs: number
  ): Promise<boolean> {
    const token = await getValidAccessToken();
    if (!token) {
      this.setStatus('auth-error', 'Geen geldige Spotify-sessie op dit toestel.');
      return false;
    }

    const res = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: [trackUri], position_ms: startAtMs }),
      }
    );

    if (res.ok) {
      // Gelukt — een eerdere foutmelding mag weg
      if (this.status !== 'ready') this.setStatus('ready');
      return true;
    }

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
      // Bij een extern toestel betekent dit bijna altijd: de Spotify-app is in
      // slaap gevallen en meldt zich niet meer als beschikbaar apparaat
      if (this.usingConnectDevice()) {
        this.setStatus(
          'error',
          'De gekozen speaker reageert niet meer. Open de Spotify-app op dat ' +
          'toestel, speel daar één seconde iets af, en kies hem hier opnieuw.'
        );
      } else {
        this.setStatus('error', 'Speler niet gevonden. Probeer opnieuw te verbinden.');
        this.deviceId = null;
      }
    } else {
      this.setStatus('error', `Afspelen mislukt (${res.status}). ${errText}`);
    }

    return false;
  }

  /** Aftellen en na `durationSec` automatisch pauzeren */
  private startSnippetTimers(durationSec: number) {
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

    if (this.usingConnectDevice()) {
      const token = await getValidAccessToken();
      if (!token) return;
      await fetch(
        `https://api.spotify.com/v1/me/player/pause?device_id=${this.targetDeviceId}`,
        { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }
      ).catch(() => {
        // Al gepauzeerd of toestel weg — niets aan de hand
      });
      return;
    }

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
    // Nieuwe speler = nieuw audio-element, dus opnieuw ontgrendelen
    this.audioUnlocked = false;
    this.activation = null;
    this.setStatus('idle');
  }
}

export const spotifyPlayer = new SpotifySnippetPlayer();
