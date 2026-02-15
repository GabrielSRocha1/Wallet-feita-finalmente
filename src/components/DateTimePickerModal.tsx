"use client";

import React, { useState, useMemo } from "react";

interface DateTimePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (date: string) => void;
}

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const DateTimePickerModal: React.FC<DateTimePickerModalProps> = ({ isOpen, onClose, onSave }) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();

    const [viewMonth, setViewMonth] = useState(currentMonth);
    const [viewYear, setViewYear] = useState(currentYear);
    const [selectedDay, setSelectedDay] = useState(currentDay);
    const [time, setTime] = useState(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);

    const daysInMonth = useMemo(() => {
        const date = new Date(viewYear, viewMonth + 1, 0);
        return date.getDate();
    }, [viewMonth, viewYear]);

    const firstDayOfMonth = useMemo(() => {
        const date = new Date(viewYear, viewMonth, 1);
        return date.getDay();
    }, [viewMonth, viewYear]);

    const calendarDays = useMemo(() => {
        const days = [];
        // Padding for the first day of the week
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }
        return days;
    }, [daysInMonth, firstDayOfMonth]);

    const timezone = useMemo(() => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const offset = -(now.getTimezoneOffset() / 60);
        const gmt = offset >= 0 ? `+${offset}` : `${offset}`;
        return `${tz} (GMT${gmt})`;
    }, []);

    if (!isOpen) return null;

    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMonth = parseInt(e.target.value);
        // If selecting current month in current year, ensure day isn't in past
        if (viewYear === currentYear && newMonth < currentMonth) return;
        setViewMonth(newMonth);
    };

    const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newYear = parseInt(e.target.value);
        if (newYear < currentYear) return;
        setViewYear(newYear);
        // If changing to current year and month is past, reset to current month
        if (newYear === currentYear && viewMonth < currentMonth) {
            setViewMonth(currentMonth);
        }
    };

    const isDayDisabled = (day: number | null) => {
        if (!day) return true;
        if (viewYear < currentYear) return true;
        if (viewYear === currentYear && viewMonth < currentMonth) return true;
        if (viewYear === currentYear && viewMonth === currentMonth && day < currentDay) return true;
        return false;
    };

    const nextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear(prev => prev + 1);
        } else {
            setViewMonth(prev => prev + 1);
        }
    };

    const prevMonth = () => {
        if (viewYear === currentYear && viewMonth === currentMonth) return;

        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(prev => prev - 1);
        } else {
            setViewMonth(prev => prev - 1);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto">
            <div
                className="w-full max-w-[340px] bg-[#2C2C2E] rounded-2xl p-4 shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300 text-white"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <button
                        disabled={viewYear === currentYear && viewMonth === currentMonth}
                        onClick={prevMonth}
                        className="material-icons-round cursor-pointer hover:bg-white/5 p-1 rounded-full text-white disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                        chevron_left
                    </button>

                    <div className="flex gap-2">
                        <select
                            value={viewMonth}
                            onChange={handleMonthChange}
                            className="bg-transparent border-none text-sm font-semibold focus:ring-0 p-0 text-white cursor-pointer uppercase tracking-tight"
                        >
                            {months.map((month, index) => (
                                <option
                                    key={month}
                                    value={index}
                                    disabled={viewYear === currentYear && index < currentMonth}
                                    className="bg-[#2C2C2E] text-white"
                                >
                                    {month}
                                </option>
                            ))}
                        </select>
                        <select
                            value={viewYear}
                            onChange={handleYearChange}
                            className="bg-transparent border-none text-sm font-semibold focus:ring-0 p-0 text-white cursor-pointer"
                        >
                            {[currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4, currentYear + 5].map(year => (
                                <option key={year} value={year} className="bg-[#2C2C2E] text-white">{year}</option>
                            ))}
                        </select>
                    </div>

                    <button onClick={nextMonth} className="material-icons-round cursor-pointer hover:bg-white/5 p-1 rounded-full text-white">
                        chevron_right
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                    <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-sm font-bold">
                    {calendarDays.map((day, idx) => {
                        const disabled = isDayDisabled(day);
                        return (
                            <span
                                key={idx}
                                onClick={() => {
                                    if (!disabled && day) {
                                        setSelectedDay(day);

                                        // If selecting today, validate time
                                        if (viewYear === currentYear && viewMonth === currentMonth && day === currentDay) {
                                            const nowInSystem = new Date();
                                            const currentH = nowInSystem.getHours();
                                            const currentM = nowInSystem.getMinutes();

                                            const [h, m] = time.split(':').map(Number);
                                            if (h < currentH || (h === currentH && m < currentM)) {
                                                setTime(`${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`);
                                            }
                                        }
                                    }
                                }}
                                className={`p-1.5 flex items-center justify-center aspect-square mx-auto w-8 h-8 transition-all rounded-full ${!day ? 'invisible' :
                                    disabled ? 'text-gray-600 cursor-not-allowed' :
                                        day === selectedDay ? 'bg-[#D4AF37] text-black font-black scale-110 shadow-lg cursor-pointer' :
                                            'text-white cursor-pointer hover:bg-white/10'
                                    }`}
                            >
                                {day}
                            </span>
                        );
                    })}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                    <span className="text-sm font-bold text-white">Tempo</span>
                    <div className="bg-[#2C2C2E] border border-white/10 px-3 py-2 rounded-xl flex items-center gap-2 focus-within:ring-1 focus-within:ring-[#EAB308] focus-within:border-[#EAB308] transition-all">
                        <input
                            type="text"
                            placeholder="00:00"
                            value={time}
                            onChange={(e) => {
                                let val = e.target.value.replace(/\D/g, ''); // Remove non-digits

                                if (val.length > 4) val = val.slice(0, 4);

                                if (val.length >= 3) {
                                    val = val.slice(0, 2) + ':' + val.slice(2);
                                }

                                setTime(val);
                            }}
                            onBlur={() => {
                                // Validate and format on blur
                                let raw = time.replace(/\D/g, '').padEnd(4, '0');
                                let h = parseInt(raw.slice(0, 2));
                                let m = parseInt(raw.slice(2, 4));

                                if (isNaN(h)) h = 0;
                                if (isNaN(m)) m = 0;

                                h = Math.min(23, Math.max(0, h));
                                m = Math.min(59, Math.max(0, m));

                                // Enforce minimum time if today is selected
                                if (viewYear === currentYear && viewMonth === currentMonth && selectedDay === currentDay) {
                                    const nowInSystem = new Date();
                                    const currentH = nowInSystem.getHours();
                                    const currentM = nowInSystem.getMinutes();

                                    if (h < currentH || (h === currentH && m < currentM)) {
                                        h = currentH;
                                        m = currentM;
                                    }
                                }

                                setTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                            }}
                            className="bg-transparent border-none focus:ring-0 p-0 text-sm font-bold text-white w-12 text-center outline-none placeholder:text-gray-600"
                            maxLength={5}
                        />
                        <span className="material-icons-round text-sm text-[#EAB308]">schedule</span>
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[10px] font-bold">
                    <span className="opacity-40 uppercase tracking-widest">Fuso horário</span>
                    <span className="text-gray-400">{timezone}</span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                    <button
                        onClick={onClose}
                        className="bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all border border-white/10"
                    >
                        CANCELAR
                    </button>
                    <button
                        onClick={() => {
                            // Final validation before save
                            let [h, m] = time.split(':').map(Number);

                            if (viewYear === currentYear && viewMonth === currentMonth && selectedDay === currentDay) {
                                const nowInSystem = new Date();
                                const currentH = nowInSystem.getHours();
                                const currentM = nowInSystem.getMinutes();

                                if (h < currentH || (h === currentH && m < currentM)) {
                                    h = currentH;
                                    m = currentM;
                                }
                            }

                            const finalTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                            const formattedDate = `${selectedDay.toString().padStart(2, '0')}/${(viewMonth + 1).toString().padStart(2, '0')}/${viewYear}, ${finalTime}`;
                            onSave(formattedDate);
                            onClose();
                        }}
                        className="bg-[#D4AF37] text-black font-black py-2.5 rounded-xl text-xs active:scale-95 transition-all shadow-md"
                    >
                        SALVAR
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DateTimePickerModal;
