import { useState } from 'react';
import ElementColors from '@/components/ElementColors/ElementColors';
import InputSearch from '@/components/InputSearch/InputSearch';
import SearchButton from '@/components/SearchButton/SearchButton';
import { searchContent } from '@/data/home';
import './SearchBar.css';

interface SearchBarProps {
  onSearch?: (query: string) => void;
}

function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSearch = () => {
    const value = query.trim();
    if (value) onSearch?.(value);
  };

  return (
    <div className="search-bar-container">
      <div className="colors">
        <ElementColors />
      </div>
      <div className="search-bar">
        <h3>{searchContent.title}</h3>
        <div className="input-button">
          <div className="search-bar__input">
            <InputSearch
              value={query}
              onChange={setQuery}
              onSubmit={handleSearch}
              label={searchContent.label}
            />
          </div>
          <SearchButton onClick={handleSearch} />
        </div>
      </div>
    </div>
  );
}

export default SearchBar;
