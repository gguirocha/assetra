const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '../apps/web/src/app/(dashboard)');

function walkSync(dir, filelist) {
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

    // Fix lingering text colors mapped to form labels and borders
    content = content.replace(/text-slate-700/g, 'text-slate-300');
    content = content.replace(/border-slate-100/g, 'border-white/10');
    content = content.replace(/border-slate-200/g, 'border-white/10');

    // Fix Input components missing bg properly, also textarea.
    content = content.replace(/shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/g, 'shadow-sm focus:outline-none focus:ring-[#00E5FF] focus:border-[#00E5FF] sm:text-sm bg-slate-900/50 text-slate-100 placeholder-slate-500 transition-colors"');

    fs.writeFileSync(file, content, 'utf8');
});

console.log('Second pass restyling completed for ' + files.length + ' files.');
