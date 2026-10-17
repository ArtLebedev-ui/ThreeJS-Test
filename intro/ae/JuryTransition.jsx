/*
  Jury Transition - bumper between reviewed projects for After Effects (2020+).

  File > Scripts > Run Script File... > JuryTransition.jsx
  Builds "Transition - Project" (2560x1600, 30 fps, 6 s) in a "Jury Transition" folder:
    1. the title assembles letter by letter across the whole frame and leaves upwards;
    2. giant brackets fly in from the edges, the project number rolls in between them;
    3. outlined title lines drift behind, the brackets accelerate into each other,
       cross, cut the number and everything leaves to black.

  Edit "Number" and "Title" in Essential Graphics (or on the CONTROLS / Title layers).
  Numbers and brackets use Neue Montreal; the Cyrillic title uses FONT_CYRILLIC
  (Inter, free: rsms.me/inter). Swap the PostScript name for any installed font.
*/

(function () {
    var W = 2560, H = 1600, FPS = 30;

    var PAPER = [0.929, 0.922, 0.902];   // #EDEBE6
    var OUTLINE = [0.2, 0.2, 0.2];
    var BLACK = [0, 0, 0];

    var FONT_LIGHT = "NeueMontreal-Light";
    var FONT_MEDIUM = "NeueMontreal-Medium";
    var FONT_CYRILLIC = "Inter-Medium";

    // Russian for "Evaluation"
    var TITLE = "\u041E\u0446\u0435\u043D\u043E\u0447\u043D\u0430\u044F";
    var NUMBER = 42;

    var G = {
        CX: 1280,
        TITLE_SIZE: 420, TITLE_BASE: 955, TITLE_CAP: 310, TITLE_DESC: 66, TITLE_TRACK: -10,
        NUM_SIZE: 1000, NUM_LH: 1200, NUM_BASE: 1153, NUM_CAP: 706, NUM_PAD: 80,
        PAREN_SIZE: 1700, PAREN_BASE: 1342,
        PAREN_L: 237, PAREN_R: 1898,           // layer origins of "(" and ")" when they frame the number
        PAREN_L_INNER: 389, PAREN_R_INNER: 36, // inner ink edges relative to those origins
        PAREN_TRAVEL: 762, PAREN_CROSS: 2900, PAREN_DRIFT: 40,
        ROW_BASES: [455, 955, 1455], ROW_SPEED: 500, ROW_BOOST: 2800, ROW_REPEAT: 6
    };

    var T = {
        tIn: 0.1, tStag: 0.05, tDur: 0.75,
        tOut: 1.6, oStag: 0.04, oDur: 0.6,
        pIn: 1.8, pDur: 0.9,
        roll: 2.0, rollDur: 1.2,
        mIn: 1.9, mDur: 0.8,
        close: 4.4, closeDur: 1.1,
        mOut: 4.6, mOutDur: 0.9,
        duration: 6.0
    };

    // ---------------------------------------------------------------- helpers

    function serialize(obj) {
        var parts = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) parts.push(k + ":" + obj[k]);
        }
        return "{" + parts.join(",") + "}";
    }

    var PRE = [
        'var C = thisComp.layer("CONTROLS");',
        'var T = ' + serialize(T) + ';',
        'function cl(x) { return Math.min(1, Math.max(0, x)); }',
        'function eio(a, d) { var x = cl((time - a) / d); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }',
        'function num() { return Math.max(0, Math.round(C.effect("Number")(1).value)); }',
        'function pad(n) { return n < 10 ? "0" + n : String(n); }',
        'function drift() { var a = T.pIn + T.pDur; return cl((time - a) / (T.close - a)); }',
        'function xL() { return ' + (G.PAREN_L - G.PAREN_TRAVEL) + ' + ' + G.PAREN_TRAVEL + ' * eio(T.pIn, T.pDur) - ' + G.PAREN_DRIFT + ' * drift() + ' + G.PAREN_CROSS + ' * eio(T.close, T.closeDur); }',
        'function xR() { return ' + (G.PAREN_R + G.PAREN_TRAVEL) + ' - ' + G.PAREN_TRAVEL + ' * eio(T.pIn, T.pDur) + ' + G.PAREN_DRIFT + ' * drift() - ' + G.PAREN_CROSS + ' * eio(T.close, T.closeDur); }',
        ''
    ].join("\n");

    function tr(layer) { return layer.property("ADBE Transform Group"); }

    function addText(comp, name, str, font, size, color, justification, pos) {
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
        try { doc.leading = Math.round(size * 1.2); } catch (e4) {}
        prop.setValue(doc);
        tr(layer).property("ADBE Position").setValue(pos);
        return layer;
    }

    function setDoc(layer, fields) {
        var prop = layer.property("ADBE Text Properties").property("ADBE Text Document");
        var doc = prop.value;
        for (var k in fields) {
            if (fields.hasOwnProperty(k)) doc[k] = fields[k];
        }
        prop.setValue(doc);
    }

    function addRect(comp, name, pre, boxExpr) {
        var layer = comp.layers.addShape();
        layer.name = name;
        layer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        var vectors = layer.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
        vectors.addProperty("ADBE Vector Shape - Rect");
        vectors = layer.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
        vectors.addProperty("ADBE Vector Graphic - Fill");
        vectors = layer.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
        vectors.property(2).property("ADBE Vector Fill Color").setValue([1, 1, 1, 1]);
        tr(layer).property("ADBE Anchor Point").setValue([0, 0]);
        tr(layer).property("ADBE Position").setValue([0, 0]);
        var rect = vectors.property(1);
        rect.property("ADBE Vector Rect Size").expression = pre + 'var b = ' + boxExpr + ';\n[Math.max(0, b[2] - b[0]), Math.max(0, b[3] - b[1])]';
        rect.property("ADBE Vector Rect Position").expression = pre + 'var b = ' + boxExpr + ';\n[(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]';
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

    // Per-character offset driven by an Expression Selector (textIndex is 1-based).
    function addCharAnimator(layer, name, offset, amountExpr) {
        var animators = layer.property("ADBE Text Properties").property("ADBE Text Animators");
        animators.addProperty("ADBE Text Animator");
        var idx = animators.numProperties;
        var anim = function () {
            return layer.property("ADBE Text Properties").property("ADBE Text Animators").property(idx);
        };
        anim().name = name;
        anim().property("ADBE Text Animator Properties").addProperty("ADBE Text Position 3D");
        var pos = anim().property("ADBE Text Animator Properties").property("ADBE Text Position 3D");
        try { pos.setValue([offset[0], offset[1], 0]); } catch (e) { pos.setValue([offset[0], offset[1]]); }
        var selectors = anim().property("ADBE Text Selectors");
        for (var s = selectors.numProperties; s >= 1; s--) {
            if (selectors.property(s).matchName === "ADBE Text Selector") selectors.property(s).remove();
        }
        anim().property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
        var sel = anim().property("ADBE Text Selectors").property("ADBE Text Expressible Selector");
        sel.property("ADBE Text Expressible Amount").expression = PRE + amountExpr;
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

    function build(folder) {
        var comp = app.project.items.addComp("Transition - Project", W, H, 1, T.duration, FPS);
        comp.parentFolder = folder;
        comp.bgColor = BLACK;
        comp.motionBlur = true;
        try { comp.shutterAngle = 180; comp.shutterPhase = -90; } catch (e) {}
        try { comp.motionBlurSamplesPerFrame = 16; comp.motionBlurAdaptiveSampleLimit = 128; } catch (e2) {}

        comp.layers.addSolid(BLACK, "BG", W, H, 1);

        // Created first so every expression below resolves; moved to the top at the end.
        var ctrl = comp.layers.addNull();
        ctrl.name = "CONTROLS";
        try { ctrl.enabled = false; } catch (e3) {}
        addSlider(ctrl, "Number", NUMBER);

        // Title: created early because the outlined rows read its text.
        var title = addText(comp, "Title", TITLE, FONT_CYRILLIC, G.TITLE_SIZE, PAPER,
            ParagraphJustification.CENTER_JUSTIFY, [G.CX, G.TITLE_BASE]);
        setDoc(title, { tracking: G.TITLE_TRACK });
        title.motionBlur = true;
        var rise = Math.round(G.TITLE_SIZE * 1.15);
        addCharAnimator(title, "In", [0, rise], '100 * (1 - eio(T.tIn + (textIndex - 1) * T.tStag, T.tDur))');
        addCharAnimator(title, "Out", [0, -rise], '100 * eio(T.tOut + (textIndex - 1) * T.oStag, T.oDur)');
        var titleTop = G.TITLE_BASE - G.TITLE_CAP - 70;
        var titleBottom = G.TITLE_BASE + G.TITLE_DESC + 30;
        setMatte(title, addRect(comp, "Title / matte", PRE, '[0, ' + titleTop + ', ' + W + ', ' + titleBottom + ']'));

        // Outlined title rows drifting in opposite directions, accelerating into the exit.
        for (var r = 0; r < G.ROW_BASES.length; r++) {
            var dir = r % 2 === 0 ? -1 : 1;
            var row = addText(comp, "Row " + (r + 1), TITLE, FONT_CYRILLIC, G.TITLE_SIZE, PAPER,
                ParagraphJustification.LEFT_JUSTIFY, [dir < 0 ? 0 : -9000, G.ROW_BASES[r]]);
            setDoc(row, { applyFill: false, applyStroke: true, strokeColor: OUTLINE, strokeWidth: 2, tracking: G.TITLE_TRACK });
            row.motionBlur = true;
            row.property("ADBE Text Properties").property("ADBE Text Document").expression = [
                'var t = "" + thisComp.layer("Title").text.sourceText, s = "";',
                'for (var k = 0; k < ' + G.ROW_REPEAT + '; k++) s += t + "   ";',
                's'
            ].join("\n");
            tr(row).property("ADBE Position").expression = PRE + [
                'var boost = Math.pow(cl((time - T.close) / 1.2), 2);',
                '[value[0] + ' + dir + ' * (' + G.ROW_SPEED + ' * time + ' + G.ROW_BOOST + ' * boost + ' + (r * 300) + '), value[1]]'
            ].join("\n");
            tr(row).property("ADBE Opacity").expression = PRE + '100 * eio(T.mIn + ' + (r * 0.08) + ', T.mDur) * (1 - eio(T.mOut, T.mOutDur))';
        }

        // Number rolling in between the brackets; the brackets' inner edges are its window.
        var number = addText(comp, "Number", "00", FONT_MEDIUM, G.NUM_SIZE, PAPER,
            ParagraphJustification.CENTER_JUSTIFY, [G.CX, G.NUM_BASE]);
        number.motionBlur = true;
        number.property("ADBE Text Properties").property("ADBE Text Document").expression = PRE + [
            'var n = num(), out = [];',
            'for (var k = 4; k >= 0; k--) out.push(pad(Math.max(0, n - k)));',
            'out.join("\\r")'
        ].join("\n");
        tr(number).property("ADBE Position").expression = PRE +
            '[value[0], ' + G.NUM_BASE + ' - (-2 + 6 * eio(T.roll, T.rollDur)) * ' + G.NUM_LH + ']';
        setMatte(number, addRect(comp, "Number / matte", PRE,
            '[xL() + ' + G.PAREN_L_INNER + ', ' + (G.NUM_BASE - G.NUM_CAP - G.NUM_PAD) + ', xR() + ' + G.PAREN_R_INNER + ', ' + (G.NUM_BASE + G.NUM_PAD) + ']'));

        var left = addText(comp, "Bracket (", "(", FONT_LIGHT, G.PAREN_SIZE, PAPER,
            ParagraphJustification.LEFT_JUSTIFY, [G.PAREN_L, G.PAREN_BASE]);
        left.motionBlur = true;
        tr(left).property("ADBE Position").expression = PRE + '[xL(), value[1]]';

        var right = addText(comp, "Bracket )", ")", FONT_LIGHT, G.PAREN_SIZE, PAPER,
            ParagraphJustification.LEFT_JUSTIFY, [G.PAREN_R, G.PAREN_BASE]);
        right.motionBlur = true;
        tr(right).property("ADBE Position").expression = PRE + '[xR(), value[1]]';

        ctrl.moveToBeginning();
        try { comp.motionGraphicsTemplateName = "Transition - Project"; } catch (e5) {}
        exposeEGP(comp, ctrl.property("ADBE Effect Parade").property("Number").property(1), "Number");
        exposeEGP(comp, title.property("ADBE Text Properties").property("ADBE Text Document"), "Title");
        return comp;
    }

    app.beginUndoGroup("Jury Transition template");
    try {
        if (!app.project) app.newProject();
        var folder = app.project.items.addFolder("Jury Transition");
        build(folder).openInViewer();
        alert("Jury Transition: done.\n\nChange Number and Title in Window > Essential Graphics.");
    } catch (err) {
        alert("Jury Transition: " + err.toString() + (err.line ? " (line " + err.line + ")" : ""));
    }
    app.endUndoGroup();
})();
