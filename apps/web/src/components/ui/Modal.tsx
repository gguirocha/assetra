"use client";

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

export function Modal({ isOpen, onClose, title, children, className, size = 'lg' }: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) {
            onClose();
        }
    };

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/60 backdrop-blur-md p-4 sm:p-0">
            <div
                ref={overlayRef}
                onClick={handleOverlayClick}
                className="fixed inset-0 transition-opacity"
            />

            <div className={cn(`relative glass-card border-slate-700/50 rounded-xl shadow-2xl w-full ${sizeClasses[size]} mx-auto flex flex-col max-h-[90vh]`, className)}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-900/30">
                    <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-500 focus:outline-none transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="px-6 py-4 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
