import React from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
    return (
        <div className="overflow-x-auto rounded-lg border border-white/5 shadow-sm bg-black/20 backdrop-blur-md">
            <table className={cn("min-w-full divide-y divide-white/5", className)} {...props}>
                {children}
            </table>
        </div>
    );
}

export function TableHeader({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
    return (
        <thead className={cn("bg-slate-900/50", className)} {...props}>
            {children}
        </thead>
    );
}

export function TableRow({ className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
    return (
        <tr className={cn("transition-all hover:bg-white/10 hover:shadow-[inset_4px_0_0_0_#00E5FF] border-b border-white/5 last:border-0 bg-white/[0.02]", className)} {...props}>
            {children}
        </tr>
    );
}

export function TableHead({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
    return (
        <th
            scope="col"
            className={cn("px-6 py-4 text-left text-xs font-bold text-[#00E5FF] uppercase tracking-widest", className)}
            {...props}
        >
            {children}
        </th>
    );
}

export function TableBody({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
    return (
        <tbody className={cn("divide-y divide-white/5", className)} {...props}>
            {children}
        </tbody>
    );
}

export function TableCell({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
    return (
        <td className={cn("px-6 py-4 whitespace-nowrap text-sm text-slate-200", className)} {...props}>
            {children}
        </td>
    );
}
