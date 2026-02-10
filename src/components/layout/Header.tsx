import { useBillStore } from '../../stores/billStore';
import { t } from '../../constants/translations';
import { LanguageToggle } from '../LanguageToggle';

export type AppView = 'voucher' | 'prompt-generator' | 'gallery' | 'template-builder';

interface HeaderProps {
  currentView?: AppView;
  onViewChange?: (view: AppView) => void;
}

const viewLabels = {
  de: {
    voucher: 'Gutschein',
    'prompt-generator': 'Prompt Generator',
    gallery: 'Galerie',
    'template-builder': 'Template-Assistent',
  },
  en: {
    voucher: 'Voucher',
    'prompt-generator': 'Prompt Generator',
    gallery: 'Gallery',
    'template-builder': 'Template Wizard',
  },
};

export function Header({ currentView = 'voucher', onViewChange }: HeaderProps) {
  const appLanguage = useBillStore((state) => state.appLanguage);
  const trans = t(appLanguage);
  const vl = viewLabels[appLanguage];

  return (
    <div className="navbar bg-currency-green text-currency-cream shadow-lg shrink-0">
      <div className="navbar-start">
        <a className="btn btn-ghost text-xl font-currency font-bold">{trans.header.title}</a>
      </div>
      <div className="navbar-center">
        {onViewChange && (
          <div className="tabs tabs-boxed bg-currency-green/50">
            <button
              className={`tab ${currentView === 'voucher' ? 'tab-active bg-currency-cream text-currency-green' : 'text-currency-cream'}`}
              onClick={() => onViewChange('voucher')}
            >
              {vl.voucher}
            </button>
            <button
              className={`tab ${currentView === 'prompt-generator' ? 'tab-active bg-currency-cream text-currency-green' : 'text-currency-cream'}`}
              onClick={() => onViewChange('prompt-generator')}
            >
              {vl['prompt-generator']}
            </button>
            <button
              className={`tab ${currentView === 'gallery' ? 'tab-active bg-currency-cream text-currency-green' : 'text-currency-cream'}`}
              onClick={() => onViewChange('gallery')}
            >
              {vl.gallery}
            </button>
            <button
              className={`tab ${currentView === 'template-builder' ? 'tab-active bg-currency-cream text-currency-green' : 'text-currency-cream'}`}
              onClick={() => onViewChange('template-builder')}
            >
              {vl['template-builder']}
            </button>
          </div>
        )}
        {!onViewChange && (
          <span className="text-sm opacity-80 hidden sm:flex">{trans.header.subtitle}</span>
        )}
      </div>
      <div className="navbar-end">
        <LanguageToggle />
      </div>
    </div>
  );
}
