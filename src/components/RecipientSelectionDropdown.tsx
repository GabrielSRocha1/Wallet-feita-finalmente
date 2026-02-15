"use client";

import React from "react";

const options = [
    "Somente o remetente",
    "Ambos",
    "Nenhum"
];

interface RecipientSelectionDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    selectedOption: string;
    onSelect: (option: string) => void;
}

const RecipientSelectionDropdown: React.FC<RecipientSelectionDropdownProps> = ({
    isOpen,
    onClose,
    selectedOption,
    onSelect
}) => {
    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[60]" onClick={onClose}></div>
            <div className="absolute right-0 top-full left-0 mt-2 bg-[#2C2C2E] border border-white/20 rounded-xl overflow-hidden shadow-2xl z-[70] animate-in fade-in zoom-in-95 duration-200">
                {options.map((option) => (
                    <div
                        key={option}
                        onClick={() => {
                            onSelect(option);
                            onClose();
                        }}
                        className={`px-4 py-3 text-sm cursor-pointer transition-all flex items-center justify-between ${selectedOption === option
                            ? 'text-white bg-white/10 font-bold'
                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        <span>{option}</span>
                        {selectedOption === option && (
                            <span className="material-icons-round text-[#EAB308] text-sm animate-in zoom-in duration-300">check_circle</span>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
};

export default RecipientSelectionDropdown;
