import React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <div className={cn("glass-card rounded-xl overflow-hidden text-slate-200", className)}>
            {children}
        </div>
    );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <div className={cn("px-6 py-4 border-b border-white/5 bg-black/20", className)}>
            {children}
        </div>
    );
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <h3 className={cn("text-lg leading-6 font-semibold text-white tracking-wide", className)}>
            {children}
        </h3>
    );
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <div className={cn("px-6 py-4", className)}>
            {children}
        </div>
    );
}
