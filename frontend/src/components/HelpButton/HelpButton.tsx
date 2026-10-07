import { images } from '@/assets/images';
import './HelpButton.css';

interface HelpButtonProps {
  onClick?: () => void;
}

function HelpButton({ onClick }: HelpButtonProps) {
  return (
    <div className="help-button">
      <div className="alter-container">
        <div className="container-help-btn">
          <button type="button" className="help-btn" aria-label="Ayuda" onClick={onClick}>
            <img className="help-img" src={images.iconHelp} alt="" />
          </button>
          <div className="help">
            <span>¿Necesitas ayuda?</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpButton;
