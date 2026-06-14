(function initHeroRotate() {
    const rotator = document.querySelector('.hero-rotate');
    if (!rotator) return;

    const prefixEl = rotator.querySelector('.hero-rotate-prefix');
    const suffixEl = rotator.querySelector('.hero-rotate-suffix');
    const fallbackPrefix = prefixEl ? prefixEl.textContent : (rotator.dataset.prefix || '');
    const fallbackSuffix = suffixEl ? suffixEl.textContent : (rotator.dataset.suffix || '');

    function parsePhrases(raw) {
        return raw
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => {
                let prefix = fallbackPrefix;
                let wordPart = entry;

                if (entry.includes(':')) {
                    const splitAt = entry.indexOf(':');
                    prefix = entry.slice(0, splitAt);
                    wordPart = entry.slice(splitAt + 1);
                }

                if (wordPart.includes('|')) {
                    const splitAt = wordPart.indexOf('|');
                    return {
                        prefix,
                        word: wordPart.slice(0, splitAt).trim(),
                        suffix: wordPart.slice(splitAt + 1),
                    };
                }

                return { prefix, word: wordPart, suffix: fallbackSuffix };
            });
    }

    const phrases = parsePhrases(rotator.dataset.phrases || rotator.dataset.words || '');
    if (phrases.length < 2) return;

    const slot = rotator.querySelector('.hero-rotate-slot');
    const lineEl = rotator.querySelector('.hero-rotate-line');
    const wordEl = rotator.querySelector('.hero-rotate-word');
    const liveEl = document.getElementById('hero-rotate-live');
    if (!slot || !lineEl || !wordEl) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const intervalMs = reducedMotion ? 4000 : 2600;
    const animMs = reducedMotion ? 0 : 420;

    function fullPhrase(phrase) {
        return `${phrase.prefix}${phrase.word}${phrase.suffix}`;
    }

    function applyPhrase(phrase) {
        if (prefixEl) prefixEl.textContent = phrase.prefix;
        wordEl.textContent = phrase.word;
        if (suffixEl) suffixEl.textContent = phrase.suffix;
    }

    function announce(phrase) {
        if (liveEl) liveEl.textContent = fullPhrase(phrase);
    }

    function measureSlotWidth() {
        const probe = document.createElement('span');
        probe.className = lineEl.className;
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;';

        const prefixProbe = document.createElement('span');
        prefixProbe.className = prefixEl ? prefixEl.className : 'hero-rotate-prefix';
        const wordProbe = document.createElement('span');
        wordProbe.className = wordEl.className;
        const suffixProbe = document.createElement('span');
        suffixProbe.className = suffixEl ? suffixEl.className : 'hero-rotate-suffix';

        probe.append(prefixProbe, wordProbe, suffixProbe);
        rotator.appendChild(probe);

        let max = 0;
        for (const phrase of phrases) {
            prefixProbe.textContent = phrase.prefix;
            wordProbe.textContent = phrase.word;
            suffixProbe.textContent = phrase.suffix;
            max = Math.max(max, probe.offsetWidth);
        }

        rotator.removeChild(probe);
        slot.style.minWidth = `${max}px`;
    }

    let index = phrases.findIndex(
        (phrase) => phrase.word === wordEl.textContent.trim() && phrase.suffix === (suffixEl?.textContent ?? fallbackSuffix)
    );
    if (index < 0) index = 0;

    applyPhrase(phrases[index]);
    measureSlotWidth();
    announce(phrases[index]);

    function showNext() {
        const nextIndex = (index + 1) % phrases.length;
        const nextPhrase = phrases[nextIndex];

        if (reducedMotion || animMs === 0) {
            applyPhrase(nextPhrase);
            index = nextIndex;
            announce(nextPhrase);
            window.setTimeout(showNext, intervalMs);
            return;
        }

        lineEl.classList.add('hero-rotate-line--out');
        void lineEl.offsetWidth;

        window.setTimeout(() => {
            applyPhrase(nextPhrase);
            lineEl.classList.remove('hero-rotate-line--out');
            lineEl.classList.add('hero-rotate-line--in');
            void lineEl.offsetWidth;
            lineEl.classList.remove('hero-rotate-line--in');

            index = nextIndex;
            announce(nextPhrase);
            window.setTimeout(showNext, intervalMs);
        }, animMs);
    }

    window.setTimeout(showNext, intervalMs);
})();
