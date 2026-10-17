/*
  Jury Verdict - score card template builder for After Effects (2020+).

  File > Scripts > Run Script File... > JuryVerdict.jsx
  Builds two comps in a "Jury Verdict" folder:
    * Verdict - Scores          (6.5 s)   four criteria
    * Verdict - Scores + Total  (10.5 s)  four criteria collapse into the weighted total

  Edit the numbers in Essential Graphics (or on the CONTROLS layer).
  Everything else is driven by expressions, so nothing has to be re-keyed.
  Requires Neue Montreal (NeueMontreal-Regular / -Medium) installed in the system.
  Neue Montreal has no Cyrillic, so Russian labels use FONT_CYRILLIC (Inter; swap it for any installed font).
*/

(function () {
    var W = 2560, H = 1600, FPS = 30;

    var PAPER = [0.929, 0.922, 0.902];   // #EDEBE6
    var COLUMN = [0.067, 0.067, 0.067];  // #111111
    var BLACK = [0, 0, 0];
    var INK = [0.04, 0.04, 0.04];        // type on the paper band

    var FONT_REGULAR = "NeueMontreal-Regular";
    var FONT_MEDIUM = "NeueMontreal-Medium";
    var FONT_CYRILLIC = "Inter-Medium";          // Neue Montreal has no Cyrillic; Inter is free (rsms.me/inter)
    var FONT_CYRILLIC_REGULAR = "Inter-Regular";

    var TOTAL_LABEL = "\u0418\u0442\u043E\u0433\u043E\u0432\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430";
    var TOTAL_SUBLABEL = "\u0421\u0440\u0435\u0434\u043D\u0435\u0432\u0437\u0432\u0435\u0448\u0435\u043D\u043D\u044B\u0439 \u0431\u0430\u043B\u043B";

    var CRITERIA = [
        { name: "Design", weight: 40, score: 7.2 },
        { name: "UX", weight: 30, score: 7.2 },
        { name: "Creativity", weight: 20, score: 7.0 },
        { name: "Content", weight: 10, score: 6.7 }
    ];

    var G = {
        M: 96, TOP: 200, BOTTOM: 1400, COLW: 592, PADX: 32,
        HEAD_Y: 284, HEAD_SIZE: 44, WEIGHT_SIZE: 32,
        SIZE: 340, LH: 408, CAPH: 245, GAP: 36, PAD: 20,
        T_SIZE: 900, T_LH: 1080, T_CAPH: 648, T_PAD: 50, T_BASE: 1280,
        DOTX: 1100, SEP: 95, DOT_R: 58,
        SITE_SIZE: 34, SCALE_SIZE: 22
    };

    var TIMING_SCORES = {
        rules0: 0.0, rulesDur: 1.2, corner0: 0.3,
        head0: 0.4, hstag: 0.1, headDur: 1.1,
        roll0: 0.6, stag: 0.15, rollDur: 2.0,
        numOut0: 99, align0: 99, alignDur: 1, rulesOut0: 5.2, rulesOutDur: 1.0, headOut0: 5.2,
        band0: 99, bandDur: 1, total0: 99, totalDur: 1, dot: 99, lbl0: 99,
        out0: 5.2, outDur: 1.0, duration: 6.5
    };

    var TIMING_TOTAL = {
        rules0: 0.0, rulesDur: 1.2, corner0: 0.3,
        head0: 0.4, hstag: 0.1, headDur: 1.1,
        roll0: 0.6, stag: 0.15, rollDur: 2.0,
        numOut0: 4.2, align0: 4.4, alignDur: 1.2, rulesOut0: 4.9, rulesOutDur: 0.9, headOut0: 5.3,
        band0: 5.5, bandDur: 1.3, total0: 6.1, totalDur: 1.9, dot: 7.5, lbl0: 6.4,
        out0: 9.4, outDur: 1.0, duration: 10.5
    };

    // ---------------------------------------------------------------- helpers

    function serialize(obj) {
        var parts = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) parts.push(k + ":" + obj[k]);
        }
        return "{" + parts.join(",") + "}";
    }

    // Shared expression prelude: timing, easing, scores, weighted total, column level.
    function prelude(T, withTotal) {
        var names = [];
        for (var i = 0; i < CRITERIA.length; i++) names.push('"' + CRITERIA[i].name + '"');
        return [
            'var C = thisComp.layer("CONTROLS");',
            'var NAMES = [' + names.join(",") + '];',
            'var T = ' + serialize(T) + ';',
            'var WT = ' + (withTotal ? 1 : 0) + ';',
            'var TOP = ' + G.TOP + ', BOTTOM = ' + G.BOTTOM + ';',
            'function cl(x) { return Math.min(1, Math.max(0, x)); }',
            'function eio(a, d) { var x = cl((time - a) / d); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }',
            'function sc(i) { var v = C.effect(NAMES[i])(1).value; return Math.round(Math.min(10, Math.max(0, v)) * 10) / 10; }',
            'function total() { var s = 0, w = 0; for (var k = 0; k < 4; k++) { var wk = Math.max(0, C.effect("Weight " + NAMES[k])(1).value); s += sc(k) * wk; w += wk; } return w > 0 ? Math.round(s / w * 100) / 100 : 0; }',
            'function levelY(i) {',
            '  var y = BOTTOM - (BOTTOM - TOP) * (sc(i) / 10) * eio(T.roll0 + i * T.stag, T.rollDur);',
            '  if (WT) { var ya = BOTTOM - (BOTTOM - TOP) * (total() / 10); y += (ya - y) * eio(T.align0, T.alignDur); }',
            '  return y + (BOTTOM - y) * eio(T.out0, T.outDur);',
            '}',
            ''
        ].join("\n");
    }

    function tr(layer) { return layer.property("ADBE Transform Group"); }

    function addText(comp, name, str, font, size, color, justification, pos, leading) {
        var layer = comp.layers.addText(str);
        layer.name = name;
        var prop = layer.property("ADBE Text Properties").property("ADBE Text Document");
        var doc = prop.value;
        try { doc.resetCharStyle(); } catch (e1) {}
        try { doc.resetParagraphStyle(); } catch (e2) {}
        doc.text = str;
        doc.font = font;
        doc.fontSize = size;
        doc.applyFill = true;
        doc.fillColor = color;
        doc.applyStroke = false;
        doc.tracking = 0;
        doc.justification = justification;
        try { doc.autoLeading = false; } catch (e3) {}
        try { doc.leading = leading || Math.round(size * 1.2); } catch (e4) {}
        prop.setValue(doc);
        tr(layer).property("ADBE Position").setValue(pos);
        return layer;
    }

    // Shape layer with one rectangle (or ellipse) whose coordinates are comp coordinates.
    function addShape(comp, name, color, kind) {
        var layer = comp.layers.addShape();
        layer.name = name;
        var group = layer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        group.name = name;
        var vectors = layer.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
        vectors.addProperty(kind === "ellipse" ? "ADBE Vector Shape - Ellipse" : "ADBE Vector Shape - Rect");
        vectors = layer.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
        vectors.addProperty("ADBE Vector Graphic - Fill");
        vectors = layer.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
        vectors.property(2).property("ADBE Vector Fill Color").setValue([color[0], color[1], color[2], 1]);
        tr(layer).property("ADBE Anchor Point").setValue([0, 0]);
        tr(layer).property("ADBE Position").setValue([0, 0]);
        return layer;
    }

    // Horizontal hairlines at every step of the scale, one shape layer.
    function addGuides(comp, name, x0, x1, count, step) {
        var layer = comp.layers.addShape();
        layer.name = name;
        layer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        var k, vectors;
        for (k = 1; k <= count; k++) {
            vectors = layer.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
            vectors.addProperty("ADBE Vector Shape - Rect");
        }
        vectors = layer.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
        vectors.addProperty("ADBE Vector Graphic - Fill");
        vectors = layer.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
        for (k = 1; k <= count; k++) {
            vectors.property(k).property("ADBE Vector Rect Size").setValue([x1 - x0, 2]);
            vectors.property(k).property("ADBE Vector Rect Position").setValue([(x0 + x1) / 2, G.BOTTOM - step * k]);
        }
        vectors.property(count + 1).property("ADBE Vector Fill Color").setValue([PAPER[0], PAPER[1], PAPER[2], 1]);
        tr(layer).property("ADBE Anchor Point").setValue([0, 0]);
        tr(layer).property("ADBE Position").setValue([0, 0]);
        return layer;
    }

    function shapeSize(layer) {
        var s = layer.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").property(1);
        return s.property("ADBE Vector Rect Size") || s.property("ADBE Vector Ellipse Size");
    }

    function shapePos(layer) {
        var s = layer.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").property(1);
        return s.property("ADBE Vector Rect Position") || s.property("ADBE Vector Ellipse Position");
    }

    // Rectangle whose [x0, y0, x1, y1] comes from an expression snippet (comp coordinates).
    function exprRect(comp, name, color, pre, boxExpr) {
        var layer = addShape(comp, name, color);
        shapeSize(layer).expression = pre + 'var b = ' + boxExpr + ';\n[Math.max(0, b[2] - b[0]), Math.max(0, b[3] - b[1])]';
        shapePos(layer).expression = pre + 'var b = ' + boxExpr + ';\n[(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]';
        return layer;
    }

    function setMatte(target, matte) {
        matte.moveBefore(target);
        if (typeof target.setTrackMatte === "function") {
            target.setTrackMatte(matte, TrackMatteType.ALPHA);
        } else {
            target.trackMatteType = TrackMatteType.ALPHA;
        }
        matte.enabled = false;
    }

    // Text line that rises into a fixed window and leaves upwards.
    // baseExpr: expression snippet returning the baseline Y.
    function maskedLine(comp, pre, layer, x0, x1, size, baseExpr, inExpr, outExpr, clipTop) {
        var rise = Math.round(size * 1.25);
        layer.motionBlur = true;
        tr(layer).property("ADBE Position").expression = pre +
            'var base = ' + baseExpr + ';\n' +
            '[value[0], base + (1 - ' + inExpr + ') * ' + rise + ' - ' + outExpr + ' * ' + rise + ']';
        var top = '(' + baseExpr + ') - ' + Math.round(size * 0.9);
        if (clipTop) top = 'Math.max(' + top + ', ' + clipTop + ')';
        var box = '[' + x0 + ', ' + top + ', ' + x1 + ', (' + baseExpr + ') + ' + Math.round(size * 0.28) + ']';
        var matte = exprRect(comp, layer.name + " / matte", PAPER, pre, box);
        setMatte(layer, matte);
        return layer;
    }

    function addSlider(layer, name, value) {
        var fx = layer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
        fx.name = name;
        layer.property("ADBE Effect Parade").property(name).property(1).setValue(value);
    }

    function exposeEGP(comp, prop, label) {
        try {
            if (typeof prop.addToMotionGraphicsTemplateAs === "function") prop.addToMotionGraphicsTemplateAs(comp, label);
            else prop.addToMotionGraphicsTemplate(comp);
        } catch (e) {}
    }

    // ------------------------------------------------------------------ build

    function buildComp(folder, compName, T, withTotal) {
        var comp = app.project.items.addComp(compName, W, H, 1, T.duration, FPS);
        comp.parentFolder = folder;
        comp.bgColor = BLACK;
        comp.motionBlur = true;
        try { comp.shutterAngle = 180; comp.shutterPhase = -90; } catch (e) {}
        try { comp.motionBlurSamplesPerFrame = 16; comp.motionBlurAdaptiveSampleLimit = 128; } catch (e7) {}

        var pre = prelude(T, withTotal);
        var i, k, x0, cx;
        var right = W - G.M;
        var len = G.BOTTOM - G.TOP;

        comp.layers.addSolid(BLACK, "BG", W, H, 1);

        // Created first so every expression below resolves; moved to the top at the end.
        var ctrl = comp.layers.addNull();
        ctrl.name = "CONTROLS";
        try { ctrl.enabled = false; } catch (e6) {}
        for (i = 0; i < CRITERIA.length; i++) addSlider(ctrl, CRITERIA[i].name, CRITERIA[i].score);
        for (i = 0; i < CRITERIA.length; i++) addSlider(ctrl, "Weight " + CRITERIA[i].name, CRITERIA[i].weight);

        // Columns: fill rising to the score, level hairline, rolling score.
        for (i = 0; i < CRITERIA.length; i++) {
            x0 = G.M + G.COLW * i;
            cx = x0 + G.COLW / 2;
            var name = CRITERIA[i].name;

            var fill = exprRect(comp, name + " / fill", COLUMN, pre,
                '[' + x0 + ', levelY(' + i + '), ' + (x0 + G.COLW) + ', BOTTOM]');
            fill.motionBlur = true;

            var level = exprRect(comp, name + " / level", PAPER, pre,
                '[' + x0 + ', levelY(' + i + ') - 1, ' + (x0 + G.COLW) + ', levelY(' + i + ') + 1]');
            level.motionBlur = true;
            tr(level).property("ADBE Opacity").expression = pre + '100 * (1 - eio(T.out0 + T.outDur * 0.5, T.outDur * 0.5))';

            var score = addText(comp, name + " / score", "0.0", FONT_MEDIUM, G.SIZE, PAPER,
                ParagraphJustification.LEFT_JUSTIFY, [x0 + G.PADX, G.BOTTOM]);
            score.motionBlur = true;
            score.property("ADBE Text Properties").property("ADBE Text Document").expression = pre + [
                'var v = Math.round(sc(' + i + ') * 10), out = [];',
                'for (var k = 12; k >= 0; k--) out.push((Math.max(0, v - k) / 10).toFixed(1));',
                'out.join("\\r")'
            ].join("\n");
            var scoreBase = 'Math.min(Math.max(levelY(' + i + ') + ' + (G.GAP + G.CAPH) + ', ' + (G.HEAD_Y + 44 + G.CAPH) + '), BOTTOM - 44)';
            var scoreOut = withTotal ? 'eio(T.numOut0 + ' + (i * 0.06) + ', 0.8)' : 'eio(T.out0, T.outDur)';
            tr(score).property("ADBE Position").expression = pre + [
                'var e = eio(T.roll0 + ' + i + ' * T.stag, T.rollDur);',
                'var idx = -4 + 16 * e;',
                'var base = ' + scoreBase + ';',
                'var s = sc(' + i + ') >= 10 ? 0.76 : 1;',
                '[value[0], base - (idx * ' + G.LH + ' + ' + scoreOut + ' * ' + G.LH + ') * s]'
            ].join("\n");
            var scoreMatte = exprRect(comp, name + " / score / matte", PAPER, pre,
                '[' + x0 + ', (' + scoreBase + ') - ' + (G.CAPH + G.PAD) + ', ' + (x0 + G.COLW) + ', (' + scoreBase + ') + ' + G.PAD + ']');
            setMatte(score, scoreMatte);
            tr(score).property("ADBE Scale").expression = pre + 'var s = sc(' + i + ') >= 10 ? 76 : 100;\n[s, s]';

            var headIn = 'eio(T.head0 + ' + i + ' * T.hstag, T.headDur)';
            var headOut = 'eio(T.headOut0 + ' + (i * 0.05) + ', 0.8)';
            var label = addText(comp, name + " / label", name, FONT_MEDIUM, G.HEAD_SIZE, PAPER,
                ParagraphJustification.LEFT_JUSTIFY, [x0 + G.PADX, G.HEAD_Y]);
            maskedLine(comp, pre, label, x0, x0 + G.COLW, G.HEAD_SIZE, String(G.HEAD_Y), headIn, headOut);

            var weight = addText(comp, name + " / weight", CRITERIA[i].weight + "%", FONT_REGULAR, G.WEIGHT_SIZE, PAPER,
                ParagraphJustification.RIGHT_JUSTIFY, [x0 + G.COLW - G.PADX, G.HEAD_Y]);
            weight.property("ADBE Text Properties").property("ADBE Text Document").expression =
                'var C = thisComp.layer("CONTROLS");\nMath.round(C.effect("Weight ' + name + '")(1).value) + "%"';
            tr(weight).property("ADBE Opacity").setValue(55);
            maskedLine(comp, pre, weight, x0, x0 + G.COLW, G.WEIGHT_SIZE, String(G.HEAD_Y), headIn, headOut);
        }

        // 0-10 measuring scale: faint guides across the grid and numbers in the left margin.
        var scaleOpacity = 'eio(0.5, 1.0) * (1 - ' + (withTotal ? 'eio(T.align0 - 0.2, 0.8)' : 'eio(T.out0, T.outDur)') + ')';
        var guides = addGuides(comp, "Scale / guides", G.M, right, 9, len / 10);
        tr(guides).property("ADBE Opacity").expression = pre + '8 * ' + scaleOpacity;
        var scaleLines = [];
        for (k = 10; k >= 0; k--) scaleLines.push(String(k));
        var scaleText = addText(comp, "Scale / numbers", scaleLines.join("\r"), FONT_REGULAR, G.SCALE_SIZE, PAPER,
            ParagraphJustification.RIGHT_JUSTIFY, [G.M - 18, G.TOP + 8], len / 10);
        tr(scaleText).property("ADBE Opacity").expression = pre + '40 * ' + scaleOpacity;

        // Grid hairlines.
        for (k = 0; k <= CRITERIA.length; k++) {
            var x = G.M + G.COLW * k;
            var inner = k > 0 && k < CRITERIA.length;
            var retract = inner ? 'eio(T.rulesOut0 + ' + (k * 0.05) + ', T.rulesOutDur)' : 'eio(T.out0, T.outDur)';
            var grow = 'eio(T.rules0 + ' + (k * 0.06) + ', T.rulesDur)';
            var rule = exprRect(comp, "Rule / v" + k, PAPER, pre,
                '[' + (x - 1) + ', TOP + ' + len + ' * ' + retract + ', ' + (x + 1) + ', TOP + ' + len + ' * ' + grow + ']');
            tr(rule).property("ADBE Opacity").setValue(inner ? 28 : 40);
        }
        var hrules = [G.TOP, G.BOTTOM];
        for (k = 0; k < hrules.length; k++) {
            var hl = exprRect(comp, "Rule / h" + k, PAPER, pre,
                '[' + G.M + ' + ' + (right - G.M) + ' * eio(T.out0, T.outDur), ' + (hrules[k] - 1) + ', ' +
                G.M + ' + ' + (right - G.M) + ' * eio(T.rules0 + ' + (k * 0.1) + ', T.rulesDur), ' + (hrules[k] + 1) + ']');
            tr(hl).property("ADBE Opacity").setValue(40);
        }

        // Site name, bottom left.
        var siteLayer = addText(comp, "Site", "site-name.com", FONT_REGULAR, G.SITE_SIZE, PAPER,
            ParagraphJustification.LEFT_JUSTIFY, [G.M, 1490]);
        tr(siteLayer).property("ADBE Opacity").expression = pre + '100 * eio(T.corner0, 1.1) * (1 - eio(T.out0, T.outDur))';
        tr(siteLayer).property("ADBE Position").expression = pre + '[value[0], value[1] + (1 - eio(T.corner0, 1.1)) * 30]';

        // Weighted total.
        if (withTotal) {
            var tBase = String(G.T_BASE);
            var bandRise = 'BOTTOM - (BOTTOM - TOP) * eio(T.band0, T.bandDur)';
            var bandTop = '((' + bandRise + ') + (BOTTOM - (' + bandRise + ')) * eio(T.out0, T.outDur))';
            var tBox = '[' + G.M + ', Math.max((' + tBase + ') - ' + (G.T_CAPH + G.T_PAD) + ', ' + bandTop + '), ' + right + ', (' + tBase + ') + ' + G.T_PAD + ']';

            // Paper fills the whole score box from the bottom; the verdict is printed on it.
            var band = exprRect(comp, "Total / band", PAPER, pre,
                '[' + G.M + ', ' + bandTop + ', ' + right + ', BOTTOM]');
            band.motionBlur = true;

            var intStrip = addText(comp, "Total / integer", "0", FONT_MEDIUM, G.T_SIZE, INK,
                ParagraphJustification.RIGHT_JUSTIFY, [G.DOTX - G.SEP, G.BOTTOM]);
            intStrip.motionBlur = true;
            intStrip.property("ADBE Text Properties").property("ADBE Text Document").expression = pre + [
                'var n = Math.floor(total() + 1e-6), out = [];',
                'for (var k = 6; k >= 0; k--) out.push(String(Math.max(0, n - k)));',
                'out.join("\\r")'
            ].join("\n");
            tr(intStrip).property("ADBE Position").expression = pre + [
                'var e = eio(T.total0, T.totalDur);',
                'var base = ' + tBase + ';',
                '[value[0], base - (-3 + 9 * e) * ' + G.T_LH + ']'
            ].join("\n");
            setMatte(intStrip, exprRect(comp, "Total / integer / matte", PAPER, pre, tBox));

            var decStrip = addText(comp, "Total / decimals", "00", FONT_MEDIUM, G.T_SIZE, INK,
                ParagraphJustification.LEFT_JUSTIFY, [G.DOTX + G.SEP, G.BOTTOM]);
            decStrip.motionBlur = true;
            decStrip.property("ADBE Text Properties").property("ADBE Text Document").expression = pre + [
                'var d = Math.round(total() * 100) % 100, out = [];',
                'for (var k = 14; k >= 0; k--) { var x = ((d - k) % 100 + 100) % 100; out.push(x < 10 ? "0" + x : String(x)); }',
                'out.join("\\r")'
            ].join("\n");
            tr(decStrip).property("ADBE Position").expression = pre + [
                'var e = eio(T.total0 + 0.08, T.totalDur);',
                'var base = ' + tBase + ';',
                '[value[0], base - (-3 + 17 * e) * ' + G.T_LH + ']'
            ].join("\n");
            setMatte(decStrip, exprRect(comp, "Total / decimals / matte", PAPER, pre, tBox));

            var dot = addShape(comp, "Total / dot", INK, "ellipse");
            shapeSize(dot).setValue([G.DOT_R * 2, G.DOT_R * 2]);
            tr(dot).property("ADBE Position").setValue([G.DOTX, G.T_BASE - G.DOT_R]);
            tr(dot).property("ADBE Scale").expression = pre +
                'var s = 100 * eio(T.dot, 0.7) * (1 - eio(T.out0, T.outDur * 0.6));\n[s, s]';

            var fl = addText(comp, "Total / label", TOTAL_LABEL, FONT_CYRILLIC, 46, INK,
                ParagraphJustification.LEFT_JUSTIFY, [G.M + G.PADX, G.HEAD_Y]);
            maskedLine(comp, pre, fl, G.M, G.DOTX, 46, String(G.HEAD_Y), 'eio(T.lbl0, 1.1)', '0', bandTop);

            var fs = addText(comp, "Total / sublabel", TOTAL_SUBLABEL, FONT_CYRILLIC_REGULAR, 30, INK,
                ParagraphJustification.LEFT_JUSTIFY, [G.M + G.PADX, G.HEAD_Y + 52]);
            tr(fs).property("ADBE Opacity").setValue(55);
            maskedLine(comp, pre, fs, G.M, G.DOTX, 30, String(G.HEAD_Y + 52), 'eio(T.lbl0 + 0.1, 1.1)', '0', bandTop);

            var ften = addText(comp, "Total / of ten", "/10", FONT_REGULAR, 46, INK,
                ParagraphJustification.RIGHT_JUSTIFY, [right - G.PADX, G.HEAD_Y]);
            tr(ften).property("ADBE Opacity").setValue(55);
            maskedLine(comp, pre, ften, right - 400, right, 46, String(G.HEAD_Y), 'eio(T.lbl0 + 0.15, 1.1)', '0', bandTop);
        }

        ctrl.moveToBeginning();
        try { comp.motionGraphicsTemplateName = compName; } catch (e5) {}
        var fxs = ctrl.property("ADBE Effect Parade");
        for (i = 0; i < CRITERIA.length; i++) exposeEGP(comp, fxs.property(CRITERIA[i].name).property(1), CRITERIA[i].name);
        exposeEGP(comp, siteLayer.property("ADBE Text Properties").property("ADBE Text Document"), "Site");

        return comp;
    }

    app.beginUndoGroup("Jury Verdict template");
    try {
        if (!app.project) app.newProject();
        var folder = app.project.items.addFolder("Jury Verdict");
        buildComp(folder, "Verdict \u2014 Scores", TIMING_SCORES, false);
        var main = buildComp(folder, "Verdict \u2014 Scores + Total", TIMING_TOTAL, true);
        main.openInViewer();
        alert("Jury Verdict: done.\n\nChange the numbers in Window > Essential Graphics\n(or Effect Controls of the CONTROLS layer).\nTo render several sites at once run JuryVerdict-Batch.jsx.");
    } catch (err) {
        alert("Jury Verdict: " + err.toString() + (err.line ? " (line " + err.line + ")" : ""));
    }
    app.endUndoGroup();
})();
