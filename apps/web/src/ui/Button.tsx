import type { ButtonHTMLAttributes, Ref } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  active?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'default',
  size = 'md',
  active = false,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, `btn-${size}`, active ? 'is-active' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}
