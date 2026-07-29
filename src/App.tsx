import { Scene } from './components/Scene';
import { Dashboard } from './ui/Dashboard';
import { useResponsive } from './hooks/useResponsive';

export default function App() {
  useResponsive();

  return (
    <div className="app-shell">
      <Scene />
      <Dashboard />
    </div>
  );
}
