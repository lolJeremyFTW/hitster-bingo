import React, { useState, useEffect, useRef } from 'react';
import { Music, Plus, Trash2, Download, Upload, Save, Check, Disc, ExternalLink, Link as LinkIcon, FileText, Loader2, Sparkles, Layers, Terminal, LogIn, LogOut } from 'lucide-react';
import type { CustomPlaylist, CustomTrack, Language } from '../types/hitster';
import { getTranslation } from '../utils/translations';
import { parseBatchTracksText, fetchSpotifyPlaylistPublic, resolveTrackUrlsWithOEmbed, autoEnrichTracks } from '../utils/spotifyImporter';
import { resolveOriginalYears, needsYearCheck, rememberYear } from '../utils/yearResolver';
import { findHitsterPlaylists, type FoundPlaylist } from '../data/hitsterEditions';
import { initiateSpotifyLogin, isSpotifyAuthenticated, getStoredClientId, logoutSpotify, fetchPlaylistTracksWithOAuth, getRedirectUri, isLocalhostOrigin, fetchSpotifyProfile, matchTracksToSpotify, getValidAccessToken, extractPlaylistId } from '../utils/spotifyAuth';
import { loadActivePlaylist, loadPlaylists, upsertPlaylist, removePlaylist } from '../utils/playlistStore';

interface PlaylistStudioProps {
  language: Language;
  onClose: () => void;
  onSelectPlaylist?: (playlist: CustomPlaylist) => void;
}

