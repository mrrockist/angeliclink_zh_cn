// ==UserScript==
// @name         angeliclink translate zhcn
// @name:zh-CN   天使链接简体中文汉化
// @name:zh-TW   天使鏈接簡體中文漢化
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  DMM Game エンジェリックリンク (天使链接) 汉化脚本
// @description:zh-CN DMM Game エンジェリックリンク (天使链接) 汉化脚本
// @description:zh-TW DMM Game エンジェリックリンク (天使鏈接) 漢化腳本
// @author       mrrockist
// @match        https://ancl.jp/*
// @icon         https://p.dmm.com/p/general/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// @license      MIT
// @homepageURL  https://github.com/mrrockist/angeliclink_zh_cn
// @supportURL   https://github.com/mrrockist/angeliclink_zh_cn/issues
// @downloadURL  https://raw.githubusercontent.com/mrrockist/angeliclink_zh_cn/main/angeliclink.user.js
// @updateURL    https://raw.githubusercontent.com/mrrockist/angeliclink_zh_cn/main/angeliclink.user.js
// ==/UserScript==

(function () {
    'use strict';
    if (!window.location.href.includes('/game/pc/start/')) return;
    const API_URL = 'https://angel-link-api.mrrockist.workers.dev';

    // 从本地存储读取状态
    let transDict = GM_getValue('angel_link_local_dict', {});
    let lastSyncTime = GM_getValue('angel_link_last_sync', 0);
    let untranslatedSet = new Set(GM_getValue('angel_link_untranslated',[]));
    let submittedSet = new Set(GM_getValue('angel_link_submitted',[]));
    let pendingUploadSet = new Set();
    const translatedValues = new Set();

    function refreshTranslatedValues() {
        translatedValues.clear();
        for (let key in transDict) {
            if (transDict[key] && transDict[key].trim() !== "") {
                translatedValues.add(transDict[key]);
            }
        }
    }
    refreshTranslatedValues();

    const networkBlacklistUrls =['img/under_game', 'angel-link-api'];

    function isExcludedUrl(url) {
        return url && typeof url === 'string' && networkBlacklistUrls.some(k => url.includes(k));
    }

    // 字体设置
    const fontName = 'FZZhengHei_Web';
    const fontUrl = 'https://raw.githubusercontent.com/mrrockist/angeliclink_zh_cn/main/%E6%96%B9%E6%AD%A3%E6%AD%A3%E4%B8%AD%E9%BB%91_GBK.ttf';
    const fixedFontStack = `"${fontName}", "方正正中黑_GBK", "方正正中黑简体", "SimHei", "黑体", "Microsoft YaHei", sans-serif`;

    function forceInjectAndPreloadFont() {
        if (!document.head || !document.body) {
            requestAnimationFrame(forceInjectAndPreloadFont);
            return;
        }
        const style = document.createElement('style');
        style.innerHTML = `
            @font-face {
                font-family: '${fontName}';
                src: local('方正正中黑_GBK'), local('FZZhengHei-M-GBK'), url('${fontUrl}') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }
            body, div, span, p, a, button, input {
                font-family: ${fixedFontStack} !important;
                text-shadow: 0.5px 0.5px 1px rgba(0,0,0,0.2) !important;
            }
        `;
        document.head.appendChild(style);
        if (document.fonts && document.fonts.load) {
            document.fonts.load(`16px "${fontName}"`).catch(() => { });
        }
    }
    forceInjectAndPreloadFont();

    // 补齐空格实现左对齐
    function padTextToLeftAlign(cnText, jpLength) {
        if (cnText.length >= jpLength) return cnText;
        const diff = jpLength - cnText.length;
        return cnText + "　".repeat(diff); // 全角空格
    }

    // 获取 Canvas 翻译文本
    function getCanvasTranslatedText(text) {
        if (typeof text === 'string' && text.trim() !== '') {
            if (transDict[text]) {
                const jpLength = text.length;
                let cnText = transDict[text];
                if (jpLength <= 12) {
                    cnText = padTextToLeftAlign(cnText, jpLength);
                }
                return cnText;
            }
        }
        return text;
    }

    // Canvas API 劫持
    try {
        const originalFillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
            return originalFillText.call(this, getCanvasTranslatedText(text), x, y, maxWidth);
        };

        const originalStrokeText = CanvasRenderingContext2D.prototype.strokeText;
        CanvasRenderingContext2D.prototype.strokeText = function (text, x, y, maxWidth) {
            return originalStrokeText.call(this, getCanvasTranslatedText(text), x, y, maxWidth);
        };

        const fontDesc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
        Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
            get: function () {
                return fontDesc.get.call(this);
            },
            set: function (val) {
                if (typeof val === 'string') {
                    val = val.replace(/\b(normal|lighter|[1-4]00)\b/ig, "").trim();
                    if (!new RegExp(`(方正|FZZ|FZ正|${fontName})`, 'i').test(val) && !val.includes('Microsoft YaHei')) {
                        val = val.replace(/(px|pt)\s+(.+)/, `$1 ${fixedFontStack}, $2`);
                    }
                }
                fontDesc.set.call(this, val);
            }
        });
    } catch (e) { }

    // 文本匹配正则
    const jpRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/; // 平假名、片假名、汉字
    const numSymRegex = /^[\d\s+\-・*/.,%A-Za-z_]+$/; // 纯数字/符号/英文
    const ignoreJSONKeys =['kana', 'yomi', 'ruby', 'sort', 'bgm', 'voice'];

    // 判断是否为需要翻译的日文
    function isJapanese(text) {
        if (!text || typeof text !== 'string' || text.trim() === '') return false;
        if (text.length <= 1 || text.length > 500) return false;
        if (numSymRegex.test(text)) return false;
        return jpRegex.test(text);
    }

    // JSON 遍历替换收集
    function startDeepCollect(rootObj) {
        if (!rootObj || typeof rootObj !== 'object') return;
        const visited = new WeakSet();

        function traverse(obj, depth = 0) {
            if (depth > 50 || !obj || typeof obj !== 'object') return;
            if (visited.has(obj)) return;
            visited.add(obj);

            const keys = Array.isArray(obj) ? obj : Object.keys(obj);
            for (let i = 0; i < keys.length; i++) {
                const key = Array.isArray(obj) ? i : keys[i];
                if (typeof key === 'string' && ignoreJSONKeys.some(k => key.toLowerCase().includes(k))) {
                    continue;
                }

                let value = obj[key];
                if (typeof value === 'string') {
                    if (isJapanese(value) && !translatedValues.has(value)) {
                        if (transDict[value] && transDict[value].trim() !== "") {
                            // 存在翻译则替换
                            obj[key] = transDict[value];
                        } else if (transDict[value] === "") {
                            continue;
                        } else {
                            // 不存在翻译则收集
                            if (!untranslatedSet.has(value)) {
                                untranslatedSet.add(value);
                                if (!submittedSet.has(value)) pendingUploadSet.add(value);
                            }
                        }
                    }
                } else if (value !== null && typeof value === 'object') {
                    traverse(value, depth + 1);
                }
            }
        }
        traverse(rootObj);
    }

    // 劫持 JSON.parse
    const originalParse = window.JSON.parse;
    window.JSON.parse = function (text, reviver) {
        let result = originalParse.call(this, text, reviver);
        try {
            startDeepCollect(result);
        } catch (e) { }
        return result;
    };

    // 劫持 Fetch API
    const originalFetchJson = Response.prototype.json;
    Response.prototype.json = function () {
        const url = this.url || "";
        return originalFetchJson.call(this).then(result => {
            if (!isExcludedUrl(url)) {
                try {
                    startDeepCollect(result);
                } catch (e) { }
            }
            return result;
        });
    };

    // 劫持 XMLHttpRequest
    try {
        const originalXhrOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, ...args) {
            this.__reqUrl = url ? url.toString() : "";
            return originalXhrOpen.call(this, method, url, ...args);
        };

        const xhrDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response');
        if (xhrDesc && xhrDesc.get) {
            const originalXhrGet = xhrDesc.get;
            Object.defineProperty(XMLHttpRequest.prototype, 'response', {
                get: function () {
                    let result = originalXhrGet.call(this);
                    if (this.responseType === 'json' && result && typeof result === 'object') {
                        if (!isExcludedUrl(this.responseURL || this.__reqUrl)) {
                            try {
                                startDeepCollect(result);
                            } catch (e) { }
                        }
                    }
                    return result;
                }
            });
        }
    } catch (e) { }

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let msgQueue =[];
    let isPlaying = false;
    let capsule;

    window.addEventListener('load', () => {
        capsule = document.createElement('div');
        capsule.style.cssText = `
            position: fixed; top: 15px; left: 15px; z-index: 999999;
            background: rgba(0,0,0,0.85); padding: 8px 16px; border-radius: 6px;
            color: white; font-family: ${fixedFontStack}; font-size: 13px; font-weight: bold;
            pointer-events: none; transition: opacity 0.4s ease, transform 0.4s ease; user-select: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4); opacity: 0; transform: translateX(-20px);
            border-left: 4px solid transparent;
        `;
        document.body.appendChild(capsule);

        pushMsg("天使链接汉化启动中...", "#E91E63", 3000);
        pushMsg("Power By mrrockist", "#9C27B0", 2500);

        syncWithCloud();
    });

    async function pushMsg(text, color, duration = 3000) {
        msgQueue.push({ text, color, duration });
        if (!isPlaying) {
            isPlaying = true;
            while (msgQueue.length > 0) {
                let m = msgQueue.shift();
                capsule.innerText = m.text;
                capsule.style.borderLeftColor = m.color || '#fff';
                capsule.style.opacity = "1";
                capsule.style.transform = "translateX(0)";
                await sleep(m.duration);
                capsule.style.opacity = "0";
                capsule.style.transform = "translateX(10px)";
                await sleep(400);
                capsule.style.transform = "translateX(-20px)";
                await sleep(50);
            }
            isPlaying = false;
        }
    }

    // 从服务器同步最新词库
    async function syncWithCloud() {
        try {
            let res = await fetch(`${API_URL}/api/sync?since=${lastSyncTime}`);
            let data = await res.json();
            let newWordsCount = 0;

            if (data.download_url) {
                // 下载全量包
                pushMsg("正在获取全量基础汉化包...", "#FF9800", 2000);
                let snapRes = await fetch(`${API_URL}${data.download_url}`);
                let snapData = await snapRes.json();
                Object.assign(transDict, snapData.data);
                lastSyncTime = snapData._update_time;
                newWordsCount += Object.keys(snapData.data).length;

                // 追加下载增量包
                let deltaRes = await fetch(`${API_URL}/api/sync?since=${lastSyncTime}`);
                let deltaData = await deltaRes.json();
                if (deltaData.delta && Object.keys(deltaData.delta).length > 0) {
                    Object.assign(transDict, deltaData.delta);
                    lastSyncTime = deltaData.timestamp;
                }
            } else if (data.delta) {
                // 仅增量更新
                newWordsCount = Object.keys(data.delta).length;
                if (newWordsCount > 0) Object.assign(transDict, data.delta);
                lastSyncTime = data.timestamp;
            }

            if (newWordsCount > 0) {
                // 移除已经被汉化的未翻译文本记录
                for (let key of untranslatedSet) {
                    if (transDict[key] && transDict[key].trim() !== "") {
                        untranslatedSet.delete(key);
                        pendingUploadSet.delete(key);
                        submittedSet.delete(key);
                    }
                }

                // 保存到本地
                GM_setValue('angel_link_local_dict', transDict);
                GM_setValue('angel_link_last_sync', lastSyncTime);
                GM_setValue('angel_link_untranslated', Array.from(untranslatedSet));
                GM_setValue('angel_link_submitted', Array.from(submittedSet));
                refreshTranslatedValues();

                pushMsg(`✨ 发现 ${newWordsCount} 条新汉化！`, "#4CAF50", 5000);
            } else {
                pushMsg("您的汉化是最新版", "#03A9F4", 3000);
            }
        } catch (err) { }
    }

    // 上传未翻译文本
    async function uploadRawTexts(isManual = false) {
        if (pendingUploadSet.size === 0) {
            if (isManual) pushMsg("当前没有新文本需要上传", "#9e9e9e", 2000);
            return;
        }

        const textsToUpload = Array.from(pendingUploadSet);
        try {
            let res = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texts: textsToUpload })
            });
            let data = await res.json();
            if (data.success) {
                textsToUpload.forEach(t => submittedSet.add(t));
                pendingUploadSet.clear();

                GM_setValue('angel_link_untranslated', Array.from(untranslatedSet));
                GM_setValue('angel_link_submitted', Array.from(submittedSet));

                pushMsg(`贡献了 ${textsToUpload.length} 条新文本，感谢！`, "#9C27B0", 3000);
            }
        } catch (err) {
            if (isManual) pushMsg("上传文本失败，请检查网络", "#f44336", 2000);
        }
    }

    // 每10分钟自动上传一次未翻译文本
    setInterval(() => uploadRawTexts(false), 10 * 60 * 1000);

    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'u') {
            e.preventDefault();
            e.stopPropagation();
            uploadRawTexts(true);
        }
    }, true);

})();
