import React, { useState, useEffect } from 'react';
import { Music, Plus, Trash2, Download, Upload, Save, Check, Disc, ExternalLink, Link as LinkIcon, FileText, Loader2, Sparkles, Layers, Terminal, LogIn, LogOut } from 'lucide-react';
import type { CustomPlaylist, CustomTrack, Language } from '../types/hitster';
import { getTranslation } from '../utils/translations';
import { parseBatchTracksText } from '../utils/spotifyImporter';
import { initiateSpotifyLogin, isSpotifyAuthenticated, getStoredClientId, logoutSpotify, fetchPlaylistTracksWithOAuth } from '../utils/spotifyAuth';

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
  const [playlists, setPlaylists] = useState<CustomPlaylist[]>([]);
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

  const [batchText, setBatchText] = useState('');

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState('');
  const [singleSpotifyUrl, setSingleSpotifyUrl] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const local = localStorage.getItem('hitster_custom_playlists');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        setPlaylists(parsed);
        if (parsed.length > 0) {
          setActivePlaylist(parsed[0]);
        }
      } catch {
        // Fallback
      }
    }
    // Check auth status on mount
    setIsLoggedIn(isSpotifyAuthenticated());
  }, []);

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
          id: `spotify_${Date.now()}`,
          name: result.name || 'Spotify Playlist',
          description: `Spotify Import (${result.tracks.length} nummers)`,
          createdAt: new Date().toISOString(),
          tracks: result.tracks
        };

        setActivePlaylist(newPlaylist);
        setSpotifyUrlInput('');
        setActiveTab('single');
        setImportedCountInfo(
          language === 'nl'
            ? `🎉 ${result.tracks.length} nummers geïmporteerd uit "${result.name}"!`
            : `🎉 ${result.tracks.length} tracks imported from "${result.name}"!`
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
      const res = await fetch('/api/spotify-embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: spotifyUrl })
      });

      if (!res.ok || !res.body) throw new Error(`Server status ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let finalTracks: CustomTrack[] = [];

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
              if (payload.isDone && finalTracks.length > 0) {
                const newPlaylist: CustomPlaylist = {
                  id: `embed_${Date.now()}`,
                  name: 'Spotify Playlist',
                  description: `Embed Import (${finalTracks.length} nummers, zonder login)`,
                  createdAt: new Date().toISOString(),
                  tracks: finalTracks
                };
                setActivePlaylist(newPlaylist);
                setSpotifyUrlInput('');
                setActiveTab('single');
                setImportedCountInfo(
                  language === 'nl'
                    ? `🎉 ${finalTracks.length} nummers geïmporteerd (zonder login)!`
                    : `🎉 ${finalTracks.length} tracks imported (no login)!`
                );
              }
            } catch {
              // continue
            }
          }
        }
      }

      if (finalTracks.length === 0) {
        setSpotifyError(
          language === 'nl'
            ? '❌ Geen nummers gevonden. Is de playlist openbaar? Probeer OAuth login.'
            : '❌ No tracks found. Is the playlist public? Try OAuth login.'
        );
      }
    } catch (err: any) {
      setSpotifyError(`❌ ${err.message || 'Import mislukt'}`);
    }

    setIsImporting(false);
  };

  const handleImportBatchText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchText.trim()) return;

    const parsedTracks = parseBatchTracksText(batchText);
    if (parsedTracks.length > 0) {
      setActivePlaylist(prev => ({
        ...prev,
        tracks: [...parsedTracks, ...prev.tracks]
      }));
      setBatchText('');
      setActiveTab('single');
    }
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
    const updated = [activePlaylist, ...playlists.filter(p => p.id !== activePlaylist.id)];
    setPlaylists(updated);
    localStorage.setItem('hitster_custom_playlists', JSON.stringify(updated));
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
                    <span>⚡ Snel (~100)</span>
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
                      <span>🎵 Alles (800+)</span>
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

            {/* OAuth Setup — collapsible, only if not logged in */}
            {!isLoggedIn && (
              <div className="p-3 rounded-xl bg-slate-900 border border-green-500/20 space-y-2">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isNl
                    ? 'Voor alle 800+ nummers: maak een gratis app op developer.spotify.com → kopieer Client ID → stel Redirect URI in:'
                    : 'For all 800+ tracks: create a free app at developer.spotify.com → copy Client ID → set Redirect URI:'}
                </p>
                <code className="block text-[10px] text-green-400 bg-slate-950 px-2 py-1 rounded font-mono select-all">
                  {window.location.origin}
                </code>
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

        {/* Track List */}
        <div className="max-h-52 overflow-y-auto pr-1 space-y-2 mb-5">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
            <span>Nummers in afspeellijst ({activePlaylist.tracks.length}):</span>
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
                <div className="flex items-center gap-2.5">
                  <Disc className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-slate-200">{t.title}</div>
                    <div className="text-[11px] text-slate-400">
                      {t.artist} {t.year ? `(${t.year})` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
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