export const PlaylistStudio: React.FC<PlaylistStudioProps> = ({
  language,
  onClose,
  onSelectPlaylist
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'spotify' | 'text'>('spotify');
  const [activePlaylist, setActivePlaylist] = useState<CustomPlaylist>({
    id: 'custom_1',
    name: 'Mijn Kampvuur Hitster Playlist',
    description: 'Aangepaste muzieklijst voor bingo',
    createdAt: new Date().toISOString(),
    tracks: [
      { id: 't1', title: 'Bohemian Rhapsody', artist: 'Queen', year: 1975, genre: 'Rock' },
      { id: 't2', title: 'Hotel California', artist: 'Eagles', year: 1976, genre: 'Rock' },
      { id: 't3', title: 'Africa', artist: 'Toto', year: 1982, genre: 'Pop' },
      { id: 't4', title: 'Piano Man', artist: 'Billy Joel', year: 1973, genre: 'Singer-Songwriter' },
      { id: 't5', title: 'Sweet Caroline', artist: 'Neil Diamond', year: 1969, genre: 'Pop' },
    ]
  });

  const [spotifyUrl, setSpotifyUrlInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [crawlerLogs, setCrawlerLogs] = useState<string[]>([]);
  const [liveTrackCount, setLiveTrackCount] = useState(0);

  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [importedCountInfo, setImportedCountInfo] = useState<string | null>(null);

  const [spotifyClientId, setSpotifyClientId] = useState(() => getStoredClientId());
  const [isLoggedIn, setIsLoggedIn] = useState(() => isSpotifyAuthenticated());
  const [spotifyProfile, setSpotifyProfile] = useState<{ displayName: string; isPremium: boolean } | null>(null);
  // MusicBrainz mag maar 1 request per seconde — bij grote lijsten wil je kunnen stoppen
  const cancelEnrichRef = useRef(false);

  // Officiële Hitster-edities, live opgezocht bij Spotify
  const [editions, setEditions] = useState<FoundPlaylist[] | null>(null);
  const [isSearchingEditions, setIsSearchingEditions] = useState(false);

  // De opgeslagen bibliotheek, om tussen lijsten te wisselen zonder her-import
  const [library, setLibrary] = useState<CustomPlaylist[]>([]);
  const refreshLibrary = () => setLibrary(loadPlaylists());

  const handleFindEditions = async () => {
    setIsSearchingEditions(true);
    setSpotifyError(null);
    setCrawlerLogs(['🔎 Officiële Hitster-edities zoeken op Spotify…']);
    try {
      const token = await getValidAccessToken();
      if (!token) {
        setSpotifyError(
          language === 'nl'
            ? '🔑 Log eerst in met Spotify om de officiële edities op te zoeken.'
            : '🔑 Log in with Spotify first to look up the official editions.'
        );
        setIsSearchingEditions(false);
        return;
      }
      const found = await findHitsterPlaylists(token, (msg) => {
        setCrawlerLogs(prev => [...prev.slice(-30), msg]);
      });
      setEditions(found);
    } catch (err: any) {
      setSpotifyError(`❌ ${err.message}`);
    }
    setIsSearchingEditions(false);
  };

  const [batchText, setBatchText] = useState('');

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState('');
  const [singleSpotifyUrl, setSingleSpotifyUrl] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    // Via de store: die herstelt ook ontbrekende spotifyUri's van oude imports
    const active = loadActivePlaylist();
    if (active) setActivePlaylist(active);
    refreshLibrary();
    // Check auth status on mount
    setIsLoggedIn(isSpotifyAuthenticated());
  }, []);

  /**
   * Alle gevonden officiële edities in één keer binnenhalen en opslaan.
   *
   * Bewust zónder MusicBrainz-controle: acht lijsten van honderden nummers zou
   * een half uur duren. De "Jaartallen controleren"-knop verschijnt vanzelf
   * zodra je een editie kiest om mee te spelen.
   */
  const handleImportAllEditions = async () => {
    if (!editions || editions.length === 0 || isImporting) return;
    setIsImporting(true);
    setSpotifyError(null);
    cancelEnrichRef.current = false;
    let geslaagd = 0;

    for (const ed of editions) {
      if (cancelEnrichRef.current) break;
      setCrawlerLogs(prev => [...prev.slice(-30), `⬇️ ${ed.emoji} ${ed.playlistName} importeren…`]);
      try {
        const result = await fetchPlaylistTracksWithOAuth(ed.url, (msg, count) => {
          setCrawlerLogs(prev => [...prev.slice(-30), msg]);
          if (count) setLiveTrackCount(count);
        });
        if (result && result.tracks.length > 0) {
          upsertPlaylist({
            id: `spotify_${ed.playlistId}`,
            name: `${ed.emoji} ${result.name || ed.playlistName}`,
            description: `Officiële editie (${result.tracks.length} nummers)`,
            createdAt: new Date().toISOString(),
            tracks: result.tracks,
          }, { makeActive: false });
          geslaagd++;
          refreshLibrary();
        }
      } catch (err: any) {
        setCrawlerLogs(prev => [...prev.slice(-30), `⚠️ ${ed.playlistName}: ${err.message}`]);
      }
    }

    setImportedCountInfo(
      language === 'nl'
        ? `📚 ${geslaagd} edities opgeslagen! Kies er hieronder één bij "Opgeslagen lijsten" om te spelen.`
        : `📚 Saved ${geslaagd} editions! Pick one under "Saved playlists" to play.`
    );
    setIsImporting(false);
  };

  // Premium bepaalt of de Web Playback SDK kan streamen — meteen laten zien,
  // zodat je niet pas tijdens het spelen ontdekt dat er geen geluid komt.
  useEffect(() => {
    if (!isLoggedIn) {
      setSpotifyProfile(null);
      return;
    }
    fetchSpotifyProfile().then(profile => {
      if (profile) {
        setSpotifyProfile({ displayName: profile.displayName, isPremium: profile.isPremium });
      }
    });
  }, [isLoggedIn]);

  const handleSpotifyLogin = async () => {
    if (!spotifyClientId.trim()) {
      setSpotifyError(
        language === 'nl'
          ? '🔑 Vul eerst je Spotify Client ID in!'
          : '🔑 Enter your Spotify Client ID first!'
      );
      return;
    }
    try {
      await initiateSpotifyLogin(spotifyClientId.trim());
    } catch (err: any) {
      setSpotifyError(`❌ ${err.message}`);
    }
  };

  const handleSpotifyLogout = () => {
    logoutSpotify();
    setIsLoggedIn(false);
  };

  const handleImportWithOAuth = async () => {
    if (!spotifyUrl.trim()) return;

    if (!isLoggedIn) {
      setSpotifyError(
        language === 'nl'
          ? '🔑 Log eerst in met Spotify!'
          : '🔑 Login with Spotify first!'
      );
      return;
    }

    setIsImporting(true);
    setSpotifyError(null);
    setImportedCountInfo(null);
    setCrawlerLogs(['🚀 Spotify API Import starten...']);
    setLiveTrackCount(0);

    try {
      const result = await fetchPlaylistTracksWithOAuth(
        spotifyUrl,
        (message, count) => {
          setCrawlerLogs(prev => [...prev.slice(-30), message]);
          setLiveTrackCount(count);
        }
      );

      if (result && result.tracks.length > 0) {
        const newPlaylist: CustomPlaylist = {
          // Stabiel id per bron-playlist: opnieuw importeren wérkt de opgeslagen
          // lijst bij in plaats van er een zoveelste kopie naast te zetten
          id: `spotify_${extractPlaylistId(spotifyUrl) ?? Date.now()}`,
          name: result.name || 'Spotify Playlist',
          description: `Spotify Import (${result.tracks.length} nummers)`,
          createdAt: new Date().toISOString(),
          tracks: result.tracks
        };

        setActivePlaylist(newPlaylist);
        if (onSelectPlaylist) {
          onSelectPlaylist(newPlaylist);
        }
        refreshLibrary();

        // Spotify geeft het albumjaar, en bij remasters/compilaties is dat het
        // verkeerde jaar. Meteen verifiëren bij MusicBrainz — voor Hitster is
        // het jaartal het hele spel.
        const corrected = await verifyYears(newPlaylist);
        setImportedCountInfo(
          language === 'nl'
            ? `🎉 ${result.tracks.length} nummers geïmporteerd uit "${result.name}"!` +
              (corrected > 0 ? ` ${corrected} jaartallen gecorrigeerd naar de originele release.` : '')
            : `🎉 Imported ${result.tracks.length} tracks from "${result.name}"!` +
              (corrected > 0 ? ` Corrected ${corrected} years to the original release.` : '')
        );
      } else {
        setSpotifyError(
          language === 'nl'
            ? '❌ Geen nummers gevonden. Controleer de playlist URL.'
            : '❌ No tracks found. Check the playlist URL.'
        );
      }
    } catch (err: any) {
      setSpotifyError(`❌ ${err.message || 'Import mislukt'}`);
    }

    setIsImporting(false);
  };

  const handleQuickImportEmbed = async () => {
    if (!spotifyUrl.trim()) return;

    setIsImporting(true);
    setSpotifyError(null);
    setImportedCountInfo(null);
    setCrawlerLogs(['🔓 Snel importeren zonder login (max ~100 nummers)...']);
    setLiveTrackCount(0);

    try {
      // First try server stream (local dev)
      let finalTracks: CustomTrack[] = [];
      try {
        const res = await fetch('/api/spotify-embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: spotifyUrl })
        });

        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const payload = JSON.parse(line.slice(6));
                  if (payload.message) {
                    setCrawlerLogs(prev => [...prev.slice(-30), payload.message]);
                    setLiveTrackCount(payload.count || 0);
                  }
                  if (payload.tracks && payload.tracks.length > 0) {
                    finalTracks = payload.tracks;
                  }
                } catch { /* continue */ }
              }
            }
          }
        }
      } catch {
        // Stream endpoint not available (e.g. Vercel static host)
      }

      // If server stream yielded 0 tracks, try client-side public embed fetcher
      if (finalTracks.length === 0) {
        setCrawlerLogs(prev => [...prev, '🌐 Publieke Spotify Embed ophalen via browser...']);
        const pubResult = await fetchSpotifyPlaylistPublic(spotifyUrl);
        if (pubResult && pubResult.tracks.length > 0) {
          finalTracks = pubResult.tracks;
          setLiveTrackCount(finalTracks.length);
        }
      }

      if (finalTracks.length > 0) {
        const newPlaylist: CustomPlaylist = {
          id: `embed_${extractPlaylistId(spotifyUrl) ?? Date.now()}`,
          name: 'Spotify Playlist',
          description: `Snel Geïmporteerd (${finalTracks.length} nummers)`,
          createdAt: new Date().toISOString(),
          tracks: finalTracks
        };
        setActivePlaylist(newPlaylist);
        if (onSelectPlaylist) {
          onSelectPlaylist(newPlaylist);
        }
        refreshLibrary();

        // Ook hier: remaster-jaren meteen rechtzetten
        const corrected = await verifyYears(newPlaylist);
        setImportedCountInfo(
          language === 'nl'
            ? `🎉 ${finalTracks.length} nummers geïmporteerd!` +
              (corrected > 0 ? ` ${corrected} jaartallen gecorrigeerd.` : '')
            : `🎉 Imported ${finalTracks.length} tracks!` +
              (corrected > 0 ? ` Corrected ${corrected} years.` : '')
        );
      } else {
        setSpotifyError(
          language === 'nl'
            ? '❌ Geen nummers gevonden in deze afspeellijst. Controleer of de afspeellijst openbaar is.'
            : '❌ No tracks found in this playlist. Please check if the playlist is public.'
        );
      }
    } catch (err: any) {
      setSpotifyError(`❌ ${err.message || 'Import mislukt'}`);
    }

    setIsImporting(false);
  };

  const handleImportBatchText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchText.trim()) return;

    let parsedTracks = parseBatchTracksText(batchText);
    if (parsedTracks.length > 0) {
      // Check if any tracks need URL resolving
      const needsResolving = parsedTracks.some(t => t.artist === 'Spotify Link' || t.artist === 'Spotify Track');
      if (needsResolving) {
        setIsImporting(true);
        parsedTracks = await resolveTrackUrlsWithOEmbed(parsedTracks);
        setIsImporting(false);
      }

      setActivePlaylist(prev => ({
        ...prev,
        tracks: [...parsedTracks, ...prev.tracks]
      }));
      setBatchText('');
      setActiveTab('single');

      // Auto-enrich in background for years & artist names
      setIsImporting(true);
      setCrawlerLogs(prev => [...prev, '✨ Jaartallen & artiesten automatisch ophalen...']);
      const enriched = await autoEnrichTracks(parsedTracks, (msg) => {
        setCrawlerLogs(prev => [...prev.slice(-30), msg]);
      });
      setActivePlaylist(prev => ({
        ...prev,
        tracks: prev.tracks.map(t => enriched.find(e => e.id === t.id) || t)
      }));
      setIsImporting(false);
    }
  };

  /**
   * Remaster-/compilatiejaren corrigeren naar de originele release en meteen
   * vastleggen. needsYearCheck slaat geverifieerde en handmatig gecorrigeerde
   * nummers over, dus dit is veilig om vaker te draaien.
   */
  const verifyYears = async (playlist: CustomPlaylist): Promise<number> => {
    cancelEnrichRef.current = false;
    const { tracks: fixed, correctedCount } = await resolveOriginalYears(
      playlist.tracks,
      (msg, done) => {
        setCrawlerLogs(prev => [...prev.slice(-30), msg]);
        if (done) setLiveTrackCount(done);
      },
      () => cancelEnrichRef.current
    );

    if (correctedCount > 0) {
      const fixedPlaylist = { ...playlist, tracks: fixed };
      setActivePlaylist(fixedPlaylist);
      onSelectPlaylist?.(fixedPlaylist);
      refreshLibrary();
    }
    return correctedCount;
  };

  /** Handmatige correctie wint altijd — de speler aan tafel weet het het best */
  const handleEditYear = (trackId: string, raw: string) => {
    const parsed = parseInt(raw, 10);
    const year = raw === '' || Number.isNaN(parsed) ? undefined : parsed;
    const track = activePlaylist.tracks.find(t => t.id === trackId);

    // Ook in de gedeelde jaartallen-cache: dan klopt dit nummer voortaan in
    // élke lijst waar het in voorkomt (rememberYear negeert halve invoer zelf)
    if (track && year) rememberYear(track.title, track.artist, year);

    const next: CustomPlaylist = {
      ...activePlaylist,
      tracks: activePlaylist.tracks.map(t =>
        t.id === trackId
          ? { ...t, year, yearSource: year ? ('manual' as const) : undefined }
          : t
      ),
    };
    setActivePlaylist(next);
    onSelectPlaylist?.(next);
  };

  /** Half ingetypte jaartallen (bv. "19") niet als echt jaar laten staan */
  const handleYearBlur = (trackId: string) => {
    const t = activePlaylist.tracks.find(tr => tr.id === trackId);
    if (t?.year && (t.year < 1900 || t.year > new Date().getFullYear())) {
      handleEditYear(trackId, '');
    }
  };

  const handleEnrichActivePlaylist = async () => {
    if (!activePlaylist || activePlaylist.tracks.length === 0) return;
    setIsImporting(true);
    cancelEnrichRef.current = false;
    setCrawlerLogs(['✨ Jaartallen & artiesten automatisch aanvullen...']);

    try {
      // Stap 1: ontbrekende titels/artiesten aanvullen (Spotify batch, dan iTunes)
      const enrichedTracks = await autoEnrichTracks(activePlaylist.tracks, (msg, count) => {
        setCrawlerLogs(prev => [...prev.slice(-30), msg]);
        if (count) setLiveTrackCount(count);
      });

      // Stap 2: tracks zonder Spotify-URI koppelen, anders kan de speler ze niet
      // afspelen (geldt voor geplakte lijsten en het standaard-deck)
      const { tracks: linkedTracks } = await matchTracksToSpotify(
        enrichedTracks,
        (msg, done) => {
          setCrawlerLogs(prev => [...prev.slice(-30), msg]);
          if (done) setLiveTrackCount(done);
        }
      );

      // Stap 3: jaartallen die van een compilatie of remaster komen corrigeren
      // naar de oorspronkelijke release. Voor Hitster is dat het hele spel.
      const { tracks: yearFixed, correctedCount } = await resolveOriginalYears(
        linkedTracks,
        (msg, done) => {
          setCrawlerLogs(prev => [...prev.slice(-30), msg]);
          if (done) setLiveTrackCount(done);
        },
        () => cancelEnrichRef.current
      );

      const updatedPlaylist = {
        ...activePlaylist,
        tracks: yearFixed
      };

      setActivePlaylist(updatedPlaylist);
      if (onSelectPlaylist) {
        onSelectPlaylist(updatedPlaylist);
      }
      setImportedCountInfo(
        language === 'nl'
          ? `✨ Afspeellijst aangevuld — ${correctedCount} jaartallen gecorrigeerd naar de originele release!`
          : `✨ Playlist enriched — ${correctedCount} years corrected to the original release!`
      );
    } catch (err: any) {
      setSpotifyError(`❌ ${err.message}`);
    }

    setIsImporting(false);
  };

  const handleAddSingleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) return;

    const newTrack: CustomTrack = {
      id: `track_${Date.now()}`,
      title: title.trim(),
      artist: artist.trim(),
      year: year ? parseInt(year, 10) : undefined,
      spotifyUrl: singleSpotifyUrl.trim() || undefined
    };

    setActivePlaylist(prev => ({
      ...prev,
      tracks: [newTrack, ...prev.tracks]
    }));

    setTitle('');
    setArtist('');
    setYear('');
    setSingleSpotifyUrl('');
  };

  const handleRemoveTrack = (id: string) => {
    setActivePlaylist(prev => ({
      ...prev,
      tracks: prev.tracks.filter(t => t.id !== id)
    }));
  };

  const handleSavePlaylist = () => {
    upsertPlaylist(activePlaylist);
    refreshLibrary();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);

    if (onSelectPlaylist) {
      onSelectPlaylist(activePlaylist);
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activePlaylist, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${activePlaylist.name.toLowerCase().replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.tracks && Array.isArray(parsed.tracks)) {
            setActivePlaylist(parsed);
          }
        } catch {
          alert('Invalid JSON playlist file.');
        }
      };
    }
  };

  const isNl = language === 'nl';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-5 sm:p-6 max-w-2xl w-full text-slate-100 shadow-2xl relative my-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-lg text-purple-200">
                {getTranslation(language, 'playlistStudioTitle')}
              </h2>
              <p className="text-xs text-slate-400">
                {isNl
                  ? 'Importeer jouw Spotify afspeellijst met live scraper logging!'
                  : 'Import your Spotify playlist with live scraper logging!'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-800 text-xs font-bold"
          >
            {getTranslation(language, 'close')}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('spotify')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'spotify'
                ? 'bg-green-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Spotify Link & Live Scraper</span>
          </button>

          <button
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'text'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Plak Tekstlijst</span>
          </button>

          <button
            onClick={() => setActiveTab('single')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'single'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Handmatig</span>
          </button>
        </div>

        {/* 1. Spotify OAuth Import */}
        {activeTab === 'spotify' && (
          <div className="bg-slate-950/90 p-4 rounded-2xl border border-green-500/30 mb-5 space-y-3">
            {/* Auth Status Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isLoggedIn ? 'bg-green-400' : 'bg-amber-400'} animate-pulse`} />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-green-300">
                  {isLoggedIn ? 'Spotify Verbonden ✓' : 'Spotify Koppelen'}
                </h3>
                {spotifyProfile && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      spotifyProfile.isPremium
                        ? 'bg-green-500/20 text-green-300 border-green-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                    title={
                      spotifyProfile.isPremium
                        ? 'Premium — hele nummers streamen werkt'
                        : 'Zonder Premium kan de browser geen nummers afspelen'
                    }
                  >
                    {spotifyProfile.isPremium ? 'Premium' : 'Geen Premium'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {liveTrackCount > 0 && (
                  <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/40">
                    ⚡ {liveTrackCount} nummers
                  </span>
                )}
                {isLoggedIn && (
                  <button
                    onClick={handleSpotifyLogout}
                    className="text-[10px] text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Uitloggen</span>
                  </button>
                )}
              </div>
            </div>

            {/* Playlist URL — always visible */}
            <input
              type="url"
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrlInput(e.target.value)}
              placeholder="https://open.spotify.com/playlist/5zSKBda7QTnWMHecVs20E3"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-green-500 font-mono"
            />

            {/* Import buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Quick Import — no login needed */}
              <button
                type="button"
                onClick={handleQuickImportEmbed}
                disabled={isImporting || !spotifyUrl.trim()}
                className="py-2.5 px-4 rounded-xl bg-amber-600 text-white font-extrabold text-xs uppercase tracking-wider hover:bg-amber-500 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/20"
              >
                {isImporting && !isLoggedIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Laden... ({liveTrackCount})</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {/* Levert alleen titels/artiesten, geen Spotify-URI's — dus niet afspeelbaar */}
                    <span>⚡ Snel (alleen lijst)</span>
                  </>
                )}
              </button>

              {/* Full Import — OAuth */}
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={handleImportWithOAuth}
                  disabled={isImporting || !spotifyUrl.trim()}
                  className="py-2.5 px-4 rounded-xl bg-green-600 text-white font-extrabold text-xs uppercase tracking-wider hover:bg-green-500 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-green-600/20"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Ophalen... ({liveTrackCount})</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>🎵 Alles + afspeelbaar</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSpotifyLogin}
                  className="py-2.5 px-4 rounded-xl bg-green-600/80 text-white font-extrabold text-xs uppercase tracking-wider hover:bg-green-500 transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-green-600/20"
                >
                  <LogIn className="w-4 h-4" />
                  <span>🔑 Login (800+)</span>
                </button>
              )}
            </div>

            {/* Kant-en-klare officiële edities */}
            {isLoggedIn && (
              <div className="p-3 rounded-xl bg-slate-900 border border-purple-500/25 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-purple-300">
                    {isNl ? 'Officiële Hitster-edities' : 'Official Hitster editions'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {editions && editions.length > 0 && (
                      <button
                        onClick={handleImportAllEditions}
                        disabled={isImporting || isSearchingEditions}
                        className="px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold text-[11px] flex items-center gap-1.5"
                      >
                        {isImporting
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Download className="w-3.5 h-3.5" />}
                        <span>{isNl ? 'Alles importeren' : 'Import all'}</span>
                      </button>
                    )}
                    <button
                      onClick={handleFindEditions}
                      disabled={isSearchingEditions || isImporting}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-[11px] flex items-center gap-1.5"
                    >
                      {isSearchingEditions
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Layers className="w-3.5 h-3.5" />}
                      <span>{isSearchingEditions ? (isNl ? 'Zoeken…' : 'Searching…') : (isNl ? 'Zoek edities' : 'Find editions')}</span>
                    </button>
                  </div>
                </div>

                {editions === null ? (
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {isNl
                      ? 'Zoekt de echte playlists van Hitster op Spotify op. Ze worden live opgezocht, niet uit een vaste lijst gehaald, zodat je nooit een dode link krijgt.'
                      : 'Looks up the real Hitster playlists on Spotify, live rather than from a fixed list.'}
                  </p>
                ) : editions.length === 0 ? (
                  <p className="text-[11px] text-amber-300 leading-relaxed">
                    {isNl
                      ? 'Geen officiële lijsten gevonden. Mogelijk zijn ze niet publiek doorzoekbaar met een app in Development Mode — plak dan gewoon de playlist-link hierboven.'
                      : 'No official lists found. Paste a playlist link above instead.'}
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {editions.map(ed => (
                      <button
                        key={ed.playlistId}
                        onClick={() => {
                          setSpotifyUrlInput(ed.url);
                          setCrawlerLogs([`🎵 "${ed.playlistName}" gekozen — klik op "Alles + afspeelbaar".`]);
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-purple-400 text-left transition-colors"
                      >
                        <span className="text-base shrink-0">{ed.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-bold text-slate-100 truncate">
                            {ed.playlistName}
                          </span>
                          <span className="block text-[10px] text-slate-500 truncate">
                            {ed.trackCount} {isNl ? 'nummers' : 'tracks'} · {ed.owner}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* OAuth Setup — collapsible, only if not logged in */}
            {!isLoggedIn && (
              <div className="p-3 rounded-xl bg-slate-900 border border-green-500/20 space-y-2">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isNl
                    ? 'Voor alle nummers: maak een gratis app op developer.spotify.com → kopieer Client ID → zet deze Redirect URI erin (exact, zonder slash op het eind):'
                    : 'For all tracks: create a free app at developer.spotify.com → copy Client ID → add this exact Redirect URI (no trailing slash):'}
                </p>
                <code className="block text-[10px] text-green-400 bg-slate-950 px-2 py-1 rounded font-mono select-all">
                  {getRedirectUri()}
                </code>

                {isLocalhostOrigin() && (
                  <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/40 rounded-lg px-2 py-1.5 leading-relaxed">
                    {isNl
                      ? `⚠️ Spotify accepteert "localhost" niet. Open de app op http://127.0.0.1:${window.location.port || '5173'} — anders mislukt het inloggen.`
                      : `⚠️ Spotify does not accept "localhost". Open the app on http://127.0.0.1:${window.location.port || '5173'} instead.`}
                  </p>
                )}

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {isNl
                    ? 'Zet in het dashboard ook je eigen Spotify-account onder "User Management" — apps in Development Mode laten alleen toegevoegde accounts toe.'
                    : 'Also add your own Spotify account under "User Management" — apps in Development Mode only allow listed accounts.'}
                </p>
                <input
                  type="text"
                  value={spotifyClientId}
                  onChange={(e) => setSpotifyClientId(e.target.value)}
                  placeholder="Spotify Client ID"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-green-500/40 text-xs font-mono text-green-300 focus:outline-none focus:border-green-400 placeholder-slate-600"
                />
                <a
                  href="https://developer.spotify.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-green-400 hover:text-green-300 font-bold"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Spotify Developer Dashboard →</span>
                </a>
              </div>
            )}

            {/* Live Terminal Console Log Box */}
            {(crawlerLogs.length > 0 || isImporting) && (
              <div className="p-3 rounded-xl bg-slate-950 border border-purple-500/40 text-left font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto animate-fade-in shadow-inner">
                <div className="flex items-center gap-1.5 text-purple-400 border-b border-slate-900 pb-1 mb-1 font-bold text-[10px] uppercase tracking-wider">
                  <Terminal className="w-3 h-3" />
                  <span>Import Log:</span>
                </div>
                {crawlerLogs.map((log, i) => (
                  <div key={i} className="text-slate-300 leading-tight">
                    {log}
                  </div>
                ))}
              </div>
            )}

            {spotifyError && (
              <p className="text-xs text-red-400 font-medium">{spotifyError}</p>
            )}
            {importedCountInfo && (
              <p className="text-xs text-green-300 font-bold">{importedCountInfo}</p>
            )}
          </div>
        )}

        {/* 2. Batch Text Paste Form */}
        {activeTab === 'text' && (
          <form onSubmit={handleImportBatchText} className="bg-slate-950/90 p-4 rounded-2xl border border-purple-500/30 mb-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Plak Tekstlijst:</span>
            </h3>
            <textarea
              rows={4}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder="Bohemian Rhapsody - Queen - 1975&#10;Hotel California - Eagles - 1976&#10;Africa - Toto - 1982"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
            />
            <button
              type="submit"
              disabled={!batchText.trim()}
              className="w-full py-2.5 rounded-xl bg-purple-600 text-white font-extrabold text-xs uppercase tracking-wider hover:bg-purple-500 disabled:opacity-40 transition-colors"
            >
              Nummers Toevoegen aan Afspeellijst
            </button>
          </form>
        )}

        {/* 3. Handmatig Form */}
        {activeTab === 'single' && (
          <form onSubmit={handleAddSingleTrack} className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 mb-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>{getTranslation(language, 'addTrack')}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={getTranslation(language, 'trackTitle')}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                required
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder={getTranslation(language, 'trackArtist')}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder={getTranslation(language, 'trackYear')}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={singleSpotifyUrl}
                onChange={(e) => setSingleSpotifyUrl(e.target.value)}
                placeholder={getTranslation(language, 'spotifyLink')}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span>{getTranslation(language, 'addTrack')}</span>
              </button>
            </div>
          </form>
        )}

        {/* Active Playlist Name */}
        <div className="mb-3">
          <input
            type="text"
            value={activePlaylist.name}
            onChange={(e) => setActivePlaylist({ ...activePlaylist, name: e.target.value })}
            className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 font-bold text-sm text-purple-300 focus:outline-none focus:border-purple-500"
            placeholder="Afspeellijst Naam"
          />
        </div>

        {/* Opgeslagen lijsten: één tik om van editie te wisselen, geen her-import */}
        {library.length > 0 && (
          <div className="mb-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1.5">
              {isNl ? `Opgeslagen lijsten (${library.length})` : `Saved playlists (${library.length})`}
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {library.map(p => {
                const isActive = p.id === activePlaylist.id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                      isActive
                        ? 'bg-green-500/10 border-green-500/40'
                        : 'bg-slate-950 border-slate-800 hover:border-purple-400'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setActivePlaylist(p);
                        onSelectPlaylist?.(p);
                        refreshLibrary();
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <span className={`block text-[11px] font-bold truncate ${isActive ? 'text-green-300' : 'text-slate-100'}`}>
                        {isActive ? '▶ ' : ''}{p.name}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        {p.tracks.length} {isNl ? 'nummers' : 'tracks'}
                        {isActive ? (isNl ? ' · actief in het spel' : ' · active in game') : ''}
                      </span>
                    </button>
                    {!isActive && (
                      <button
                        onClick={() => setLibrary(removePlaylist(p.id))}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                        title={isNl ? 'Verwijderen' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Track List */}
        <div className="max-h-52 overflow-y-auto pr-1 space-y-2 mb-5">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span>Nummers ({activePlaylist.tracks.length}):</span>
              {/* Ook zichtbaar bij een verdacht (remaster-)jaar, niet alleen als
                  het jaartal helemaal ontbreekt — fout is erger dan leeg */}
              {!isImporting && activePlaylist.tracks.some(t => needsYearCheck(t) || t.artist.includes('Spotify') || t.artist === 'Unknown Artist') && (
                <button
                  type="button"
                  onClick={handleEnrichActivePlaylist}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 text-[10px] font-extrabold flex items-center gap-1 transition-colors animate-pulse"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{language === 'nl' ? '✨ Jaartallen controleren' : '✨ Verify years'}</span>
                </button>
              )}
              {isImporting && (
                <button
                  type="button"
                  onClick={() => { cancelEnrichRef.current = true; }}
                  className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 text-[10px] font-extrabold flex items-center gap-1"
                >
                  <span>{language === 'nl' ? '⏹ Stop controle' : '⏹ Stop check'}</span>
                </button>
              )}
            </div>
            {activePlaylist.tracks.length >= 100 && (
              <span className="text-purple-400 font-extrabold">⚡ Grote Deck ({activePlaylist.tracks.length} nummers)</span>
            )}
          </div>
          {activePlaylist.tracks.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-6">
              {getTranslation(language, 'noTracksYet')}
            </p>
          ) : (
            activePlaylist.tracks.map((t, idx) => (
              <div
                key={t.id || idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Disc className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-200 truncate">{t.title}</div>
                    <div className="text-[11px] text-slate-400 truncate">{t.artist}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Jaartal direct aanpasbaar: de automaat zit er soms naast en
                      aan tafel weet iemand het altijd beter. Kleur = bron. */}
                  <input
                    type="number"
                    inputMode="numeric"
                    value={t.year ?? ''}
                    placeholder={language === 'nl' ? 'jaar' : 'year'}
                    onChange={(e) => handleEditYear(t.id, e.target.value)}
                    onBlur={() => handleYearBlur(t.id)}
                    title={
                      t.yearSource === 'musicbrainz'
                        ? (language === 'nl' ? 'Geverifieerd bij MusicBrainz (originele release)' : 'Verified via MusicBrainz (original release)')
                        : t.yearSource === 'manual'
                        ? (language === 'nl' ? 'Handmatig gecorrigeerd' : 'Manually corrected')
                        : (language === 'nl' ? 'Albumjaar van Spotify — kan een remaster zijn' : 'Spotify album year — may be a remaster')
                    }
                    className={`w-16 px-1.5 py-1 rounded-lg bg-slate-900 border text-center text-[11px] font-bold outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      t.yearSource === 'musicbrainz'
                        ? 'border-green-500/50 text-green-300 focus:border-green-400'
                        : t.yearSource === 'manual'
                        ? 'border-sky-500/50 text-sky-300 focus:border-sky-400'
                        : 'border-slate-700 text-amber-300 focus:border-amber-400'
                    }`}
                  />
                  {t.spotifyUrl && (
                    <a
                      href={t.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-slate-400 hover:text-green-400"
                      title="Open in Spotify"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => handleRemoveTrack(t.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
          <div className="flex gap-2">
            <button
              onClick={handleExportJSON}
              className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 flex items-center gap-1.5 border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{getTranslation(language, 'exportPlaylist')}</span>
            </button>

            <label className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 flex items-center gap-1.5 border border-slate-700 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{getTranslation(language, 'importPlaylist')}</span>
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
          </div>

          <button
            onClick={handleSavePlaylist}
            className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-extrabold text-xs uppercase tracking-wider hover:bg-purple-500 flex items-center gap-1.5 shadow-lg shadow-purple-600/30"
          >
            {savedSuccess ? <Check className="w-4 h-4 text-green-300" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? 'Opslagen!' : getTranslation(language, 'savePlaylist')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
