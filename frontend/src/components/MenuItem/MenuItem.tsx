import { useState } from 'react';
import type { NavItem } from '@/types/home';
import './MenuItem.css';

interface MenuItemProps {
  item: NavItem;
}

function MenuItem({ item }: MenuItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="menu-items">
      <div
        className="text"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen((prev) => !prev)}
      >
        <span>{item.label}</span>
        <span className={`toggle-off ${open ? 'toggle-off--open' : ''}`} aria-hidden="true" />
      </div>

      {open && item.children && (
        <ul className="menu-items__dropdown">
          {item.children.map((child) => (
            <li key={child.label}>
              <a href={child.href}>{child.label}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MenuItem;
