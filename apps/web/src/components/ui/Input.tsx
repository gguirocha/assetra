import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                        {label} {props.required && <span className="text-red-500">*</span>}
                    </label>
                )}
                <input
                    ref={ref}
                    className={cn(
                        "appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-[#5B5CFF] focus:border-[#5B5CFF] sm:text-sm transition-all bg-slate-900/50 text-slate-100",
                        error ? "border-red-500/50 ring-red-500" : "border-slate-700/50 hover:border-slate-600",
                        props.disabled && "bg-slate-800/50 cursor-not-allowed text-slate-500 border-slate-800",
                        className
                    )}
                    {...props}
                />
                {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>
        );
    }
);
Input.displayName = 'Input';
