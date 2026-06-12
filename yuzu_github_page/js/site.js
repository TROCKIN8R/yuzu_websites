(function initFloatLayer() {
    const layer = document.getElementById('floatLayer');
    if (!layer) return;
    for (let i = 0; i < 10; i++) {
        const el = document.createElement('span');
        el.className = 'float-lemon';
        el.textContent = '🍋';
        const dur = 18 + Math.random() * 22;
        el.style.left = `${Math.random() * 100}%`;
        el.style.fontSize = `${1 + Math.random() * 1.1}rem`;
        el.style.animationDuration = `${dur}s`;
        el.style.animationDelay = `-${Math.random() * dur}s`;
        layer.appendChild(el);
    }
    for (let i = 0; i < 6; i++) {
        const drop = document.createElement('div');
        drop.className = 'juice-drop';
        const dur = 12 + Math.random() * 16;
        drop.style.left = `${5 + Math.random() * 90}%`;
        drop.style.animationDuration = `${dur}s`;
        drop.style.animationDelay = `-${Math.random() * dur}s`;
        layer.appendChild(drop);
    }
})();
