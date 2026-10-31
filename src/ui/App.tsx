import { MapPreview } from './MapPreview';

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Brand-to-Basemap</h1>
        <p className="app-subtitle">Setup preview: stack and UI tokens</p>
      </header>
      <main className="app-map">
        <MapPreview />
      </main>
    </div>
  );
}
