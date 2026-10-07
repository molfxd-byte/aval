import Button from '@/components/Button/Button';
import './SearchButton.css';

interface SearchButtonProps {
  onClick: () => void;
}

const LensIcon = (
  <svg width="30" height="30" viewBox="0 0 96 96" aria-hidden="true">
    <path d="M44.06,64.64c-11.63,0-21.08-9.46-21.08-21.08s9.46-21.08,21.08-21.08,21.08,9.46,21.08,21.08-9.46,21.08-21.08,21.08ZM44.06,28.68c-8.21,0-14.88,6.67-14.88,14.88s6.67,14.88,14.88,14.88,14.88-6.67,14.88-14.88-6.67-14.88-14.88-14.88Z" />
    <path
      d="M60.5,53.55h7.07c.25,0,.46.21.46.46v17.62c0,2.15-1.74,3.89-3.89,3.89h-.2c-2.15,0-3.89-1.74-3.89-3.89v-17.62c0-.25.21-.46.46-.46Z"
      transform="translate(-26.88 64.19) rotate(-45)"
    />
  </svg>
);

function SearchButton({ onClick }: SearchButtonProps) {
  return (
    <div className="search-button">
      <div className="button-desktop">
        <Button variant="primary" onClick={onClick}>
          Buscar
        </Button>
      </div>
      <div className="button-mobile">
        <Button variant="primary" icon={LensIcon} onClick={onClick} aria-label="Buscar" />
      </div>
    </div>
  );
}

export default SearchButton;
