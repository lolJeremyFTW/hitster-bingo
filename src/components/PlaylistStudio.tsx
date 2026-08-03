import React, { useState, useEffect } from 'react';
import { Music, Plus, Trash2, Download, Upload, Save, Check, Disc, ExternalLink, Link as LinkIcon, FileText, Loader2, Sparkles } from 'lucide-react';
import type { CustomPlaylist, CustomTrack, Language } from '../types/hitster';
import { getTranslation } from '../utils/translations';
import { fetchSpotifyPlaylistPublic, parseBatchTracksText } from '../utils/spotifyImporter';

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

  // Spotify Import State
  const [spotifyUrl, setSpotifyUrlInput] = useState('');
  const [isImportingSpotify, setIsImportingSpotify] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);

  // Batch Text State
  const [batchText, setBatchText] = useState('');

  // Single Track Inputs
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
  }, []);

  // 1. Spotify URL Import
  const handleImportSpotify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spotifyUrl.trim()) return;

    setIsImportingSpotify(true);
    setSpotifyError(null);

    const result = await fetchSpotifyPlaylistPublic(spotifyUrl);
    setIsImportingSpotify(false);

    if (result && result.tracks.length > 0) {
      const newPlaylist: CustomPlaylist = {
        id: `spotify_${Date.now()}`,
        name: result.name || 'Spotify Playlist',
        description: `Geïmporteerd uit Spotify (${result.tracks.length} nummers)`,
        createdAt: new Date().toISOString(),
        tracks: result.tracks
      };

      setActivePlaylist(newPlaylist);
      setSpotifyUrlInput('');
      setActiveTab('single');
    } else {
      setSpotifyError(
        language === 'nl'
          ? 'Kon geen nummers ophalen. Controleer of de Spotify afspeellijst openbaar is.'
          : 'Could not fetch tracks. Please check if the Spotify playlist is public.'
      );
    }
  };

  // 2. Batch Text Import
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

  // 3. Add Single Track
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
                {language === 'nl'
                  ? 'Maak of importeer direct jouw Spotify afspeellijst voor Hitster Bingo!'
                  : 'Import your Spotify playlist directly or build custom song lists!'}
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
            <span>Spotify Link Import</span>
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

        {/* 1. Spotify URL Import Form */}
        {activeTab === 'spotify' && (
          <form onSubmit={handleImportSpotify} className="bg-slate-950/90 p-4 rounded-2xl border border-green-500/30 mb-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-green-300">
                Plak je Spotify Afspeellijst Link:
              </h3>
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                required
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrlInput(e.target.value)}
                placeholder="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-green-500 font-mono"
              />
              <button
                type="submit"
                disabled={isImportingSpotify || !spotifyUrl.trim()}
                className="px-5 py-2.5 rounded-xl bg-green-600 text-white font-extrabold text-xs uppercase tracking-wider hover:bg-green-500 disabled:opacity-40 transition-colors flex items-center gap-1.5 shadow-lg shadow-green-600/20"
              >
                {isImportingSpotify ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Laden...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Importeren</span>
                  </>
                )}
              </button>
            </div>
            {spotifyError && (
              <p className="text-xs text-red-400 font-medium">{spotifyError}</p>
            )}
          </form>
        )}

        {/* 2. Batch Text Paste Form */}
        {activeTab === 'text' && (
          <form onSubmit={handleImportBatchText} className="bg-slate-950/90 p-4 rounded-2xl border border-purple-500/30 mb-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-300">
              Plak nummers (bijv. "Nummer - Artiest - 1984"):
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
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
            Nummers in afspeellijst ({activePlaylist.tracks.length}):
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
