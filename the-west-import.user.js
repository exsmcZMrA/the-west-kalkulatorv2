// ==UserScript==
// @name         Mesterség-kalkulátor — raktár import
// @namespace    the-west-kalkulator
// @version      1.2
// @description  Egy gomb a játékban, ami átküldi a raktárkészletet a mesterség-kalkulátorba.
// @author       —
// @match        https://*.the-west.hu/game.php*
// @match        https://*.the-west.net/game.php*
// @match        https://*.the-west.com/game.php*
// @match        https://*.the-west.de/game.php*
// @match        https://*.the-west.pl/game.php*
// @match        https://*.the-west.cz/game.php*
// @match        https://*.the-west.sk/game.php*
// @match        https://*.the-west.es/game.php*
// @match        https://*.the-west.fr/game.php*
// @match        https://*.the-west.it/game.php*
// @match        https://*.the-west.nl/game.php*
// @match        https://*.the-west.gr/game.php*
// @match        https://*.the-west.pt/game.php*
// @match        https://*.the-west.ro/game.php*
// @match        https://*.the-west.se/game.php*
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

/* =======================================================================
   A kalkulátor címe. Csak akkor kell hozzányúlni, ha a repó neve vagy a
   GitHub Pages beállítása változik.
   ======================================================================= */
const CALC_URL = "https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/";

(function () {
    "use strict";

    /* megvárjuk, amíg a játék betölti a raktárat */
    let tries = 0;
    const wait = setInterval(() => {
        if (typeof unsafeWindow !== "undefined" && unsafeWindow.Bag && unsafeWindow.Bag.getItemCount) {
            clearInterval(wait);
            addButton();
        } else if (window.Bag && window.Bag.getItemCount) {
            clearInterval(wait);
            addButton();
        } else if (++tries > 60) {
            clearInterval(wait);
        }
    }, 1000);

    function game() {
        return (typeof unsafeWindow !== "undefined" && unsafeWindow.Bag) ? unsafeWindow : window;
    }

    /* a raktár teljes tartalma: azonosító/1000 : darabszám
       nem rögzített listából dolgozik, ezért új tárgyaknál sem évül el  */
    function readInventory() {
        const W = game();
        const bag = W.Bag;
        const out = [];
        const seen = {};
        Object.keys(bag.items_by_id || {}).forEach(key => {
            const id = Number(key);
            if (!id || seen[id]) return;
            seen[id] = 1;
            let c = 0;
            try { c = bag.getItemCount(id) || 0; } catch (e) { return; }
            if (c > 0 && id % 1000 === 0) out.push((id / 1000) + ":" + c);
        });
        return out;
    }

    const POS_KEY = "mk-import-pos";

    function addButton() {
        if (document.getElementById("mk-import-btn")) return;
        const b = document.createElement("div");
        b.id = "mk-import-btn";
        b.textContent = "📦";
        b.title = "Raktárkészlet küldése a mesterség-kalkulátorba";

        let pos = { right: 2, top: 300 };
        try {
            const saved = JSON.parse(localStorage.getItem(POS_KEY) || "null");
            if (saved && typeof saved.top === "number") pos = saved;
        } catch (e) { /* marad az alapérték */ }

        b.style.cssText = [
            "position:fixed", "z-index:99999",
            "right:" + pos.right + "px", "top:" + pos.top + "px",
            "width:30px", "height:30px", "line-height:30px", "text-align:center",
            "background:#2f261d", "border:1px solid #e0a844", "border-radius:5px",
            "cursor:pointer", "font-size:16px", "user-select:none",
            "box-shadow:0 1px 4px rgba(0,0,0,.6)"
        ].join(";");
        b.onmouseover = () => b.style.background = "#3d3125";
        b.onmouseout = () => b.style.background = "#2f261d";

        /* húzással áthelyezhető; a rövid kattintás marad kattintás */
        let dragging = false, moved = false, startY = 0, startX = 0, baseTop = 0, baseRight = 0;
        b.addEventListener("mousedown", e => {
            dragging = true; moved = false;
            startY = e.clientY; startX = e.clientX;
            baseTop = parseInt(b.style.top) || 0;
            baseRight = parseInt(b.style.right) || 0;
            e.preventDefault();
        });
        document.addEventListener("mousemove", e => {
            if (!dragging) return;
            const dy = e.clientY - startY, dx = e.clientX - startX;
            if (Math.abs(dy) > 3 || Math.abs(dx) > 3) moved = true;
            b.style.top = Math.max(0, baseTop + dy) + "px";
            b.style.right = Math.max(0, baseRight - dx) + "px";
        });
        document.addEventListener("mouseup", () => {
            if (!dragging) return;
            dragging = false;
            if (moved) {
                try {
                    localStorage.setItem(POS_KEY, JSON.stringify({
                        top: parseInt(b.style.top) || 0,
                        right: parseInt(b.style.right) || 0
                    }));
                } catch (e) { /* nem baj */ }
            }
        });

        b.addEventListener("click", () => {
            if (moved) { moved = false; return; }   /* húzás volt, nem kattintás */
            sendInventory(b);
        });

        document.body.appendChild(b);
    }

    /* karakteradatok: név, mesterség, szint */
    function readCharacter() {
        const C = game().Character;
        if (!C || !C.name) return null;
        return C.name + "|" + (C.professionId || 0) + "|" + (C.professionSkill || 0);
    }

    /* megtanult receptek — csak azok, amiken ott a last_craft mező.
       Ha más kiegészítő tölti fel a listát, ez üresen marad, és akkor nem küldünk semmit. */
    function readLearned() {
        const C = game().Crafting;
        if (!C || !C.recipes) return null;
        const out = [];
        Object.keys(C.recipes).forEach(k => {
            const r = C.recipes[k];
            if (r && Object.prototype.hasOwnProperty.call(r, "last_craft") && r.craftitem)
                out.push(r.craftitem / 1000);
        });
        return out.length ? out : null;
    }

    function sendInventory(b) {
        const data = readInventory();
        if (!data.length) { flash(b, "?"); return; }
        const payload = data.join(",");
        try { GM_setClipboard(payload); } catch (e) { /* az URL úgyis viszi */ }
        let q = "imp=" + payload;
        const k = readCharacter();
        if (k) q += "&k=" + encodeURIComponent(k);
        const t = readLearned();
        if (t) q += "&t=" + t.join(",");
        const url = CALC_URL.replace(/\/+$/, "/") + "#" + q;
        try {
            GM_openInTab(url, { active: true, insert: true });
        } catch (e) {
            window.open(url, "_blank");
        }
        flash(b, "✓");
    }

    function flash(el, txt) {
        const old = el.textContent;
        el.textContent = txt;
        setTimeout(() => el.textContent = old, 1800);
    }
})();
