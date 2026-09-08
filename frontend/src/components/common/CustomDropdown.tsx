import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface DropdownOption<T extends string | number = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface CustomDropdownProps<T extends string | number = string> {
  options: DropdownOption<T>[];
  value?: T | T[];
  onChange?: (value: any) => void;
  multiple?: boolean;
  label?: string;
  placeholder?: string;
  valuePrefix?: string;
  buttonText?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  align?: 'left' | 'right';
  error?: boolean;
  minWidth?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function CustomDropdown<T extends string | number = string>({
  options,
  value,
  onChange,
  multiple = false,
  label,
  placeholder = 'Select option...',
  valuePrefix,
  buttonText,
  icon,
  size = 'md',
  fullWidth = false,
  disabled = false,
  className = '',
  align = 'left',
  error = false,
  minWidth,
  searchable = false,
  searchPlaceholder = 'Search...',
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const checkIsSelected = (optVal: T): boolean => {
    if (multiple) {
      return Array.isArray(value) && value.includes(optVal);
    }
    return value === optVal;
  };

  const handleSelect = (optVal: T) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      let newValues: T[];
      if (currentValues.includes(optVal)) {
        newValues = currentValues.filter((v) => v !== optVal);
      } else {
        newValues = [...currentValues, optVal];
      }
      onChange?.(newValues);
    } else {
      onChange?.(optVal);
      setIsOpen(false);
    }
  };

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [options, searchable, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        setIsOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          const opt = filteredOptions[focusedIndex];
          if (!opt.disabled) {
            handleSelect(opt.value);
          }
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, focusedIndex, filteredOptions, onChange, multiple, value]);

  useEffect(() => {
    if (isOpen) {
      const idx = filteredOptions.findIndex((opt) => checkIsSelected(opt.value));
      setFocusedIndex(idx >= 0 ? idx : 0);
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    } else {
      setSearchQuery('');
    }
  }, [isOpen, searchable]);

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs h-8 rounded-lg',
    md: 'px-3.5 py-2 text-xs h-10 rounded-xl',
    lg: 'px-4 py-2.5 text-sm h-11 rounded-xl',
  };

  let displayText = buttonText;
  if (!displayText) {
    if (multiple) {
      const selectedValues = Array.isArray(value) ? value : [];
      const selectedOpts = options.filter((opt) => selectedValues.includes(opt.value));
      if (selectedOpts.length === 0) {
        displayText = placeholder;
      } else {
        displayText = selectedOpts.map((opt) => opt.label).join(', ');
      }
    } else {
      const selectedOption = options.find((opt) => opt.value === value);
      displayText = selectedOption ? `${valuePrefix || ''}${selectedOption.label}` : placeholder;
    }
  }

  return (
    <div
      ref={dropdownRef}
      data-no-deselect="true"
      className={`relative inline-block text-left ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {label && (
        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2 border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 font-semibold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${
          error ? 'border-red-500 dark:border-red-500' : 'border-zinc-200 dark:border-zinc-800'
        } ${fullWidth ? 'w-full' : ''} ${sizeClasses[size]}`}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {icon && <span className="text-zinc-500 dark:text-zinc-400 shrink-0">{icon}</span>}
          <span className="truncate whitespace-nowrap">{displayText}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-black dark:text-white' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1.5 min-w-[200px] max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden`}
          style={minWidth ? { minWidth } : undefined}
        >
          {searchable && (
            <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70 sticky top-0 z-10">
              <div className="relative flex items-center">
                <Search className="h-3.5 w-3.5 text-zinc-400 absolute left-2.5 pointer-events-none shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsOpen(false);
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto py-1.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3.5 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 italic text-center">
                No matching results
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = checkIsSelected(option.value);
                const isFocused = index === focusedIndex;
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => handleSelect(option.value)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-left transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isSelected
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white font-bold'
                        : isFocused
                        ? 'bg-zinc-50 dark:bg-zinc-800/60 text-black dark:text-white'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      {multiple && (
                        <span className="w-2.5 h-2.5 shrink-0 flex items-center justify-center">
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-500 shrink-0" />
                          )}
                        </span>
                      )}
                      {option.icon && <span className="shrink-0">{option.icon}</span>}
                      <div className="truncate">
                        <span>{option.label}</span>
                        {option.description && (
                          <p className="text-[10px] font-normal text-zinc-400 dark:text-zinc-500 truncate">
                            {option.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {!multiple && isSelected && (
                      <Check className="h-4 w-4 text-black dark:text-white shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

