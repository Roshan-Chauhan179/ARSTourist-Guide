(() => {
  if (window.__arsTranslatorLoaded) return;
  window.__arsTranslatorLoaded = true;
  const supportedLanguages = 'hi,en,gu,mr,bn,te,ta,kn,ml,pa';
  const savedLanguage = localStorage.getItem('arsLanguage') || '';

  const setLanguage = language => {
    if (!language) return;
    localStorage.setItem('arsLanguage', language);
    document.cookie = `googtrans=/en/${language}; path=/; SameSite=Lax`;
    window.location.reload();
  };

  window.changeSiteLanguage = setLanguage;
  document.addEventListener('DOMContentLoaded', () => {
    const picker = document.getElementById('languageSelect');
    if (picker) {
      picker.value = savedLanguage;
      picker.addEventListener('change', event => setLanguage(event.target.value));
    }
  });

  if (savedLanguage && savedLanguage !== 'en') document.cookie = `googtrans=/en/${savedLanguage}; path=/; SameSite=Lax`;
  window.googleTranslateElementInit = () => {
    const holder = document.createElement('div');
    holder.id = 'ars_google_translate';
    holder.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden';
    document.body.appendChild(holder);
    new google.translate.TranslateElement({ pageLanguage: 'en', includedLanguages: supportedLanguages, autoDisplay: false }, holder.id);
  };

  const script = document.createElement('script');
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.async = true;
  document.head.appendChild(script);
})();
