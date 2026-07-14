
// ── Mouse text displacement effect ──
(function () {
    var MOUSE_GAP = 15;
    var LERP_PUSH = 0.24;
    var LERP_RETURN = 0.040;
    var TRAIL_MAX = 12;
    var TRAIL_TTL = 120;
    var trail = [];
    var mouseX = -9999, mouseY = -9999;

    document.addEventListener('mousemove', function (e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        if (trail.length > TRAIL_MAX) trail.shift();
    });

    var blocks = [];

    function buildSpans(el) {
        var text = el.textContent;
        el.innerHTML = '';
        for (var i = 0; i < text.length; i++) {
            var s = document.createElement('span');
            s.className = 'char-span';
            s.textContent = text[i];
            el.appendChild(s);
        }
    }

    function setupBlock(el) {
        var elRect = el.getBoundingClientRect();
        var spans = el.querySelectorAll('span.char-span');
        var chars = [];

        for (var i = 0; i < spans.length; i++) {
            var sp = spans[i];
            var r = sp.getBoundingClientRect();
            chars.push({
                el: sp,
                rx: r.left - elRect.left,
                ry: r.top - elRect.top,
                w: r.width,
                h: r.height,
                offset: 0,
                target: 0,
                lastPx: null
            });
        }

        var lines = [];
        var cur = [];
        var curY = -99999;
        for (var ci = 0; ci < chars.length; ci++) {
            var c = chars[ci];
            if (cur.length === 0 || Math.abs(c.ry - curY) < c.h * 0.8) {
                cur.push(c);
                if (cur.length === 1) curY = c.ry;
            } else {
                lines.push(cur);
                cur = [c];
                curY = c.ry;
            }
        }
        if (cur.length) lines.push(cur);

        var vRange;
        if (lines.length >= 2) {
            var totalSpacing = 0;
            for (var li = 0; li < lines.length - 1; li++) {
                totalSpacing += lines[li + 1][0].ry - lines[li][0].ry;
            }
            vRange = (totalSpacing / (lines.length - 1)) * 0.75;
        } else {
            vRange = (lines.length > 0 && lines[0].length > 0)
                ? lines[0][0].h * 1.2
                : 20;
        }

        var cfg = {
            gap: MOUSE_GAP,
            vRange: vRange,
            lerpPush: LERP_PUSH,
            lerpReturn: LERP_RETURN
        };
        blocks.push({ el: el, chars: chars, lines: lines, cfg: cfg });
    }

    function bestFromTrail(lineY, lL, lR, gap, vRange) {
        var bestInf = 0, bestX = mouseX;
        var xpad = gap + 4;

        for (var ti = 0; ti < trail.length; ti++) {
            var tp = trail[ti];

            if (tp.x >= lL - xpad && tp.x <= lR + xpad) {
                var tdy = Math.abs(tp.y - lineY);
                var tinf = Math.max(0, 1 - tdy / vRange);
                if (tinf > bestInf) { bestInf = tinf; bestX = tp.x; }
            }

            if (ti > 0) {
                var ta = trail[ti - 1];
                var dy0 = ta.y - lineY;
                var segDy = tp.y - ta.y;
                var tStar = (Math.abs(segDy) < 0.5)
                    ? 0
                    : Math.max(0, Math.min(1, -dy0 / segDy));
                var crossX = ta.x + tStar * (tp.x - ta.x);
                var crossY = ta.y + tStar * segDy;

                if (crossX >= lL - xpad && crossX <= lR + xpad) {
                    var cdy = Math.abs(crossY - lineY);
                    var cinf = Math.max(0, 1 - cdy / vRange);
                    if (cinf > bestInf) { bestInf = cinf; bestX = crossX; }
                }
            }
        }
        return { inf: bestInf, mx: bestX };
    }

    function tick() {
        var now = performance.now();
        while (trail.length > 2 && now - trail[0].t > TRAIL_TTL) trail.shift();

        for (var bi = 0; bi < blocks.length; bi++) {
            var block = blocks[bi];
            var cfg = block.cfg;

            for (var li = 0; li < block.lines.length; li++) {
                var line = block.lines[li];
                var nChar = line.length;
                if (nChar < 2) { if (nChar === 1) line[0].target = 0; continue; }

                var first = line[0];
                var last = line[nChar - 1];
                // FIREFOX FIX: use first span rect, not parent rect
                var firstR = first.el.getBoundingClientRect();
                var lL = firstR.left - first.offset;
                var lineY = firstR.top + first.h * 0.5;
                var lR = lL + (last.rx - first.rx) + last.w;
                var firstCC = lL + first.w * 0.5;
                var lastCC = lR - last.w * 0.5;

                var best = bestFromTrail(lineY, lL, lR, cfg.gap, cfg.vRange);
                var inf = best.inf;

                if (inf < 0.001) { for (var n = 0; n < nChar; n++) line[n].target = 0; continue; }

                var mx = Math.max(lL, Math.min(lR, best.mx));
                var leftSpan = mx - firstCC;
                var rightSpan = lastCC - mx;
                var desiredGap = cfg.gap * inf;
                var gapL = desiredGap;
                var gapR = desiredGap;

                {
                    var safeL = leftSpan > 0 ? leftSpan : 0;
                    var safeR = rightSpan > 0 ? rightSpan : 0;

                    for (var k = 0; k < nChar - 1; k++) {
                        var ca = line[k];
                        var cb = line[k + 1];
                        var ccA = lL + (ca.rx - first.rx) + ca.w * 0.5;
                        var ccB = lL + (cb.rx - first.rx) + cb.w * 0.5;
                        var adv = ccB - ccA;
                        var minD = (ca.w + cb.w) * 0.5;
                        if (adv <= minD || adv < 0.5) continue;
                        var frac = 1 - minD / adv;
                        if (ccB <= mx && leftSpan > 0.5) {
                            var capL = leftSpan * frac; if (capL < safeL) safeL = capL;
                        } else if (ccA > mx && rightSpan > 0.5) {
                            var capR = rightSpan * frac; if (capR < safeR) safeR = capR;
                        }
                    }
                    gapL = Math.min(gapL, Math.max(0, safeL));
                    gapR = Math.min(gapR, Math.max(0, safeR));
                }

                for (var ci = 0; ci < nChar; ci++) {
                    var ch = line[ci];
                    var cc = lL + (ch.rx - first.rx) + ch.w * 0.5;
                    var newCC;
                    if (cc <= mx) {
                        newCC = (leftSpan > 0.5)
                            ? firstCC + (cc - firstCC) / leftSpan * (leftSpan - gapL)
                            : cc;
                    } else {
                        newCC = (rightSpan > 0.5)
                            ? lastCC - (lastCC - cc) / rightSpan * (rightSpan - gapR)
                            : cc + gapR;
                    }
                    ch.target = newCC - cc;
                }
                // EDGE PINNING: first and last chars never move
                line[0].target = 0;
                line[nChar - 1].target = 0;
            }

            for (var ci2 = 0; ci2 < block.chars.length; ci2++) {
                var ch2 = block.chars[ci2];
                var d = ch2.target - ch2.offset;
                var ret = (Math.abs(ch2.target) < Math.abs(ch2.offset) - 0.08);
                var lf = ret ? cfg.lerpReturn : cfg.lerpPush;
                if (Math.abs(d) > 0.04) { ch2.offset += d * lf; }
                else { ch2.offset = ch2.target; }
                var px = Math.round(ch2.offset * 100) / 100;
                if (ch2.lastPx !== px) { ch2.el.style.left = px + 'px'; ch2.lastPx = px; }
            }
        }
        requestAnimationFrame(tick);
    }

    var selectors = [
        '.ga-headline',
        '.ga-body-text',
        '.ga-quote-text',
        '.ga-founder-bio',
        '.ga-capability h3',
        '.ga-capability p',
        '.ga-team-group p:not(.ga-team-label)',
        '.ga-cta-body',
        '.ga-section-left .ga-label',
        '.ga-trusted-left .ga-label',
        '.ga-team-label',
        '.ga-team-group h3'
    ];

    function setupBlockChildren(el) {
        var elRect = el.getBoundingClientRect();
        var children = el.children;
        var chars = [];

        for (var i = 0; i < children.length; i++) {
            var ch = children[i];
            var r = ch.getBoundingClientRect();
            chars.push({
                el: ch,
                rx: r.left - elRect.left,
                ry: r.top - elRect.top,
                w: r.width,
                h: r.height,
                offset: 0,
                target: 0,
                lastPx: null
            });
        }

        var lines = [];
        var cur = [];
        var curY = -99999;
        for (var ci = 0; ci < chars.length; ci++) {
            var c = chars[ci];
            if (cur.length === 0 || Math.abs(c.ry - curY) < c.h * 0.8) {
                cur.push(c);
                if (cur.length === 1) curY = c.ry;
            } else {
                lines.push(cur);
                cur = [c];
                curY = c.ry;
            }
        }
        if (cur.length) lines.push(cur);

        var vRange;
        if (lines.length >= 2) {
            var totalSpacing = 0;
            for (var li = 0; li < lines.length - 1; li++) {
                totalSpacing += lines[li + 1][0].ry - lines[li][0].ry;
            }
            vRange = (totalSpacing / (lines.length - 1)) * 0.75;
        } else {
            vRange = (lines.length > 0 && lines[0].length > 0)
                ? lines[0][0].h * 1.2
                : 20;
        }

        var cfg = {
            gap: MOUSE_GAP,
            vRange: vRange,
            lerpPush: LERP_PUSH,
            lerpReturn: LERP_RETURN
        };
        blocks.push({ el: el, chars: chars, lines: lines, cfg: cfg });
    }

    var blockChildEls = [];

    document.fonts.ready.then(function () {
        var els = document.querySelectorAll(selectors.join(', '));
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (el.querySelector('br')) {
                var html = el.innerHTML;
                var parts = html.split('<br>');
                el.innerHTML = '';
                for (var p = 0; p < parts.length; p++) {
                    if (p > 0) el.appendChild(document.createElement('br'));
                    var wrapper = document.createElement('span');
                    wrapper.className = 'line-wrapper';
                    wrapper.style.display = 'inline';
                    var text = parts[p].replace(/<[^>]*>/g, '');
                    for (var c = 0; c < text.length; c++) {
                        var sp = document.createElement('span');
                        sp.className = 'char-span';
                        sp.textContent = text[c];
                        wrapper.appendChild(sp);
                    }
                    el.appendChild(wrapper);
                }
            } else {
                buildSpans(el);
            }
            el.classList.add('displacement-active');
            setupBlock(el);
        }

        var tagsContainer = document.querySelector('.ga-industries-tags');
        if (tagsContainer) {
            tagsContainer.classList.add('displacement-active');
            setupBlockChildren(tagsContainer);
            blockChildEls.push(tagsContainer);
        }

        var badgesContainer = document.querySelector('.ga-badges');
        if (badgesContainer) {
            badgesContainer.classList.add('displacement-active');
            setupBlockChildren(badgesContainer);
            blockChildEls.push(badgesContainer);
        }

        requestAnimationFrame(tick);
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            var old = blocks.splice(0);
            for (var i = 0; i < old.length; i++) {
                var isBlockChild = blockChildEls.indexOf(old[i].el) !== -1;
                if (isBlockChild) {
                    var children = old[i].el.children;
                    for (var j = 0; j < children.length; j++) children[j].style.left = '0';
                    setupBlockChildren(old[i].el);
                } else {
                    var sp = old[i].el.querySelectorAll('span.char-span');
                    for (var j = 0; j < sp.length; j++) sp[j].style.left = '0';
                    setupBlock(old[i].el);
                }
            }
        }, 200);
    });

}());
