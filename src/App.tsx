import { useState, useMemo } from 'react';
import { useAudioContext } from './hooks/useAudioContext';
import { useSong } from './hooks/useSong';
import { useTransport } from './hooks/useTransport';
import { useGPU } from './hooks/useGPU';
import { Toolbar } from './ui/Toolbar';
import { SheetMusic } from './ui/SheetMusic';
import { MixerPanel } from './ui/MixerPanel';
import { VisualiserPanel } from './ui/VisualiserPanel';

const styles = {
  app: {
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    background: '#1a1a2e',
    color: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
    fontSize: '13px',
  } as React.CSSProperties,
  sheetArea: {
    flex: 1,
    overflow: 'hidden',
    borderTop: '1px solid #333',
    borderBottom: '1px solid #333',
    minHeight: 0,
  } as React.CSSProperties,
  bottomPanel: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    height: '200px',
    minHeight: '150px',
    borderTop: '1px solid #333',
  } as React.CSSProperties,
  errorBanner: {
    background: '#5c1a1a',
    color: '#ff8888',
    padding: '8px 16px',
    textAlign: 'center' as const,
    fontSize: '13px',
  } as React.CSSProperties,
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
    fontSize: '16px',
    flexDirection: 'column' as const,
    gap: '12px',
  } as React.CSSProperties,
};

function App() {
  const { audioContext, resume } = useAudioContext();
  const { song, loadFile, error } = useSong();
  const { gpuDevice, supported: gpuSupported } = useGPU();
  const [mixerCollapsed, setMixerCollapsed] = useState(false);

  const transport = useTransport(audioContext, song);

  const totalBars = useMemo(() => {
    if (!song || song.tracks.length === 0) return 0;
    return Math.max(...song.tracks.map(t => t.bars.length));
  }, [song]);

  const currentBarIndex = useMemo(() => {
    if (!song || song.tracks.length === 0) return 0;
    const bars = song.tracks[0].bars;
    if (bars.length === 0) return 0;
    // Binary search for the bar containing currentTick
    let lo = 0;
    let hi = bars.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (transport.currentTick < bars[mid].startTick) {
        hi = mid - 1;
      } else if (transport.currentTick >= bars[mid].endTick) {
        lo = mid + 1;
      } else {
        return mid;
      }
    }
    // Clamp to last bar if past end
    return Math.min(lo, bars.length - 1);
  }, [song, transport.currentTick]);

  const handlePlay = async () => {
    await resume();
    transport.play();
  };

  const handleFileOpen = async (file: File) => {
    await resume();
    await loadFile(file);
  };

  return (
    <div style={styles.app}>
      <Toolbar
        state={transport.state}
        onPlay={handlePlay}
        onPause={transport.pause}
        onStop={transport.stop}
        onFileOpen={handleFileOpen}
        tempoScale={transport.tempoScale}
        onTempoScaleChange={transport.setTempoScale}
        loopEnabled={transport.loopEnabled}
        loopStartBar={transport.loopStartBar}
        loopEndBar={transport.loopEndBar}
        onLoopChange={transport.setLoop}
        totalBars={totalBars}
        songName={song?.meta.name ?? null}
      />

      {error && <div style={styles.errorBanner}>{error}</div>}

      <div style={styles.sheetArea}>
        {song ? (
          <SheetMusic
            song={song}
            currentTick={transport.currentTick}
            currentBarIndex={currentBarIndex}
            onSeekToBar={transport.seekToBar}
            autoScroll={true}
          />
        ) : (
          <div style={styles.emptyState}>
            <div>Open a .mid file to get started</div>
            <div style={{ color: '#444', fontSize: '12px' }}>
              Supports Standard MIDI Format 0 and 1
            </div>
          </div>
        )}
      </div>

      <div style={{
        ...styles.bottomPanel,
        gridTemplateColumns: mixerCollapsed ? '40px 1fr' : '280px 1fr',
      }}>
        <MixerPanel
          tracks={song?.tracks ?? []}
          trackMixStates={transport.trackMixStates}
          onTrackGain={transport.setTrackGain}
          onTrackMute={transport.setTrackMute}
          onTrackSolo={transport.setTrackSolo}
          masterGain={transport.masterGain}
          onMasterGain={transport.setMasterGain}
          collapsed={mixerCollapsed}
          onToggleCollapse={() => setMixerCollapsed(!mixerCollapsed)}
        />
        <VisualiserPanel
          analyserNode={transport.analyserNode}
          gpuDevice={gpuDevice}
          gpuSupported={gpuSupported}
        />
      </div>
    </div>
  );
}

export default App;
