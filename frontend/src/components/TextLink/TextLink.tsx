import type { AnchorHTMLAttributes } from 'react';
import './TextLink.css';

interface TextLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean;
  showIcon?: boolean;
}

function TextLink({ active = true, showIcon = true, className = '', children, ...rest }: TextLinkProps) {
  const classes = ['text-link', active ? 'active' : '', className].filter(Boolean).join(' ');

  return (
    <a className={classes} {...rest}>
      {children}
      {showIcon && <span className={`tarjet ${active ? 'icon-active' : ''}`} aria-hidden="true" />}
    </a>
  );
}

export default TextLink;
