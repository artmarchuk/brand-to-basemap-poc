import { ZOOM_STOPS } from '../app/cities';

interface Props {
  zoom: number;
  reviewed: number[];
  sweeping: boolean;
  onStop: (zoom: number) => void;
  onSweep: () => void;
}

export function ZoomBar({ zoom, reviewed, sweeping, onStop, onSweep }: Props) {
  return (
    <div className="zoom-bar" role="group" aria-label="Zoom stops">
      {ZOOM_STOPS.map((stop) => (
        <button
          key={stop}
          type="button"
          className="chip"
          aria-pressed={Math.abs(zoom - stop) < 0.5}
          onClick={() => onStop(stop)}
        >
          <span className={reviewed.includes(stop) ? 'dot dot-reviewed' : 'dot'} aria-hidden="true" />
          <span>z{stop}</span>
          <span className="visually-hidden">{reviewed.includes(stop) ? ', reviewed' : ', not reviewed yet'}</span>
        </button>
      ))}
      <button type="button" className="button" onClick={onSweep}>{sweeping ? 'Stop sweep' : 'Sweep z4 to z16'}</button>
      <span className="value" aria-live="off">z{zoom.toFixed(1)}</span>
    </div>
  );
}
