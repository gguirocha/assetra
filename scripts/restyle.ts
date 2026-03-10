import fs from 'fs';
import path from 'path';

const directoryPath = path.join(__dirname, '../apps/web/src/app/(dashboard)');

function walkSync(dir: string, filelist: string[]) {
    const files = fs.readdirSync(dir);
    filelist = filelist || [];
    files.forEach(function (file) {
        if (fs.statSync(dir + '/' + file).isDirectory()) {
            filelist = walkSync(dir + '/' + file, filelist);
        }
        else if (file.endsWith('.tsx')) {
            filelist.push(dir + '/' + file);
        }
    });
    return filelist;
}

const files = walkSync(directoryPath, []);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Replace headers and texts
    content = content.replace(/text-slate-900/g, 'text-slate-100 uppercase tracking-wide');
    content = content.replace(/text-slate-800/g, 'text-slate-200');

    // Replace hardcoded selects and textareas
    content = content.replace(/bg-white/g, 'bg-slate-900/50 text-slate-100');
    content = content.replace(/border-slate-300/g, 'border-slate-700/50');
    content = content.replace(/bg-slate-50/g, 'bg-slate-800/50');

    // Additional generic colors for pills/badges
    content = content.replace(/bg-green-100 text-green-800/g, 'bg-green-500/20 text-green-400 border border-green-500/20');
    content = content.replace(/bg-red-100 text-red-800/g, 'bg-red-500/20 text-red-400 border border-red-500/20');
    content = content.replace(/bg-amber-100 text-amber-800/g, 'bg-amber-500/20 text-amber-400 border border-amber-500/20');
    content = content.replace(/bg-slate-100 text-slate-800/g, 'bg-slate-500/20 text-slate-400 border border-slate-500/20');
    content = content.replace(/bg-blue-100 text-blue-800/g, 'bg-blue-500/20 text-blue-400 border border-blue-500/20');

    fs.writeFileSync(file, content, 'utf8');
});

console.log('Restyling completed for ' + files.length + ' files.');
