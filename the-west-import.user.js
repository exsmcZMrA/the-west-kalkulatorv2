// ==UserScript==
// @name         Mesterség-kalkulátor — raktár import (TESZT)
// @namespace    the-west-kalkulator-teszt
// @version      1.9-teszt
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
// @priority     100
// ==/UserScript==

/* =======================================================================
   A kalkulátor címe. Csak akkor kell hozzányúlni, ha a repó neve vagy a
   GitHub Pages beállítása változik.
   ======================================================================= */
const CALC_URL = "https://exsmczmra.github.io/the-west-kalkulatorv2/";

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
        const U = (typeof unsafeWindow !== "undefined") ? unsafeWindow : null;
        if (U && (U.Bag || U.Crafting || U.Character)) return U;
        return window;
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

    const POS_KEY = "mk-import-pos-teszt";

    function addButton() {
        if (!document.body) { setTimeout(addButton, 200); return; }
        if (document.getElementById("mk-import-btn-teszt")) return;
        const b = document.createElement("div");
        b.id = "mk-import-btn-teszt";
        b.textContent = "🧪";
        b.title = "TESZT — raktár küldése a v2 kalkulátorba";

        let pos = { right: 2, top: 300 };
        try {
            const saved = JSON.parse(localStorage.getItem(POS_KEY) || "null");
            if (saved && typeof saved.top === "number") pos = saved;
        } catch (e) { /* marad az alapérték */ }

        b.style.cssText = [
            "position:fixed", "z-index:99999",
            "right:" + pos.right + "px", "top:" + (pos.top + 80) + "px",
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

    /* ---- avatar ----
       A játék saját rajzolójával (tw2widget.avatarPicture) kirajzoltatjuk egy rejtett
       dobozba, majd a kész szerkezetet a lényeges stílusokkal együtt kimentjük.
       Így a kalkulátorban nem kell semmilyen idegen kódot futtatni. */
    const AV_PROPS = ["position","left","top","width","height","overflow",
                      "background-image","background-position-x","background-position-y",
                      "background-repeat","z-index","display","max-width"];

    function inlineStyles(node, base) {
        const cs = getComputedStyle(node);
        const out = [];
        AV_PROPS.forEach(k => {
            let v = cs.getPropertyValue(k);
            if (!v || v === "none" || v === "auto" || v === "normal" ||
                v === "static" || v === "visible" || v === "repeat" ||
                v === "0px" && k !== "left" && k !== "top") return;
            if (k === "background-image") v = v.replace(/url\((["']?)\//g, "url($1" + base + "/");
            out.push(k + ":" + v);
        });
        const tag = node.tagName.toLowerCase();
        let attrs = ` style="${out.join(";")}"`;
        if (tag === "img") {
            let src = node.getAttribute("src") || "";
            if (src.startsWith("/")) src = base + src;
            attrs += ` src="${src}" alt=""`;
        }
        const kids = [...node.children].map(c => inlineStyles(c, base)).join("");
        return `<${tag}${attrs}>${kids}</${tag}>`;
    }

    async function readAvatar() {
        const W = game();
        const tw = W.tw2widget, C = W.Character;
        if (!tw || typeof tw.avatarPicture !== "function" || !C || !C.avatarConfig) return null;
        const host = document.createElement("div");
        host.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden";
        document.body.appendChild(host);
        try {
            await tw.avatarPicture(host, "small", C.avatarConfig);
            await new Promise(r => setTimeout(r, 400));      /* várunk a képekre */
            const box = host.firstElementChild;
            if (!box) throw new Error("üres");
            const html = inlineStyles(box, location.origin);
            return html.length < 12000 ? html : null;
        } catch (e) {
            return null;
        } finally {
            host.remove();
        }
    }

    /* karakteradatok: név, mesterség, szint */
    function readCharacter() {
        const C = game().Character;
        if (!C || !C.name) return null;
        return C.name + "|" + (C.professionId || 0) + "|" + (C.professionSkill || 0);
    }

    /* ---- megtanult receptek folyamatos gyűjtése ----
       A last_craft mezős adat a szervertől jön; más kiegészítők később felülírhatják
       a listát. Ezért amint meglátjuk, eltesszük, és onnantól megmarad. */
    const learnedSet = new Set();

    function collectLearned() {
        const C = game().Crafting;
        if (!C || !C.recipes) return;
        Object.keys(C.recipes).forEach(k => {
            const r = C.recipes[k];
            if (r && Object.prototype.hasOwnProperty.call(r, "last_craft") && r.craftitem)
                learnedSet.add(r.craftitem / 1000);
        });
    }

    /* Amint a Crafting objektum megjelenik, azonnal ráülünk — még azelőtt,
       hogy más kiegészítő hozzáférne. A recipes tulajdonságot figyeljük:
       minden beírt értékből kimentjük a last_craft mezős recepteket. */
    function guardCrafting() {
        const W = game();
        if (W.__mkGuard) return;
        let target = W.Crafting;

        const grab = obj => {
            if (!obj) return;
            try {
                Object.keys(obj).forEach(k => {
                    const r = obj[k];
                    if (r && Object.prototype.hasOwnProperty.call(r, "last_craft") && r.craftitem)
                        learnedSet.add(r.craftitem / 1000);
                });
            } catch (e) { /* nem baj */ }
        };

        const hook = C => {
            if (!C || C.__mkHooked) return;
            let store = C.recipes;
            grab(store);
            try {
                Object.defineProperty(C, "recipes", {
                    configurable: true,
                    enumerable: true,
                    get() { return store; },
                    set(v) { grab(v); store = v; }
                });
                C.__mkHooked = true;
            } catch (e) { /* ha nem megy, marad az időzített gyűjtés */ }
        };

        if (target) { hook(target); }
        try {
            Object.defineProperty(W, "Crafting", {
                configurable: true,
                enumerable: true,
                get() { return target; },
                set(v) { target = v; hook(v); }
            });
            W.__mkGuard = true;
        } catch (e) { /* ha nem megy, marad az időzített gyűjtés */ }
    }
    guardCrafting();

    function watchCrafting() {
        guardCrafting();
        /* az addRecipe hívásait is elkapjuk, így a legkorábbi állapotot látjuk */
        const C = game().Crafting;
        if (C && typeof C.addRecipe === "function" && !C.__mkWrapped) {
            const orig = C.addRecipe;
            C.addRecipe = function (r) {
                try {
                    if (r && Object.prototype.hasOwnProperty.call(r, "last_craft") && r.craftitem)
                        learnedSet.add(r.craftitem / 1000);
                } catch (e) { /* nem baj */ }
                return orig.apply(this, arguments);
            };
            C.__mkWrapped = true;
        }
        collectLearned();
    }
    /* a lehető legkorábban kezdjük figyelni, hogy a last_craft mezős
       eredeti listát még más kiegészítők előtt lássuk */
    watchCrafting();
    setInterval(watchCrafting, 250);

    /* megtanult receptek — csak azok, amiken ott a last_craft mező.
       Ha más kiegészítő tölti fel a listát, ez üresen marad, és akkor nem küldünk semmit. */
    function readLearned() {
        collectLearned();                       /* hátha most is látunk újat */
        return learnedSet.size ? [...learnedSet] : null;
    }

    async function sendInventory(b) {
        const data = readInventory();
        if (!data.length) { flash(b, "?"); return; }
        const payload = data.join(",");
        try { GM_setClipboard(payload); } catch (e) { /* az URL úgyis viszi */ }
        let q = "imp=" + payload;
        const k = readCharacter();
        if (k) q += "&k=" + encodeURIComponent(k);
        const t = readLearned();
        if (t) q += "&t=" + t.join(",");
        try {
            const av = await readAvatar();
            if (av) q += "&av=" + encodeURIComponent(av);
        } catch (e) { /* kép nélkül is megy tovább */ }
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
