import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { useGameLoop } from './store/useGameLoop';
import { Sidebar } from './ui/Sidebar';
import { CombatPanel, LogPanels } from './ui/Combat';
import { Tabs } from './ui/Tabs';
import { SystemBar } from './ui/SystemBar';
import { TopBar } from './ui/TopBar';
import { ClassSelectionModal, PromotionModal, GameWonModal, OfflineModal, LrFlash } from './ui/Modals';
import { ItemTooltipLayer } from './ui/ItemTooltip';

export default function App() {
  const initialize = useGameStore((s) => s.initialize);
  useEffect(() => { void initialize(); }, [initialize]);
  useGameLoop();

  return (
    <div className="app-shell">
      <TopBar />
      <div className="main-container">
        <aside className="sidebar">
          <Sidebar />
          <SystemBar />
        </aside>
        <main className="main-content">
          <CombatPanel />
          <Tabs />
          <LogPanels />
        </main>
      </div>
      <ClassSelectionModal />
      <PromotionModal />
      <GameWonModal />
      <OfflineModal />
      <LrFlash />
      <ItemTooltipLayer />
    </div>
  );
}
