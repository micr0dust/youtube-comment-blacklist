// ==UserScript==
// @name         Youtube留言黑名單
// @namespace    http://tampermonkey.net/
// @version      1.8.0
// @description  屏蔽黑名單內頻道在其他影片下的留言，封鎖後立即生效且不重新載入網頁。
// @author       Microdust & AI Refactor
// @match        https://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?domain=youtube.com
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11.0.18/dist/sweetalert2.all.min.js
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    //以下設定將在重載網頁後生效

    //是否刪除在黑名單內的留言： true=刪除 / false=不刪除留言但用 deleteText 裡的文字覆蓋
    const deleteComment = true;
    //不刪除留言時用 deleteText 裡的文字覆蓋
    const deleteText = "--留言被黑名單屏蔽--";
    //#黑名單-導出的檔名(不可為空)
    const exportName = "黑名單";
    //#黑名單-佔整個畫面的寬度比例
    const blacklistWidth = "50%";
    //留言最小字數過濾，設為0則不限制(需小於留言最大字數)
    const commentMinLength = 0;
    //留言最大字數過濾，設為0則不限制(需大於留言最小字數)
    const commentMaxLength = 0;
    //關鍵字過濾
    const banWords = [
        //    "將要過濾的關鍵字填入雙引號中","刪除註解以啟用過濾","可自由增減關鍵字"
    ];
    //
    //以下為範例:
    /*---------------------------------
       const banWords=[
           "關","鍵字","範例"
       ];
    ---------------------------------*/

    let trustedPolicy;
    if (window.trustedTypes) {
        try {
            trustedPolicy = trustedTypes.createPolicy('default', { createHTML: (input) => input });
        } catch (e) {
            trustedPolicy = { createHTML: (input) => input };
        }
    } else {
        trustedPolicy = { createHTML: (input) => input };
    }

    var ban_set = new Set(GM_getValue("blacklist") ? blacklist("load") : []);

    function blacklist(event) {
        if (event == "save") return GM_setValue("blacklist", JSON.stringify(Array.from(ban_set)));
        return JSON.parse(GM_getValue("blacklist"));
    }

    const saveBlacklist = () => blacklist("save");

    const getIDfromHref = (href) => {
        if (!href) return "";
        return decodeURIComponent(href).replace(/^.*\/@/, "").replace(/^.*\/user\//, "").replace(/^.*\/channel\//, "");
    };

    const view = {
        add: ((id)=>{
            return {
                title: `確定要將 ${id} 列入黑名單嗎?`,
                text: `@${id}`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: '列入黑名單',
                cancelButtonText: '取消'
            }
        }),
        remove: ((id)=>{
            return {
                title: `確定要將 ${id} 從黑名單移除嗎?`,
                text: `@${id}`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: '從黑名單移除',
                cancelButtonText: '取消'
            }
        }),
        list: (listHtml) => {
            return {
                title: '黑名單',
                html: listHtml,
                width: blacklistWidth,
                confirmButtonText: '確認',
                showDenyButton: true,
                denyButtonText: '導出/導入',
                backdrop: 'rgba(0,0,0,0.6)'
            };
        },
        list_entry: ((id, container)=>{
            let btn = document.createElement('button');
            btn.innerText = id;
            btn.className = "swal2-info swal2-styled";
            btn.style.margin = "2px";
            btn.onclick = () => {
                Swal.fire(view.remove(id)).then(r => {
                    if (r.isConfirmed) {
                        ban_set.delete(id);
                        saveBlacklist();
                        Swal.fire(`已將 ${id} 從黑名單移除`, `@${id}`, 'info');
                    }
                });
            };
            container.appendChild(btn);
        }),
        list_import_export: ()=>{
            return {
                title: '導出/導入',
                showDenyButton: true,
                denyButtonText: '導出檔案',
                confirmButtonText: '導入檔案'
            }
        }
    }

    function setupSettingBtn() {
        const comment_area = document.querySelector('#comments');
        if (!comment_area) return;

        const btnSetting = comment_area.querySelector("#author-thumbnail #img");
        if (!btnSetting || btnSetting.dataset.hasEvent) return;

        btnSetting.style.border = "2px solid #3085d6";
        btnSetting.title = "點擊開啟黑名單設定";
        btnSetting.dataset.hasEvent = "true";

        btnSetting.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            let listHtml = document.createElement('div');
            listHtml.style.maxHeight = "300px";
            listHtml.style.overflowY = "auto";

            if (ban_set.size === 0) listHtml.innerHTML = "<p>清單目前是空的</p>";

            ban_set.forEach(id => view.list_entry(id, listHtml));

            Swal.fire(view.list(listHtml)).then(r => {
                if (r.isDenied) {
                    Swal.fire(view.list_import_export()).then(r2 => {
                        if (r2.isConfirmed) importFn();
                        else if (r2.isDenied) exportFn(GM_getValue("blacklist"), exportName + ".json");
                    });
                }
            });
        };
    }

    function processCommentNode(node) {
        const authorAnchor = node.querySelector("#author-text");
        if (!authorAnchor) return;

        const userID = getIDfromHref(authorAnchor.getAttribute("href"));
        const contentEl = node.querySelector("#content-text");
        const commentText = contentEl ? contentEl.textContent.trim() : "";

        if (!node.dataset.hasDblClick) {
            node.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                Swal.fire(view.add(userID)).then(r => {
                    if (r.isConfirmed) {
                        ban_set.add(userID);
                        saveBlacklist();
                        scanComments();
                        Swal.fire(`已將 ${userID} 列入黑名單`, `@${userID}`, 'info');
                    }
                });
            });
            node.dataset.hasDblClick = "true";
        }

        const shouldBlock = ban_set.has(userID) || !wordFilter(commentText);

        if (shouldBlock) {
            if (deleteComment) {
                const thread = node.closest('ytd-comment-thread-renderer');
                if (thread && node.id === "comment") {
                    thread.style.display = 'none';
                } else {
                    node.style.display = 'none';
                }
            } else {
                if (contentEl) contentEl.innerText = deleteText;
            }
        }
    }

    function wordFilter(text) {
        if (commentMinLength > 0 && text.length < commentMinLength) return false;
        if (commentMaxLength > 0 && text.length > commentMaxLength) return false;
        if (banWords.length === 0) return true;
        for (let i = 0; i < banWords.length; i++) {
            if (text.indexOf(banWords[i]) !== -1) return false;
        }
        return true;
    }

    function scanComments() {
        const allComments = document.querySelectorAll('ytd-comment-view-model');
        allComments.forEach(processCommentNode);
        setupSettingBtn();
    }

    function exportFn(content, filename) {
        let odownload = document.createElement("a");
        odownload.download = filename;
        odownload.style.display = "none";
        let jsonBlob = new Blob([encodeURI(content, "utf-8")], { type: "text/plain;charset=utf-8" });
        odownload.href = URL.createObjectURL(jsonBlob);
        document.body.appendChild(odownload);
        odownload.click();
        document.body.removeChild(odownload);
    }

    function importFn() {
        let oimport = document.createElement("input");
        oimport.style.display = "none";
        oimport.type = "file";
        oimport.accept = ".json";
        oimport.onchange = function() {
            if (oimport.files.length != 0 && oimport.files[0].type.match(/json.*/)) {
                let reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        let loadData = JSON.parse(decodeURIComponent(e.target.result));
                        Swal.fire({
                            title: '導入黑名單',
                            text: "請選擇要對新資料的處理方式",
                            confirmButtonText: '和原資料合併',
                            showDenyButton: true,
                            denyButtonText: '覆蓋原資料',
                            backdrop: 'rgba(0,0,0,0.6)'
                        }).then((result) => {
                            if (result.isDenied) {
                                ban_set = new Set(loadData);
                                saveBlacklist();
                                scanComments();
                                Swal.fire('已覆蓋原資料');
                            } else if (result.isConfirmed) {
                                let new_ban_set = new Set(loadData);
                                ban_set = new Set([...ban_set, ...new_ban_set]);
                                saveBlacklist();
                                scanComments();
                                Swal.fire('已合併兩資料');
                            }
                        });
                    } catch (err) {
                        Swal.fire('無法讀取檔案或格式錯誤');
                    }
                }
                reader.readAsText(oimport.files[0], "ISO-8859-1");
            } else {
                Swal.fire('上傳的檔案非json檔');
            }
        }
        oimport.click();
    }

    // 監聽 DOM 變化
    let timer = null;
    const observer = new MutationObserver(() => {
        if (timer) return;
        timer = setTimeout(() => {
            scanComments();
            timer = null;
        }, 100);
    });

    function init() {
        const target = document.querySelector('ytd-app') || document.body;
        observer.observe(target, { childList: true, subtree: true });
        scanComments();
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        init();
    } else {
        window.addEventListener("DOMContentLoaded", init);
    }
})();