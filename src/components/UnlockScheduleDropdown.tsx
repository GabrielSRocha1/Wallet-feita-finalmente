"use client";

import React from "react";

const schedules = ["Horas", "Dias", "Semanas", "Meses", "Anos"];

interface UnlockScheduleDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    selectedSchedule: string;
    onSelect: (schedule: string) => void;
}

const UnlockScheduleDropdown: React.FC<UnlockScheduleDropdownProps> = ({
    isOpen,
    onClose,
    selectedSchedule,
    onSelect
}) => {
    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[60]" onClick={onClose}></div>
            <div className="absolute right-0 top-full mt-2 w-48 bg-[#2C2C2E] border border-white/20 rounded-xl overflow-hidden shadow-2xl z-[70] animate-in fade-in zoom-in-95 duration-200">
                {schedules.map((schedule) => (
                    <div
                        key={schedule}
                        onClick={() => {
                            onSelect(schedule);
                            onClose();
                        }}
                        className={`p-3 text-xs cursor-pointer transition-colors flex items-center justify-between ${selectedSchedule === schedule ? 'text-white bg-white/5 font-bold' : 'text-gray-400 hover:bg-white/5'
                            }`}
                    >
                        {schedule}
                        {selectedSchedule === schedule && (
                            <span className="material-icons-round text-green-500 text-sm">check_circle</span>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
};

export default UnlockScheduleDropdown;
