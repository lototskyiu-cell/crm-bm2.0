import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
  image?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Оберіть...",
  className = "",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // Filter options
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {/* Trigger Button */}
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full p-2.5 border rounded-lg bg-white flex items-center justify-between cursor-pointer transition-all ${
            isOpen ? 'ring-2 ring-blue-500 border-transparent' : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
      >
        <div className="flex items-center overflow-hidden">
            {selectedOption ? (
                <>
                    {selectedOption.image && (
                        <img src={selectedOption.image} alt="" className="w-5 h-5 rounded mr-2 object-cover shrink-0"/>
                    )}
                    <div className="flex flex-col items-start truncate">
                        <span className="text-sm font-medium text-gray-800 truncate">{selectedOption.label}</span>
                    </div>
                </>
            ) : (
                <span className="text-sm text-gray-400">{placeholder}</span>
            )}
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown Content */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-fade-in-up">
            {/* Search Input */}
            <div className="p-2 border-b border-gray-100 bg-gray-50">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input 
                        autoFocus
                        type="text"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 placeholder:text-gray-400"
                        placeholder="Пошук..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            </div>

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                {filteredOptions.length > 0 ? (
                    filteredOptions.map(opt => (
                        <div 
                            key={opt.value}
                            onClick={() => handleSelect(opt.value)}
                            className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
                                value === opt.value ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                            }`}
                        >
                            <div className="flex items-center flex-1 overflow-hidden">
                                {opt.image && (
                                    <img src={opt.image} className="w-8 h-8 rounded border border-gray-200 mr-3 object-cover bg-white"/>
                                )}
                                <div className="truncate">
                                    <div className="text-sm font-medium truncate">{opt.label}</div>
                                    {opt.subLabel && <div className="text-xs text-gray-400 truncate">{opt.subLabel}</div>}
                                </div>
                            </div>
                            {value === opt.value && <Check size={16} className="ml-2 text-blue-600"/>}
                        </div>
                    ))
                ) : (
                    <div className="p-4 text-center text-sm text-gray-400">
                        Нічого не знайдено
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};
