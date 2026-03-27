"use client";

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { cn } from '@/lib/utils';

// Map route prefixes to permission modules
const ROUTE_MODULE_MAP: Record<string, string> = {
    '/fleet': 'fleet',
    '/maintenance': 'maintenance',
    '/maintenance-machines': 'maintenance',
    '/facilities': 'maintenance',
    '/inventory': 'inventory',
    '/fuel': 'fuel',
    '/car-wash': 'carwash',
    '/settings': 'admin',
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { theme } = useTheme();
    const { hasModuleAccess, isAdmin, loading: permsLoading } = usePermissions();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    // Route-level permission enforcement
    useEffect(() => {
        if (loading || permsLoading || !user || isAdmin) return;

        // Find matching module for current route
        // Sort by longest prefix first so /maintenance-machines matches before /maintenance
        const sortedPrefixes = Object.keys(ROUTE_MODULE_MAP).sort((a, b) => b.length - a.length);
        
        for (const prefix of sortedPrefixes) {
            if (pathname.startsWith(prefix)) {
                const requiredModule = ROUTE_MODULE_MAP[prefix];
                if (!hasModuleAccess(requiredModule)) {
                    router.replace('/calendar');
                }
                break;
            }
        }
    }, [pathname, loading, permsLoading, user, isAdmin, hasModuleAccess, router]);

    // Handle screen size changes to auto collapse
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsSidebarCollapsed(true);
            } else {
                setIsSidebarCollapsed(false);
            }
        };
        handleResize(); // Initial check
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, []);

    if (loading || permsLoading || !user) {
        return <div className="h-screen w-screen flex items-center justify-center bg-[#050505] text-slate-400">Carregando Assetra...</div>;
    }

    return (
        <div className={cn("flex h-screen bg-transparent overflow-hidden font-sans", theme === 'light' && 'light-theme')}>
            <Sidebar 
                isCollapsed={isSidebarCollapsed} 
                setIsCollapsed={setIsSidebarCollapsed}
                isMobileOpen={isMobileMenuOpen} 
                setIsMobileOpen={setIsMobileMenuOpen} 
            />
            
            <div className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 w-full`}>
                <Topbar 
                    isMobileMenuOpen={isMobileMenuOpen}
                    setIsMobileMenuOpen={setIsMobileMenuOpen}
                />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-transparent p-4 md:p-6 relative">
                    {children}
                </main>
                
                {/* Mobile overlay */}
                {isMobileMenuOpen && (
                    <div 
                        className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}
            </div>
        </div>
    );
}
