import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ElementColors from '@/components/ElementColors/ElementColors';
import InputSearch from '@/components/InputSearch/InputSearch';
import SearchButton from '@/components/SearchButton/SearchButton';
import { searchContent } from '@/data/home';
import { searchAgreements } from '@/data/globalSearch';
import './SearchBar.css';

function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  const value = query.trim();
  const hits = useMemo(() => searchAgreements(value), [value]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const change = (text: string) => {
    setQuery(text);
    setActive(-1);
    setOpen(true);
  };

  const go = (index = active) => {
    const hit = hits[index >= 0 ? index : 0];
    if (hit) navigate(hit.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="search-bar-container">
      <div className="colors">
        <ElementColors />
      </div>
      <div className="search-bar">
        <h3>{searchContent.title}</h3>
        <div className="input-button">
          <div className="search-bar__input" ref={boxRef} onKeyDown={onKeyDown}>
            <InputSearch value={query} onChange={change} onSubmit={() => go()} label={searchContent.label} />
            {open && value && (
              <ul className="search-suggestions" role="listbox">
                {hits.length ? (
                  hits.map((hit, i) => (
                    <li
                      key={hit.id}
                      role="option"
                      aria-selected={i === active}
                      className={`search-suggestions__item${i === active ? ' is-active' : ''}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(i)}
                    >
                      <img src={hit.logo} alt="" loading="lazy" />
                      <span>{hit.name}</span>
                    </li>
                  ))
                ) : (
                  <li className="search-suggestions__empty">No se encontraron convenios en tu búsqueda.</li>
                )}
              </ul>
            )}
          </div>
          <SearchButton onClick={() => go()} />
        </div>
      </div>
    </div>
  );
}

export default SearchBar;
