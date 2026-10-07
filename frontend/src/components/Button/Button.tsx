import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  absolute?: boolean;
}

function Button({
  variant = 'primary',
  icon,
  absolute = false,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, icon ? 'btn--icon' : '', absolute ? 'btn-absolute' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {icon}
      {children && <span>{children}</span>}
    </button>
  );
}

export default Button;
