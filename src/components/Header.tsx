import { CompareIcon, GridIcon, HelpIcon, MapIcon } from './icons';
import type { View } from '../types';

interface Props {
  view: View;
  onNavigate: (v: View) => void;
  onHelp: () => void;
  compareCount: number;
}

export function Header({ view, onNavigate, onHelp, compareCount }: Props) {
  return (
    <header className="app-header">
      <div className="brand">
        {/* Text placeholder for the Lenovo wordmark — swap for the official asset. */}
        <span className="logo-mark">Lenovo</span>
        <span className="brand-title">CAE 材料資料庫</span>
      </div>
      <nav className="main-nav" aria-label="主選單">
        <button className={view === 'materials' ? 'active' : ''} onClick={() => onNavigate('materials')}>
          <GridIcon /> 材料列表
        </button>
        <button className={view === 'map' ? 'active' : ''} onClick={() => onNavigate('map')}>
          <MapIcon /> 材料地圖
        </button>
        <button className={view === 'compare' ? 'active' : ''} onClick={() => onNavigate('compare')}>
          <CompareIcon /> 材料比較{compareCount > 0 && <span className="nav-count">{compareCount}</span>}
        </button>
        <button onClick={onHelp}>
          <HelpIcon /> 使用說明
        </button>
      </nav>
    </header>
  );
}
