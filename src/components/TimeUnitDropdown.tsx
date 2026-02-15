"use client";

import React from "react";

const options = ["Dias", "Meses", "Anos"];

interface TimeUnitDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    selectedUnit: string;
    onSelect: (unit: string) => void;
}

const TimeUnitDropdown: React.FC<TimeUnitDropdownProps> = ({
    isOpen,
    onClose,
    selectedUnit,
    onSelect
}) => {
    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[60]" onClick={onClose}></div>
            <div className="absolute right-0 top-full mt-2 w-40 bg-[#2C2C2E] border border-white/20 rounded-xl overflow-hidden shadow-2xl z-[70] animate-in fade-in zoom-in-95 duration-200">
                {options.map((option) => (
                    <div
                        key={option}
                        onClick={() => {
                            onSelect(option);
                            onClose();
                        }}
                        className={`p-3 text-sm cursor-pointer transition-colors flex items-center justify-between ${selectedUnit === option ? 'text-white bg-white/5 font-bold' : 'text-gray-400 hover:bg-white/5'
                            }`}
                    >
                        {option}
                        {selectedUnit === option && (
                            <span className="material-icons-round text-green-500 text-sm">check_circle</span>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
};

export default TimeUnitDropdown;
