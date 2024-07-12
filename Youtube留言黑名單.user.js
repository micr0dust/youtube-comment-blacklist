// ==UserScript==
// @name         Youtube留言黑名單
// @namespace    http://tampermonkey.net/
// @version      1.7.0
// @description  屏蔽黑名單內頻道在其他影片下的留言，可以查看和移除黑名單內的頻道。
// @author       Microdust
// @match        https://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?domain=youtube.com
// @grant        GM_getResourceText
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
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

    var comment_ptr = 0;
    var last_length = 0;
    var ban_set = new Set(GM_getValue("blacklist")?blacklist("load"):[]);

    const box_add = ((id)=>{
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
    });

    const box_remove = ((id)=>{
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
    });

    function btnSettingFn(){
        const comment_area = getElementByXpath('//*[@id="comments"]');
        const btnSetting = comment_area.querySelector("#img");
        let oBlackList = document.createElement("div");
        let ban_setlist = Array.from(ban_set);
        if (ban_setlist.length == 0) {
            console.log("沒有任何人被你列入黑名單");
            let banner = document.createElement('p');
            banner.innerText = "沒有任何人被你列入黑名單";
            oBlackList.append(banner);
        }
        for (let i = 0; i < ban_setlist.length; i++) {
            let banner = document.createElement('button');
            banner.onclick = function() {
                let id = ban_setlist[i];
                Swal.fire(box_remove(id)).then((result) => {
                    if (result.isConfirmed) {
                        Swal.fire(
                            `已將 ${id} 從黑名單移除`,
                            `@${id}`,
                            'info'
                        ).then(() => {
                            ban_set.delete(id);
                            blacklist("save");
                            btnSettingFn();
                        })
                    }
                })
            }
            banner.innerText = ban_setlist[i];
            let br = document.createElement('br');
            oBlackList.append(banner);
            oBlackList.append(br);
        }
        btnSetting.onclick = function() {
            Swal.fire({
                title: '黑名單',
                width: blacklistWidth,
                html: this.appendChild(oBlackList),
                confirmButtonText: '確認',
                showDenyButton: true,
                denyButtonText: '導出/導入',
                backdrop: 'rgba(0,0,0,0.6)'
            }).then((result) => {
                if (result.isDenied) {
                    Swal.fire({
                        title: '黑名單(導出/導入)',
                        icon: 'question',
                        confirmButtonText: '導入',
                        showDenyButton: true,
                        denyButtonText: '導出',
                        backdrop: 'rgba(0,0,0,0.6)'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            importFn();
                        } else if (result.isDenied) {
                            exportFn(GM_getValue("blacklist"), exportName + ".json");
                        }
                    })
                }
            })
        }
    }

    function checkAndHandleHead() {
        const comment_area = getElementByXpath('//*[@id="comments"]');
        const btnSetting = comment_area.querySelector("#img");
        if (btnSetting) {
            // 如果找到自己的頭像
            btnSettingFn();
            // 一旦找到自己的頭像，就不再需要監聽頁面的根元素
            headObserver.disconnect();
        }
    }

    const headObserver = new MutationObserver(checkAndHandleHead);

    // 定義一個函數來處理留言檢查的邏輯
    function handleComments(comment_area) {
        const comment_list = comment_area.querySelectorAll('ytd-comment-thread-renderer');
        if(last_length==comment_list.length)
            return;
        last_length = comment_list.length;
        for (let i = comment_ptr; i < comment_list.length; i++) {
            let display = commentCheck(comment_list[i]);
            if(!display) ban_comment(comment_list[i]);
        }
        comment_ptr = comment_list.length;
    }

    // 定義一個函數來檢查 comment_area 是否存在並進行處理
    function checkAndHandleComments() {
        const comment_area = getElementByXpath('//*[@id="comments"]');
        if (comment_area) {
            // 如果找到留言區域，則設置 MutationObserver 來處理留言
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList') {
                        handleComments(comment_area);
                    }
                });
            });

            // 配置觀察者並開始觀察 comments
            const config = { childList: true, subtree: true };
            observer.observe(comment_area, config);

            // 配置觀察者並開始觀察 setting button
            headObserver.observe(comment_area, { childList: true, subtree: true });
            
            // 一旦設置了留言處理，就不再需要監聽頁面的根元素
            bodyObserver.disconnect();
        }
    }

    // 使用 MutationObserver 監聽頁面的根元素，等待 comment_area 出現
    const bodyObserver = new MutationObserver(checkAndHandleComments);
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    // 初始時嘗試檢查 comment_area 是否已存在
    checkAndHandleComments();

    function commentCheck(element, is_reply = false) {
        const commentObj = {
            name: decodeURIComponent(element.querySelector("#author-text").href.split('@')[1]),
            text: element.querySelector("#content-text > span").textContent,
            thumbnail: element.querySelector("#img").src,
            time: element.querySelector("#published-time-text > a").textContent.trim(),
            likes: element.querySelector("#vote-count-middle").textContent.trim()
        };
        element.setAttribute("data-replies", 0);
        // console.log(commentObj);
        // element.setAttribute("data-commentID", commentObj.name);
        if(!is_reply){
            // let max_replies = element.querySelector("#more-replies > yt-button-shape > button") ? parseInt(element.querySelector("#more-replies > yt-button-shape > button").textContent.trim().split(' ')[0]) : 0;
            element.setAttribute("data-replies", element.querySelectorAll("#contents > ytd-comment-view-model").length||0);
            element.onclick = function() {
                let targetNode = this.querySelector("#contents");
                let last_replies = targetNode.querySelectorAll("ytd-comment-view-model").length;
                element.setAttribute("data-replies", last_replies);

                // 使用 MutationObserver 監聽 DOM 變化
                let observer = new MutationObserver(function(mutations) {
                    mutations.forEach(function(mutation) {
                        if (mutation.type === "childList") {
                            let now_replies = targetNode.querySelectorAll("ytd-comment-view-model").length;
                            if (now_replies !== last_replies) {
                                replies_check(element, last_replies);
                                observer.disconnect();
                            }
                        }
                    });
                });

                // 配置觀察選項:
                let config = { childList: true, subtree: true };
                observer.observe(targetNode, config);

                // 設置 5 秒後停止觀察
                setTimeout(() => {
                    observer.disconnect();
                }, 5000);
            }
            element.querySelector("#comment").ondblclick = function() {
                banCheck(commentObj.name);
            }
        }else{
            element.ondblclick = function() {
                banCheck(commentObj.name);
            }
        }
        return !ban_set.has(commentObj.name) && wordFilter(commentObj.text);
    }

    function replies_check(element, idx) {
        let oreplies = element.querySelectorAll("#contents > ytd-comment-view-model");
        for(let i=idx; i<oreplies.length; i++){
            let display = commentCheck(oreplies[i], true);
            if(!display) ban_comment(oreplies[i]);
        }
    }

    function banCheck(id) {
        if (!ban_set.has(id)) {
            Swal.fire(box_add(id)).then((result) => {
                if (result.isConfirmed) {
                    Swal.fire(
                        `已將 ${id} 列入黑名單`,
                        `@${id}`,
                        'info'
                    ).then(() => {
                        ban_set.add(id);
                        blacklist("save");
                        btnSettingFn();
                    })
                }
            })
        } else {
            Swal.fire(box_remove(id)).then((result) => {
                if (result.isConfirmed) {
                    Swal.fire(
                        `已將 ${id} 從黑名單移除`,
                        `@${id}`,
                        'info'
                    ).then(() => {
                        ban_set.delete(id);
                        blacklist("save");
                        btnSettingFn();
                    });
                }
            })
        }
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
                            blacklist("save");
                            btnSettingFn();
                            Swal.fire('已覆蓋原資料');
                        } else if (result.isConfirmed) {
                            let new_ban_set = new Set(loadData);
                            ban_set = new Set([...ban_set, ...new_ban_set]);
                            blacklist("save");
                            btnSettingFn();
                            Swal.fire('已合併兩資料');
                        }
                    })
                    reader.onerror = function(e) {
                        Swal.fire('無法讀取檔案');
                    }
                }
                reader.readAsText(oimport.files[0], "ISO-8859-1");
            } else {
                Swal.fire('上傳的檔案非json檔');
            }
        }
        oimport.click();
    }

    function ban_comment(element){
        if(!element) return;
        if (deleteComment) element.style.display = 'none';
        else element.querySelector("#content-text > span").textContent = deleteText;
    }

    function wordFilter(commentText) {
        if (commentMinLength > 0 && commentText.length < commentMinLength) return false;
        if (commentMaxLength > 0 && commentText.length > commentMaxLength) return false;
        if (banWords.length <= 0) return true;
        for (let i = 0; i < banWords.length; i++) {
            if (commentText.indexOf(banWords[i]) + 1) return false;
        }
        return true;
    }

    function blacklist(event) {
        if (event == "save") return GM_setValue("blacklist", JSON.stringify(Array.from(ban_set)));
        return JSON.parse(GM_getValue("blacklist"));
    }

    function getElementByXpath(paths) {
        return document.evaluate(paths, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
})();