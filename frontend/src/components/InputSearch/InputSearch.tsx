import { useId } from 'react';
import './InputSearch.css';

interface InputSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  label?: string;
  placeholder?: string;
  strong?: boolean;
}

function InputSearch({ value, onChange, onSubmit, label, placeholder = '', strong = false }: InputSearchProps) {
  const inputId = useId();

  return (
    <div className="input-general">
      <div className="input-search">
        <div className={`input-wrapper ${strong ? 'input-wrapper--strong' : ''}`}>
          <div className="lens" aria-hidden="true" />
          <div className="input-container">
            {label && !value && (
              <label htmlFor={inputId} className="search-label">
                {label}
              </label>
            )}
            <input
              id={inputId}
              type="text"
              className="search-input"
              value={value}
              placeholder={placeholder}
              autoComplete="off"
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default InputSearch;
