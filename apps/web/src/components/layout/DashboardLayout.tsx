"use client";

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return <div className="h-screen w-screen flex items-center justify-center bg-[#050505] text-slate-400">Carregando Assetra...</div>;
    }

    return (
        <div className="flex h-screen bg-transparent overflow-hidden font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <Topbar />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-transparent p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
