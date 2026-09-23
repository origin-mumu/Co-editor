import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface CapsuleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const CapsuleButton: React.FC<CapsuleButtonProps> = ({
  variant = 'secondary',
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'capsule-btn inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none';

  const variantClasses = {
    primary:
      'bg-[#3E6FDC] hover:bg-[#325ec2] active:bg-[#284da3] text-white',
    secondary:
      'bg-[rgba(120,120,128,0.08)] hover:bg-[rgba(120,120,128,0.14)] active:bg-[rgba(120,120,128,0.2)] text-[#1c1c1e] border border-[rgba(0,0,0,0.06)]',
    ghost:
      'bg-transparent hover:bg-[rgba(120,120,128,0.08)] active:bg-[rgba(120,120,128,0.14)] text-[#3c3c43]',
    danger:
      'bg-[rgba(255,59,48,0.12)] hover:bg-[rgba(255,59,48,0.18)] active:bg-[rgba(255,59,48,0.24)] text-[#ff3b30]'
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}
      {children}
    </button>
  );
};
