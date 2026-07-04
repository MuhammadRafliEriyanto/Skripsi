const fs = require('fs');
let code = fs.readFileSync('original_chatbot.tsx', 'utf16le');
code = code.replace(/import type \{ LucideIcon \} from "lucide-react";\r?\n/, '');
code = code.replace(/  BookOpenCheck,\r?\n/, '');
code = code.replace(/  GraduationCap,\r?\n/, '');
code = code.replace(/  MapPin,\r?\n/, '');

// Remove QuickAction type
code = code.replace(/type QuickAction = \{[\s\S]*?\};\r?\n\r?\n/, '');

// Remove quickActions array
code = code.replace(/const quickActions: QuickAction\[\] = \[[\s\S]*?\];\r?\n\r?\n/, '');

// Remove the rendering of quickActions
const quickActionsRenderRegex = /<div className=\"mb-2\.5 flex flex-wrap gap-1\.5\">[\s\S]*?<\/div>\r?\n\r?\n                <form/g;
code = code.replace(quickActionsRenderRegex, '<form');

// Change the initial messages to be cleaner
code = code.replace(/Halo, saya asisten Bina Cendekia. Saya bisa bantu jelaskan paket belajar, program, lokasi cabang, atau alur pendaftaran online./, 'Halo! Saya asisten AI Bina Cendekia. Ada yang bisa saya bantu hari ini?');

fs.writeFileSync('src/components/landing/LandingChatbot.tsx', code, 'utf8');
console.log('Done!');
