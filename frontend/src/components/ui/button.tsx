import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'text';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'button-primary',
  secondary: 'button-secondary',
  text: 'text-button'
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`${variantClass[variant]} ${className}`.trim()} {...props} />;
}
