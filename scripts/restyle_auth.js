const fs = require('fs');
const path = require('path');

const files = [
    path.join(__dirname, '../apps/web/src/app/(auth)/reset-password/page.tsx'),
    path.join(__dirname, '../apps/web/src/app/(auth)/update-password/page.tsx')
];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    // Remove Light Theme Container Wrappers and Add Dark/Glow Elements
    content = content.replace(
        '<div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">',
        `<div className="min-h-screen bg-transparent flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            
            {/* Ambient Background Effects */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#5B5CFF]/10 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00E5FF]/10 rounded-full blur-[100px] pointer-events-none"></div>`
    );

    // Replace ShieldIcon Div with Logo
    content = content.replace(
        /<div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">[\s\S]*?<\/div>/m,
        `<img src="/logo.png" alt="Assetra Logo" className="h-24 w-auto object-contain drop-shadow-[0_0_15px_rgba(0,229,255,0.4)]" />`
    );

    // Add Logo Text for Reset Page
    content = content.replace(
        '<h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">',
        `<h2 className="mt-2 text-center text-3xl font-extrabold text-transparent text-gradient tracking-wide font-orbitron drop-shadow-[0_0_8px_rgba(91,92,255,0.8)]">
                    ASSETRA
                </h2>
                <h3 className="mt-4 text-center text-xl font-bold text-slate-200">`
    );
    content = content.replace(
        'Recuperar Senha\n                </h2>',
        'Recuperar Senha\n                </h3>'
    );

    // Add Logo Text for Update Page
    content = content.replace(
        'Definir Nova Senha\n                </h2>',
        'Definir Nova Senha\n                </h3>'
    );


    content = content.replace(/text-slate-600/g, 'text-slate-400');
    content = content.replace(/text-slate-700/g, 'text-slate-300');

    // Replace form wrapper
    content = content.replace(
        '<div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200">',
        '<div className="glass-card py-8 px-4 sm:rounded-2xl sm:px-10 border border-white/5 shadow-2xl relative z-10">'
    );

    // Make inputs dark
    content = content.replace(
        /className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/g,
        'className="appearance-none block w-full px-3 py-2 border border-slate-700/50 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF] sm:text-sm bg-slate-900/50 text-slate-100 transition-colors"'
    );

    // Styling error and success messages
    content = content.replace(
        '<div className="bg-red-50 border-l-4 border-red-500 p-4">',
        '<div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-md">'
    );
    content = content.replace(/text-red-700/g, 'text-red-400');

    content = content.replace(
        '<div className="bg-green-50 border-l-4 border-green-500 p-4">',
        '<div className="bg-green-500/10 border-l-4 border-[#00E5FF] p-4 rounded-r-md">'
    );
    content = content.replace(/text-green-700/g, 'text-[#00E5FF]');
    content = content.replace(/border-green-500/g, 'border-[#00E5FF]');


    // Styling buttons
    content = content.replace(
        /className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"/g,
        'className="w-full flex justify-center py-2.5 px-4 rounded-md shadow-sm text-sm font-bold text-white bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00E5FF] focus:ring-offset-[#0f0f14] transition-all disabled:opacity-50 glow-primary"'
    );

    // Links
    content = content.replace(/text-blue-600 hover:text-blue-500/g, 'text-[#00E5FF] hover:text-[#5B5CFF]');

    // Add z-index wrapper to forms to be over the ambient glow
    content = content.replace(
        '<div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">',
        '<div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">'
    );

    content = content.replace(
        '<div className="sm:mx-auto sm:w-full sm:max-w-md">',
        '<div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">'
    );

    fs.writeFileSync(file, content, 'utf8');
});

console.log('Finished restyling auth pages.');
