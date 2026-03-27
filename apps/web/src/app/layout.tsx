import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Orbitron } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { PermissionsProvider } from '@/contexts/PermissionsContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' });

export const metadata: Metadata = {
  title: 'Assetra - Gestão de Frotas e Facilities',
  description: 'Sistema completo para controle de frotas e manutenção predial',
};

import { ThemeProvider } from '@/contexts/ThemeContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${orbitron.variable} font-sans antialiased bg-[#050505] text-slate-200`}>
        <ThemeProvider>
          <AuthProvider>
            <PermissionsProvider>
              {children}
            </PermissionsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
