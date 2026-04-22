import { navigateTo } from '../utils/url';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.fuelsaver.gasprices.stationfinder';
const APP_STORE_URL = 'https://apps.apple.com/fr/app/fuelsaver-cheap-gas-sation/id6761938959';
const PLAY_BADGE = 'https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg';
const APP_STORE_BADGE = 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg';

function LinkRow({ label, onClick }) {
  return (
    <button className="settings-link-row" onClick={onClick}>
      <span>{label}</span>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

export default function SettingsPanel({ labelStyle, onLabelStyleChange, onClose, onNavigate }) {
  const handleNav = (target) => {
    if (onNavigate) {
      onNavigate(target);
      return;
    }
    const paths = { privacy: '/privacy', terms: '/terms', sources: '/sources' };
    navigateTo(paths[target] || '/');
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2 className="settings-title">Settings</h2>
        <button className="settings-close" onClick={onClose} aria-label="Close settings">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <section className="settings-section">
        <div className="settings-section-title">Map pins</div>
        <div className="settings-pin-options">
          <button
            className={`settings-pin-option${labelStyle === 'classic' ? ' active' : ''}`}
            onClick={() => onLabelStyleChange('classic')}
          >
            <span className="label-toggle-preview label-toggle-preview-classic">
              <span className="ltp-pill">1.85</span>
              <span className="ltp-arrow" />
            </span>
            <span className="settings-pin-label">Classic</span>
          </button>
          <button
            className={`settings-pin-option${labelStyle === 'pin' ? ' active' : ''}`}
            onClick={() => onLabelStyleChange('pin')}
          >
            <span className="label-toggle-preview label-toggle-preview-pin">
              <span className="ltp-circle" />
              <span className="ltp-ribbon">1.85</span>
              <span className="ltp-arrow" />
            </span>
            <span className="settings-pin-label">Pin</span>
          </button>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">About &amp; legal</div>
        <div className="settings-link-list">
          <LinkRow label="Data Sources" onClick={() => handleNav('sources')} />
          <LinkRow label="Privacy Policy" onClick={() => handleNav('privacy')} />
          <LinkRow label="Terms of Use" onClick={() => handleNav('terms')} />
        </div>
      </section>

      <div className="settings-footer">
        <div className="settings-section-title">Get the app</div>
        <div className="settings-stores">
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="settings-store-badge"
          >
            <img src={PLAY_BADGE} alt="Get it on Google Play" />
          </a>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="settings-store-badge"
          >
            <img src={APP_STORE_BADGE} alt="Download on the App Store" />
          </a>
        </div>
      </div>
    </div>
  );
}
