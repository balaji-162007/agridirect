const fs = require('fs');

function processFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.charCodeAt(0) === 0xFFFE || content.charCodeAt(0) === 0xFEFF || content.includes('\u0000')) {
    content = fs.readFileSync(file, 'utf16le');
  }

  if (file.includes('api.js')) {
    content = content.replace(/window\.API_BASE = API_BASE;/g, '');
    content = content.replace(/window\.BASE_URL = .*?;/g, 'export const BASE_URL = API_BASE.replace(/\\/api$/, "");');
    
    content = content.replace(/\/\/ Export[\s\S]*$/m, `// Export\nexport { API_BASE, apiFetch, API, getToken, setToken, fetchUnreadCount, fetchFarmerStats };\n`);
    
    // Some minor patches
    content = content.replace(/window\.Auth/g, '(window.Auth || {})');
  }

  if (file.includes('auth.js')) {
    content = content.replace(/\/\/ Expose globally[\s\S]*$/m, `// Export\nexport default Auth;\n`);
    content = content.replace(/window\.Auth = Auth;/g, '');
  }

  if (file.includes('language.js')) {
    content = content.replace(/window\.t = t;/g, 'export { t };');
    content = content.replace(/window\.setLanguage = setLanguage;/g, 'export { setLanguage };');
    content = content.replace(/window\.translatePage = translatePage;/g, 'export { translatePage };');
    // Export standard helpers
    content += '\nexport { getCurrentLang, getSavedLang };\n';
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('Processed', file);
}

processFile('src/services/api.js');
processFile('src/services/auth.js');
processFile('src/services/language.js');
