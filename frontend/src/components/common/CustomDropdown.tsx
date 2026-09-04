import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption<T = string> {
  value: T;
  label: string | React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface CustomDropdownProps<T = string> {
  options: DropdownOption<T>[];
  value?: T;
  onChange: (value: T) => void;
  placeholder?: string;
  labelPrefix?: string;
  startIcon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
  size?: 'sm' | 'md';
}

export function CustomDropdown<T = string>({
  options,
  value,
  onChange,
  placeholder = 'Select option',
  labelPrefix,
  startIcon,
  disabled = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  align = 'left',
  size = 'md',
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const toggleDropdown = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (option: DropdownOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation & Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < options.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : options.length - 1
        );
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          handleSelect(options[highlightedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, highlightedIndex, options]);

  const heightClass = size === 'sm' ? 'h-9 text-xs px-3' : 'h-10 text-xs md:text-sm px-4';

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggleDropdown}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`flex items-center justify-between gap-2 w-full ${heightClass} bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg font-semibold text-zinc-900 dark:text-zinc-100 shadow-sm transition-all duration-150 ease-out hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${triggerClassName}`}
      >
        <span className="flex items-center gap-2 truncate">
          {startIcon && <span className="text-zinc-500">{startIcon}</span>}
          <span>
            {labelPrefix ? `${labelPrefix}: ` : ''}
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition-transform duration-150 ease-out ${
            isOpen ? 'rotate-180 text-zinc-800 dark:text-zinc-200' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-1.5 min-w-[180px] max-w-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-1.5 z-[9999] transition-all duration-150 ease-out transform animate-in fade-in-0 zoom-in-95 ${menuClassName}`}
          style={{
            boxShadow:
              '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.03)',
          }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = index === highlightedIndex;

            return (
              <button
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`flex items-center justify-between gap-3 w-full px-3.5 py-2 text-xs md:text-sm font-medium rounded-lg text-left transition-colors duration-100 ${
                  isSelected
                    ? 'font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800'
                    : 'text-zinc-700 dark:text-zinc-300'
                } ${
                  isHighlighted && !isSelected
                    ? 'bg-zinc-50 dark:bg-zinc-800/60'
                    : ''
                } ${
                  option.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  {option.icon && (
                    <span className="text-zinc-500">{option.icon}</span>
                  )}
                  <span className="truncate">{option.label}</span>
                </span>
                {isSelected && (
                  <Check className="h-4 w-4 text-zinc-900 dark:text-zinc-100 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
