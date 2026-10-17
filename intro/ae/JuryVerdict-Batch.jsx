/*
  Jury Verdict - batch.
  Duplicates the verdict template once per site, fills in the scores and (optionally) queues the renders.

  1. Run JuryVerdict.jsx once (or open a project that already has the template).
  2. Select the template comp you want to use (either "Verdict - ..." comp) in the Project panel or open it.
  3. File > Scripts > Run Script File... > JuryVerdict-Batch.jsx
  4. One site per line:  site-name.com  Design  UX  Creativity  Content
*/

(function () {
    var NAMES = ["Design", "UX", "Creativity", "Content"];

    function trim(s) { return String(s).replace(/^\s+|\s+$/g, ""); }

    function isTemplate(item) {
        return item instanceof CompItem && item.layer("CONTROLS") !== null && item.layer("Site") !== null;
    }

    function findTemplate() {
        var active = app.project.activeItem;
        if (active && isTemplate(active)) return active;
        var sel = app.project.selection;
        for (var s = 0; s < sel.length; s++) if (isTemplate(sel[s])) return sel[s];
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem && it.name === "Verdict \u2014 Scores + Total" && isTemplate(it)) return it;
        }
        return null;
    }

    function parse(text) {
        var rows = [], lines = String(text).split(/\r\n|\r|\n/);
        for (var i = 0; i < lines.length; i++) {
            var line = trim(lines[i]);
            if (!line || line.charAt(0) === "#") continue;
            var tokens = line.split(/\s+/), site = "";
            if (isNaN(parseFloat(tokens[0].replace(",", ".")))) site = tokens.shift();
            if (tokens.length < NAMES.length) throw new Error("line " + (i + 1) + ": need " + NAMES.length + " scores \u2014 \"" + line + "\"");
            var scores = [];
            for (var k = 0; k < NAMES.length; k++) {
                var v = parseFloat(tokens[k].replace(",", "."));
                if (isNaN(v) || v < 0 || v > 10) throw new Error("line " + (i + 1) + ": bad score \"" + tokens[k] + "\"");
                scores.push(v);
            }
            rows.push({ site: site, scores: scores });
        }
        return rows;
    }

    var tpl = findTemplate();
    if (!tpl) {
        alert("Jury Verdict batch: open or select a template comp first (run JuryVerdict.jsx to build one).");
        return;
    }

    var w = new Window("dialog", "Jury Verdict \u2014 batch");
    w.orientation = "column";
    w.alignChildren = ["fill", "top"];
    w.add("statictext", undefined, "Template: " + tpl.name);
    w.add("statictext", undefined, "One site per line:   site-name.com   Design   UX   Creativity   Content");
    var input = w.add("edittext", [0, 0, 640, 240], "lusion.co 8.4 7.6 9.1 6.8\nobys.agency 8.9 8.1 9.3 7.5", { multiline: true });
    var queue = w.add("checkbox", undefined, "Add to Render Queue");
    queue.value = true;
    var buttons = w.add("group");
    buttons.alignment = ["right", "top"];
    buttons.add("button", undefined, "Cancel", { name: "cancel" });
    buttons.add("button", undefined, "Create", { name: "ok" });
    if (w.show() !== 1) return;

    app.beginUndoGroup("Jury Verdict batch");
    try {
        var rows = parse(input.text);
        for (var r = 0; r < rows.length; r++) {
            var comp = tpl.duplicate();
            comp.name = "Verdict \u2014 " + (rows[r].site || ("site " + (r + 1)));
            comp.parentFolder = tpl.parentFolder;
            var fx = comp.layer("CONTROLS").property("ADBE Effect Parade");
            for (var k = 0; k < NAMES.length; k++) fx.property(NAMES[k]).property(1).setValue(rows[r].scores[k]);
            var siteProp = comp.layer("Site").property("ADBE Text Properties").property("ADBE Text Document");
            var doc = siteProp.value;
            doc.text = rows[r].site;
            siteProp.setValue(doc);
            if (queue.value) app.project.renderQueue.items.add(comp);
        }
        alert("Jury Verdict batch: created " + rows.length + " comp(s).");
    } catch (err) {
        alert("Jury Verdict batch: " + err.toString());
    }
    app.endUndoGroup();
})();
