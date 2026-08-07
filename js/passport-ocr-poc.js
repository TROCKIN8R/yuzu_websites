/**
 * Standalone passport MRZ OCR proof of concept.
 * Everything stays in the browser — no upload, save, or network POST of images.
 */
(function () {
    const MAX_BYTES = 8 * 1024 * 1024;
    const ACCEPT = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

    const fileInput = document.getElementById('poc-file');
    const scanBtn = document.getElementById('poc-scan');
    const parseBtn = document.getElementById('poc-parse-text');
    const clearBtn = document.getElementById('poc-clear');
    const statusEl = document.getElementById('poc-status');
    const previewEl = document.getElementById('poc-preview');
    const previewImg = document.getElementById('poc-preview-img');
    const rawEl = document.getElementById('poc-raw');
    const form = document.getElementById('poc-form');
    const dropZone = document.getElementById('poc-drop');

    let objectUrl = null;
    let workerPromise = null;

    function setStatus(message, isError) {
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.hidden = !message;
        statusEl.classList.toggle('poc-status--error', Boolean(isError));
        statusEl.classList.toggle('poc-status--ok', Boolean(message) && !isError);
    }

    function setBusy(busy) {
        if (scanBtn) scanBtn.disabled = busy || !fileInput?.files?.length;
        if (parseBtn) parseBtn.disabled = busy;
        if (fileInput) fileInput.disabled = busy;
        if (clearBtn) clearBtn.disabled = busy;
    }

    function clearForm() {
        if (!form) return;
        form.reset();
        if (rawEl) rawEl.value = '';
    }

    function revokePreview() {
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
        }
        if (previewImg) {
            previewImg.removeAttribute('src');
            previewImg.hidden = true;
        }
        if (previewEl) previewEl.hidden = true;
    }

    function yyMmDdToIso(yymmdd, kind) {
        if (!yymmdd || !/^\d{6}$/.test(yymmdd)) return '';
        const yy = Number(yymmdd.slice(0, 2));
        const mm = yymmdd.slice(2, 4);
        const dd = yymmdd.slice(4, 6);
        const now = new Date();
        const currentYear = now.getFullYear();
        const y1900 = 1900 + yy;
        const y2000 = 2000 + yy;
        let year;
        if (kind === 'birth') {
            // Prefer the date that is not in the future
            year = y2000 <= currentYear ? y2000 : y1900;
        } else {
            // Expiry: prefer the date not more than ~20 years in the past
            const cutoff = currentYear - 20;
            year = y2000 >= cutoff ? y2000 : y1900;
            if (y1900 >= cutoff && y1900 <= currentYear + 15) year = y1900;
            if (y2000 >= cutoff) year = y2000;
        }
        return `${year}-${mm}-${dd}`;
    }

    function sexLabel(code) {
        const c = String(code || '').trim().toLowerCase();
        if (c === 'm' || c === 'male') return 'Male';
        if (c === 'f' || c === 'female') return 'Female';
        if (c === 'x' || c === '<' || c === 'unspecified' || c === 'nonspecified') return 'Unspecified';
        return code || '';
    }

    function fillField(name, value) {
        const el = form?.elements?.namedItem(name);
        if (!el || value == null || value === '') return;
        el.value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function applyParsed(result) {
        const fields = result?.fields || {};
        const last = fields.lastName || fields.surname || '';
        const first = Array.isArray(fields.firstName)
            ? fields.firstName.join(' ')
            : (fields.firstName || fields.givenNames || '');

        fillField('familyName', last.replace(/</g, ' ').replace(/\s+/g, ' ').trim());
        fillField('givenName', String(first).replace(/</g, ' ').replace(/\s+/g, ' ').trim());
        fillField('sex', sexLabel(fields.sex));
        fillField('nationality', fields.nationality || '');
        fillField('issuingState', fields.issuingState || fields.nationality || '');
        fillField('passportNumber', fields.documentNumber || '');
        fillField('dob', yyMmDdToIso(fields.birthDate, 'birth'));
        fillField('expiry', yyMmDdToIso(fields.expirationDate || fields.expiryDate, 'expiry'));
        fillField('personalNumber', (fields.personalNumber || '').replace(/</g, '').trim());
        fillField('documentCode', fields.documentCode || '');
    }

    /**
     * MRZ filler `<` is very often OCR'd as K (also L/C in padding).
     * Do NOT treat I as a global `<` stand-in — that destroys names like ERIKSSON.
     */
    function fixChevronConfusions(line) {
        let s = String(line || '').toUpperCase();

        // Document type is almost always P<…, not PK…
        if (s.startsWith('PK')) s = `P<${s.slice(2)}`;
        if (s.startsWith('IK') && !/^IK[A-Z]{2}/.test(s)) s = `I<${s.slice(2)}`;
        if (s.startsWith('AK')) s = `A<${s.slice(2)}`;
        if (s.startsWith('CK')) s = `C<${s.slice(2)}`;

        // K touching a chevron is always a chevron
        let prev;
        do {
            prev = s;
            s = s.replace(/K</g, '<<').replace(/<K/g, '<<');
            // L/C next to chevron in filler (safe); avoid I here
            s = s.replace(/[LC]</g, '<<').replace(/<[LC]/g, '<<');
        } while (s !== prev);

        // Runs of K (the main < confusion) → chevrons
        s = s.replace(/K{2,}/g, (m) => '<'.repeat(m.length));

        // Lone K not between two letters → chevron (keeps ERIKSSON / MARK)
        s = s.replace(/(?<![A-Z])K(?![A-Z])/g, '<');

        return s;
    }

    function sanitizeTd3Line(line, lineIndex) {
        let s = String(line || '')
            .toUpperCase()
            .replace(/[«»|]/g, '<')
            .replace(/[^A-Z0-9<]/g, '');

        s = fixChevronConfusions(s);

        if (lineIndex === 0) {
            const sep = s.indexOf('<<');
            if (sep >= 0) {
                const head = s.slice(0, sep + 2);
                let rest = s.slice(sep + 2);
                // Given names then padding — scrub K/L/C/I/1 only in the pad
                rest = rest.replace(/^([A-Z]+(?:<[A-Z]+)*)(.*)$/, (_, names, pad) => (
                    names + String(pad || '').replace(/[KLC1I]/g, '<')
                ));
                s = head + rest;
            }
            s = s.replace(/[KLC1I]+$/g, (m) => '<'.repeat(m.length));
        } else {
            // Line 2: optional data (pos 28+) is often filler <; fix K there, not digits
            if (s.length >= 28) {
                const head = s.slice(0, 28);
                let tail = s.slice(28);
                tail = fixChevronConfusions(tail);
                // Runs of L/C in optional filler (not single digits)
                tail = tail.replace(/[LC]{2,}/g, (m) => '<'.repeat(m.length));
                tail = tail.replace(/[KLC]+$/g, (m) => '<'.repeat(m.length));
                s = head + tail;
            }
            s = s.replace(/[KLC]+$/g, (m) => '<'.repeat(m.length));
        }

        if (s.length > 44) s = s.slice(0, 44);
        if (s.length >= 40 && s.length < 44) s = s.padEnd(44, '<');
        if (s.length === 44) s = fixChevronConfusions(s);
        return s;
    }

    /** Extra candidates: also try aggressive K→< when check digits fail. */
    function expandLineVariants(line, lineIndex) {
        const base = sanitizeTd3Line(line, lineIndex);
        const variants = new Set();
        if (base.length === 44) variants.add(base);

        const raw = String(line || '')
            .toUpperCase()
            .replace(/[«»|]/g, '<')
            .replace(/[^A-Z0-9<]/g, '');

        // Aggressive: every K → < (may break rare names with filler-looking K; ranked by check digits)
        const aggressive = sanitizeTd3Line(raw.replace(/K/g, '<'), lineIndex);
        if (aggressive.length === 44) variants.add(aggressive);

        // Keep interior name K only
        const keepNameK = sanitizeTd3Line(
            raw.replace(/(?<![A-Z])K(?![A-Z])/g, '<').replace(/K{2,}/g, (m) => '<'.repeat(m.length)),
            lineIndex,
        );
        if (keepNameK.length === 44) variants.add(keepNameK);

        return [...variants];
    }

    function extractMrzCandidates(ocrText) {
        const cleaned = String(ocrText || '')
            .toUpperCase()
            .replace(/\u003c/g, '<')
            .replace(/[|\u00AB\u00BB«»]/g, '<');

        const lines = cleaned
            .split(/[\r\n]+/)
            .map((line) => line.replace(/[^A-Z0-9<]/g, ''))
            .filter((line) => line.length >= 30);

        const candidates = [];
        const pushPair = (aRaw, bRaw) => {
            const aVars = expandLineVariants(aRaw, 0);
            const bVars = expandLineVariants(bRaw, 1);
            for (const a of aVars) {
                for (const b of bVars) {
                    candidates.push([a, b]);
                }
            }
        };

        for (let i = 0; i < lines.length - 1; i++) {
            const a = lines[i];
            const b = lines[i + 1];
            if (/^P[A-Z<]/.test(a) || (a.length >= 40 && b.length >= 40)) {
                pushPair(a, b);
            }
        }

        const withP = lines.filter((l) => /^P[A-Z<]/.test(l));
        const others = lines.filter((l) => !/^P[A-Z<]/.test(l) && l.length >= 40);
        if (withP.length && others.length) {
            pushPair(withP[0], others[0]);
        }

        // Prefer pairs whose first line looks like a passport MRZ
        candidates.sort((x, y) => {
            const score = (pair) => (/^P[A-Z<]/.test(pair[0]) ? 2 : 0) + (pair[0].includes('<<') ? 1 : 0);
            return score(y) - score(x);
        });

        const seen = new Set();
        return candidates.filter(([a, b]) => {
            if (a.length !== 44 || b.length !== 44) return false;
            const key = `${a}\n${b}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    async function getParse() {
        const mod = await import('https://esm.sh/mrz@4.2.1');
        return mod.parse;
    }

    async function parseBest(candidates) {
        const parse = await getParse();
        let best = null;
        const attempts = [];

        for (const lines of candidates) {
            try {
                const result = parse(lines.join('\n'), { autocorrect: true });
                attempts.push({ lines, ok: true, details: result.details, valid: result.valid });
                if (result.valid) return { result, lines, attempts };
                if (!best || (result.details?.filter((d) => d.valid).length || 0) >
                    (best.result.details?.filter((d) => d.valid).length || 0)) {
                    best = { result, lines, attempts };
                }
            } catch (err) {
                attempts.push({ lines, ok: false, error: err instanceof Error ? err.message : String(err) });
            }
        }

        if (best) return { ...best, attempts };
        return { result: null, lines: candidates[0] || null, attempts };
    }

    /**
     * Crop bottom band (MRZ zone) and return a few preprocess variants.
     * Hard binarization often turns `<` into K-like blobs — keep a soft grayscale too.
     */
    async function prepareMrzCanvases(file) {
        const bitmap = await createImageBitmap(file);
        const w = bitmap.width;
        const h = bitmap.height;
        const bandTop = Math.floor(h * 0.58);
        const bandH = h - bandTop;
        const scale = Math.min(3.2, Math.max(2.2, Math.ceil(1000 / Math.max(w, 1))));
        const cw = Math.round(w * scale);
        const ch = Math.round(bandH * scale);

        const drawBand = () => {
            const canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) throw new Error('Canvas not available');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, cw, ch);
            ctx.drawImage(bitmap, 0, bandTop, w, bandH, 0, 0, cw, ch);
            return { canvas, ctx };
        };

        const soft = drawBand();
        {
            const imageData = soft.ctx.getImageData(0, 0, cw, ch);
            const d = imageData.data;
            for (let i = 0; i < d.length; i += 4) {
                const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                // Gentle contrast — preserves thin chevrons better than hard threshold
                const v = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128));
                d[i] = d[i + 1] = d[i + 2] = v;
            }
            soft.ctx.putImageData(imageData, 0, 0);
        }

        const hard = drawBand();
        {
            const imageData = hard.ctx.getImageData(0, 0, cw, ch);
            const d = imageData.data;
            for (let i = 0; i < d.length; i += 4) {
                const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                const v = Math.max(0, Math.min(255, (gray - 128) * 1.55 + 128));
                const bw = v > 150 ? 255 : 0;
                d[i] = d[i + 1] = d[i + 2] = bw;
            }
            hard.ctx.putImageData(imageData, 0, 0);
        }

        bitmap.close();
        return [soft.canvas, hard.canvas];
    }

    async function getWorker() {
        if (!workerPromise) {
            if (typeof Tesseract === 'undefined') {
                throw new Error('Tesseract.js failed to load');
            }
            workerPromise = (async () => {
                const worker = await Tesseract.createWorker('eng', 1, {
                    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
                    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js',
                    langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int',
                });
                await worker.setParameters({
                    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
                    preserve_interword_spaces: '0',
                    tessedit_pageseg_mode: Tesseract.PSM?.SINGLE_BLOCK ?? '6',
                });
                return worker;
            })();
        }
        return workerPromise;
    }

    async function runOcr(file) {
        setStatus('Preparing image (MRZ band)…');
        const canvases = await prepareMrzCanvases(file);

        setStatus('Loading OCR engine (first run may take a moment)…');
        const worker = await getWorker();

        const ocrChunks = [];
        let candidates = [];

        for (let i = 0; i < canvases.length; i++) {
            setStatus(`Reading MRZ (${i === 0 ? 'soft contrast' : 'high contrast'})…`);
            const { data } = await worker.recognize(canvases[i]);
            const text = data?.text || '';
            ocrChunks.push(`--- pass ${i + 1} ---\n${text}`);
            candidates = candidates.concat(extractMrzCandidates(text));
        }

        // Deduplicate candidate pairs
        const seen = new Set();
        candidates = candidates.filter(([a, b]) => {
            const key = `${a}\n${b}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        let ocrText = ocrChunks.join('\n\n');

        if (!candidates.length) {
            setStatus('Band OCR weak — trying full image…');
            const full = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            const scale = Math.min(2, Math.max(1, 1200 / Math.max(full.width, 1)));
            canvas.width = Math.round(full.width * scale);
            canvas.height = Math.round(full.height * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(full, 0, 0, canvas.width, canvas.height);
            full.close();
            const { data } = await worker.recognize(canvas);
            ocrText = `${ocrText}\n\n--- full image ---\n${data?.text || ''}`;
            candidates = extractMrzCandidates(data?.text || '');
        }

        if (rawEl) {
            rawEl.value = ocrText;
        }

        if (!candidates.length) {
            return {
                ok: false,
                ocrText,
                error: 'No MRZ-like lines found. Try a sharper, flatter photo of the passport data page (bottom two lines visible).',
            };
        }

        setStatus(`Found ${candidates.length} candidate pair(s). Parsing…`);
        const { result, lines, attempts } = await parseBest(candidates);

        if (!result) {
            return {
                ok: false,
                ocrText,
                lines,
                attempts,
                error: 'OCR found lines but MRZ parse failed. Check raw OCR below and try a clearer photo.',
            };
        }

        return {
            ok: true,
            ocrText,
            result,
            lines,
            attempts,
            valid: result.valid,
        };
    }

    /** Parse pasted/raw MRZ text without OCR (for isolating parser quality). */
    async function runParseOnly(text) {
        const candidates = extractMrzCandidates(text);
        if (!candidates.length && text.trim()) {
            const rawLines = text.toUpperCase().split(/[\r\n]+/)
                .map((l) => l.replace(/[^A-Z0-9<]/g, ''))
                .filter(Boolean);
            if (rawLines.length >= 2) {
                candidates.push([
                    rawLines[0].padEnd(44, '<').slice(0, 44),
                    rawLines[1].padEnd(44, '<').slice(0, 44),
                ]);
            }
        }
        if (!candidates.length) {
            return { ok: false, error: 'Need two MRZ lines to parse.' };
        }
        const { result, lines, attempts } = await parseBest(candidates);
        if (!result) {
            return { ok: false, lines, attempts, error: 'MRZ parse failed.' };
        }
        return { ok: true, result, lines, attempts, valid: result.valid };
    }

    function onFileChosen(file) {
        clearForm();
        revokePreview();
        setStatus('');

        if (!file) {
            setBusy(false);
            return;
        }

        if (file.size > MAX_BYTES) {
            setStatus('Image is too large (max 8 MB).', true);
            fileInput.value = '';
            return;
        }

        // HEIC often has empty/odd type in some browsers — still allow by extension
        const okType = ACCEPT.has(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
        if (!okType) {
            setStatus('Use a JPEG, PNG, or WebP image of the passport data page.', true);
            fileInput.value = '';
            return;
        }

        objectUrl = URL.createObjectURL(file);
        if (previewImg) {
            previewImg.src = objectUrl;
            previewImg.hidden = false;
        }
        if (previewEl) previewEl.hidden = false;
        if (scanBtn) scanBtn.disabled = false;
        setStatus(`Ready: ${file.name} (${Math.round(file.size / 1024)} KB). Click “Scan & fill”.`);
    }

    async function onScan() {
        const file = fileInput?.files?.[0];
        if (!file) {
            setStatus('Choose a passport image first.', true);
            return;
        }

        setBusy(true);
        try {
            const out = await runOcr(file);
            if (rawEl && out.lines) {
                rawEl.value = [
                    '=== OCR text ===',
                    out.ocrText.trim(),
                    '',
                    '=== Best MRZ candidate ===',
                    (out.lines || []).join('\n'),
                    '',
                    out.attempts ? `=== Attempts: ${out.attempts.length} ===` : '',
                ].filter(Boolean).join('\n');
            }

            if (!out.ok) {
                setStatus(out.error, true);
                return;
            }

            applyParsed(out.result);
            const validNote = out.valid
                ? 'All MRZ check digits valid.'
                : 'Parsed with some check-digit warnings — verify every field.';
            setStatus(`Filled from MRZ. ${validNote} Nothing was uploaded or saved.`, false);
        } catch (err) {
            console.error(err);
            setStatus(err instanceof Error ? err.message : String(err), true);
        } finally {
            setBusy(false);
            if (scanBtn) scanBtn.disabled = !fileInput?.files?.length;
        }
    }

    async function onParseText() {
        const text = (rawEl?.value || '').trim();
        if (!text) {
            setStatus('Paste two MRZ lines into the debug box (section 03), then click Parse MRZ text.', true);
            rawEl?.focus();
            return;
        }

        setBusy(true);
        try {
            const out = await runParseOnly(text);
            if (out.lines && rawEl) {
                rawEl.value = [
                    text,
                    '',
                    '=== Parsed candidate ===',
                    out.lines.join('\n'),
                ].join('\n');
            }
            if (!out.ok) {
                setStatus(out.error, true);
                return;
            }
            applyParsed(out.result);
            setStatus(
                out.valid
                    ? 'Filled from pasted MRZ. All check digits valid.'
                    : 'Filled from pasted MRZ with check-digit warnings — verify fields.',
                false,
            );
        } catch (err) {
            console.error(err);
            setStatus(err instanceof Error ? err.message : String(err), true);
        } finally {
            setBusy(false);
            if (scanBtn) scanBtn.disabled = !fileInput?.files?.length;
        }
    }

    function onClear() {
        if (fileInput) fileInput.value = '';
        clearForm();
        if (rawEl) rawEl.value = '';
        revokePreview();
        setStatus('Cleared. Image never left this browser.');
        setBusy(false);
        if (scanBtn) scanBtn.disabled = true;
    }

    fileInput?.addEventListener('change', () => {
        onFileChosen(fileInput.files?.[0] || null);
    });

    scanBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        onScan();
    });

    parseBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        onParseText();
    });

    clearBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        onClear();
    });

    ['dragenter', 'dragover'].forEach((evt) => {
        dropZone?.addEventListener(evt, (e) => {
            e.preventDefault();
            dropZone.classList.add('poc-drop--active');
        });
    });
    ['dragleave', 'drop'].forEach((evt) => {
        dropZone?.addEventListener(evt, (e) => {
            e.preventDefault();
            dropZone.classList.remove('poc-drop--active');
        });
    });
    dropZone?.addEventListener('drop', (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (!file || !fileInput) return;
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        onFileChosen(file);
    });

    setBusy(false);
    if (scanBtn) scanBtn.disabled = true;
    setStatus('Choose a passport data-page image. OCR runs locally — nothing is sent.');
})();
