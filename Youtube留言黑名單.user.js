// ==UserScript==
// @name         Youtube留言黑名單
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  屏蔽黑名單內頻道在其他影片下的留言，可以查看和移除黑名單內的頻道。
// @author       Microdust
// @match        https://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?domain=youtube.com
// @grant        GM_getResourceText
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11.0.18/dist/sweetalert2.all.min.js
// ==/UserScript==

(function() {
    'use strict';

    //以下設定將在重載網頁後生效

    //是否刪除在黑名單內的留言true=刪除/false=不刪除留言但用deleteText裡的文字覆蓋
    const deleteComment = true;
    //不刪除留言時用deleteText裡的文字覆蓋
    const deleteText = "留言被屏蔽";
    //黑名單導出的檔名(不可為空)
    const exportName = "黑名單";
    //黑名單佔整個畫面的寬度比例
    const blacklistWidth = "50%";
    //名字顯示最長字數(超過此限制將會以'...'省略，數字為負將不限制)
    const nameLength = -1;
    //
    let btnSetting;
    let prelink;
    let link;
    let thisPath;
    let text;
    let viewURL;
    let workArea=true;
    let list = [];
    //
    let checkedComment;
    let path;
    let comment;
    let commentUserId;
    let commentUserName;
    let commentValue;
    let btnBlackList;
    let precomment=[];
    //
    let threadPath;
    let checkedReply;
    let replyPath;
    let reply;
    let replyUserId;
    let replyUserName;
    let replyValue;
    let replyBtn;
    let replyCount=[];
    let replyBan=[];
    let noReply=[];

    if(GM_getValue("list")) list=blacklist("init");
    //list.length=0;
    //blacklist("save");
    "/ytd-comment-thread-renderer[15]/div/ytd-comment-replies-renderer/div[1]/ytd-button-renderer[1]/a/tp-yt-paper-button/yt-formatted-string"
    setInterval(function(){
        link = window.location.href;
        if(prelink!=link) {
            prelink = window.location.href;
            workArea = true;
            checkedComment = 0;
            viewURL=false;
            noReply.length=0;
        }
        if(workArea) workArea=fnNameListCheck();
    }, 1000);

    function fnNameListCheck(){
        let pathName=window.location.pathname.split('/');
        if(!viewTypeFn(pathName,window.location.search.toString())) return false;
        if(checkedComment) btnSettingFn();
        while(getComment()){
            defData();
            checkedComment++;
        }
        getReplyExist();
        return true;
    }
    function viewTypeFn(viewType,val){
        if(viewType[1]=="watch") viewURL="/ytd-watch-flexy/div[5]/div[1]/div";
        if(viewType[1]=="post") viewURL="/ytd-browse/ytd-two-column-browse-results-renderer/div[1]/ytd-section-list-renderer/div[2]";
        if(viewType[3]=="community"&&val!="") viewURL="/ytd-browse/ytd-two-column-browse-results-renderer/div[1]/ytd-section-list-renderer/div[2]";
        threadPath="/html/body/ytd-app/div/ytd-page-manager"+viewURL+"/ytd-comments/ytd-item-section-renderer/div[3]/";
        return viewURL;
    }
    function btnSettingFn(){
        btnSetting=getElementByXpath("/html/body/ytd-app/div/ytd-page-manager"+viewURL+"/ytd-comments/ytd-item-section-renderer/div[1]/ytd-comments-header-renderer/div[5]/ytd-comment-simplebox-renderer/yt-img-shadow/img");
        if(!btnSetting) return;
        var oBlackList = document.createElement("div");
        for(let i=0;i<list.length;i++){
            var banner = document.createElement('button');
            banner.onclick=function(){
                let id = list[i].id;
                let name = list[i].name;
                wordPure(name);
                Swal.fire({
                    title: '確定要將 '+name+' 從黑名單移除嗎?',
                    text: '頻道ID('+id+')',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: '從黑名單移除',
                    cancelButtonText: '取消'
                }).then((result) => {
                    if (result.isConfirmed) {
                        Swal.fire(
                            '已將 '+name+' 從黑名單移除',
                            '頻道ID('+id+')',
                            'info'
                        ).then(() => {
                            list.splice(banlistSearch(id)-1,1);
                            //list.length = 0;
                            blacklist("save");
                        })
                    }
                })
            }
            banner.innerText=wordPure(list[i].name)+" ("+list[i].id+")";
            let br = document.createElement('br');
            oBlackList.append(banner);
            oBlackList.append(br);
        }
        if(list.length==0){
            banner = document.createElement('p');
            banner.innerText="沒有任何人被你列入黑名單";
            oBlackList.append(banner);
        }
        btnSetting.onclick=function(){
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
                            exportFn(GM_getValue("list"),exportName+".json");
                        }
                    })
                }
            })
        }
    }
    function getReplyExist(){
        for(let i=0;i<checkedComment+1;i++){
            if(noReply[i]) continue;
            let oreplyCountMain=getElementByXpath(threadPath+"/ytd-comment-thread-renderer["+i+"]/div/ytd-comment-replies-renderer/div[1]/ytd-button-renderer[1]/a/tp-yt-paper-button/yt-formatted-string");
            let oreplyCount=getElementByXpath(threadPath+"/ytd-comment-thread-renderer["+i+"]/div/ytd-comment-replies-renderer/div[1]/ytd-button-renderer[1]/a/tp-yt-paper-button/yt-formatted-string/span[2]");
            if(!(oreplyCountMain&&!oreplyCount)){
                if(!oreplyCount) noReply[i]=true;
                if(!oreplyCount) continue;
                if(parseInt(oreplyCount.textContent)===replyCount[i]) noReply[i]=true;
                if(parseInt(oreplyCount.textContent)===replyCount[i]) continue;
            }else{
                if(replyCount[i]===1) noReply[i]=true;
                if(replyCount[i]===1) continue;
            }
            checkedReply=1;
            if(replyCount[i]>0&&replyCount[i]%10===0) checkedReply=replyCount[i]+1;
            while(getReply(i)){
                foldedData(i);
                checkedReply++;
            }
            replyCount[i]=checkedReply-1;
        }
    }
    function getReply(thread){
        replyPath=threadPath+"/ytd-comment-thread-renderer["+thread+"]/div/ytd-comment-replies-renderer/div[1]/div/div[1]/ytd-comment-renderer["+checkedReply+"]";
        reply=document.evaluate(replyPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        return reply;
    }
    function foldedData(thread){
        replyUserId = getElementByXpath(replyPath+"/div[2]/div[2]/div[1]/div[2]/h3/a").href.toString().replace(/https:\/\/www.youtube.com\/channel\//g,"");
        replyUserName = getElementByXpath(replyPath+"/div[2]/div[2]/div[1]/div[2]/h3/a/span");
        if(replyUserName) replyUserName = replyUserName.textContent.toString().replace(/\n              /g,"").replace(/\n            /g,"");
        replyValue = getElementByXpath(replyPath+"/div[2]/div[2]/ytd-expander/div/yt-formatted-string[2]");
        btnBlackList = getElementByXpath(replyPath);
        btnBlackList.setAttribute("data-commentID",replyUserId);
        btnBlackList.setAttribute("data-commentName",replyUserName);
        btnBlackList.setAttribute("data-commentSeq",thread);
        if(banlistSearch(replyUserId)) {
            if(reply&&deleteComment) reply.style.display = 'none';
            if(replyValue) {
                replyValue.innerText = deleteText;
                replyValue.setAttribute("style","font-style: italic;");
            }
        }
        btnBlackList.ondblclick= function(){
            banCheck(
                this.getAttribute('data-commentID'),
                this.getAttribute('data-commentName'),
                this.getAttribute('data-commentSeq'),
                true
            );
        }
        //console.log(checkedReply,replyUserName,"reply");
    }
    function getComment(){
        path = "/html/body/ytd-app/div/ytd-page-manager"+viewURL+"/ytd-comments/ytd-item-section-renderer/div[3]/ytd-comment-thread-renderer["+(checkedComment+1)+"]";
        comment = document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if(comment===precomment[(checkedComment+1)]) return false;
        precomment[(checkedComment+1)]=comment
        return comment;
    }
    function defData(){
        commentUserId = getElementByXpath(path+"/ytd-comment-renderer/div[2]/div[2]/div[1]/div[2]/h3/a").href.toString().replace(/https:\/\/www.youtube.com\/channel\//g,"");
        commentUserName = getElementByXpath(path+"/ytd-comment-renderer/div[2]/div[2]/div[1]/div[2]/h3/a/span");
        if(commentUserName) commentUserName = commentUserName.textContent.toString().replace(/\n              /g,"").replace(/\n            /g,"");
        commentValue = getElementByXpath(path+"/ytd-comment-renderer/div[2]/div[2]/ytd-expander/div/yt-formatted-string[2]");
        btnBlackList = getElementByXpath(path+"/ytd-comment-renderer");
        btnBlackList.setAttribute("data-commentID",commentUserId);
        btnBlackList.setAttribute("data-commentName",commentUserName);
        btnBlackList.setAttribute("data-commentSeq",checkedComment+1);
        if(banlistSearch(commentUserId)) {
            if(comment&&deleteComment) comment.style.display = 'none';
            if(commentValue) {
                commentValue.innerText = deleteText;
                commentValue.setAttribute("style","font-style: italic;");
            }
        }
        btnBlackList.ondblclick= function(){
            banCheck(
                this.getAttribute('data-commentID'),
                this.getAttribute('data-commentName'),
                this.getAttribute('data-commentSeq')
            );
        }
        //console.log(checkedComment,commentUserName);
    }
    function banCheck(id,name,seq,fold){

        thisPath="/html/body/ytd-app/div/ytd-page-manager"+viewURL+"/ytd-comments/ytd-item-section-renderer/div[3]/ytd-comment-thread-renderer["+seq+"]";
        if(!fold) text = getElementByXpath(thisPath+"/ytd-comment-renderer/div[2]/div[2]/ytd-expander/div/yt-formatted-string[2]");
        if(fold) text = false;
        wordPure(name);
        if(!banlistSearch(id)){
            Swal.fire({
                title: '確定要將 '+name+' 列入黑名單嗎?',
                text: '頻道ID('+id+')',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: '列入黑名單',
                cancelButtonText: '取消'
            }).then((result) => {
                if (result.isConfirmed) {
                    Swal.fire(
                        '已將 '+name+' 列入黑名單',
                        '頻道ID('+id+')',
                        'info'
                    ).then(() => {
                        list.unshift({"id":id,"name":name});
                        //list.length = 0;
                        blacklist("save");
                        if(text) {
                            let info = document.createElement('span');
                            text.innerText ="";
                            while(text.length > 0) {
                                text.pop();
                            }
                            info.innerText = "留言將在之後屏蔽";
                            info.setAttribute("style","font-style: italic;color:red;");
                            text.append(info);
                        }else{
                            replyCount[seq]=0;
                            noReply[seq]=false;
                        }
                    })
                }
            })
        }else{
            Swal.fire({
                title: '確定要將 '+name+' 從黑名單移除嗎?',
                text: '頻道ID('+id+')',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: '從黑名單移除',
                cancelButtonText: '取消'
            }).then((result) => {
                if (result.isConfirmed) {
                    Swal.fire(
                        '已將 '+name+' 從黑名單移除',
                        '頻道ID('+id+')',
                        'info'
                    ).then(() => {
                        list.splice(banlistSearch(id)-1,1);
                        //list.length = 0;
                        blacklist("save");
                        if(text) {
                            let info = document.createElement('span');
                            text.innerText ="";
                            while(text.length > 0) {
                                text.pop();
                            }
                            info.innerText = "此留言者已從黑名單解封，之後就能再次看見";
                            info.setAttribute("style","font-style: italic;color:orange;");
                            text.append(info);
                        }
                    })
                }
            })
        }
    }
    function blacklist(event){
        if(event=="save") return GM_setValue("list", JSON.stringify(list));
        return JSON.parse(GM_getValue("list"));
    }
    function banlistSearch(id){
        for(let i=0;i<list.length;i++){
            if(list[i].id==id) {
                return i+1;
                break;
            }
        }
    }
    function exportFn(content, filename) {
        let odownload = document.createElement("a");
        odownload.download = filename;
        odownload.style.display = "none";
        let jsonBlob = new Blob([encodeURI(content,"utf-8")], {type:"text/plain;charset=utf-8"});
        odownload.href = URL.createObjectURL(jsonBlob);
        document.body.appendChild(odownload);
        odownload.click();
        document.body.removeChild(odownload);
    }
    function importFn(){
        let oimport = document.createElement("input");
        oimport.style.display = "none";
        oimport.type="file";
        oimport.accept=".json";
        oimport.onchange = function(){
            if(oimport.files.length != 0 && oimport.files[0].type.match(/json.*/)) {
                let reader = new FileReader();
                reader.onload = function(e) {
                    let loadData = JSON.parse(e.target.result);
                    Swal.fire({
                        title: '導入黑名單',
                        text: "請選擇要對新資料的處理方式",
                        confirmButtonText: '和原資料合併',
                        showDenyButton: true,
                        denyButtonText: '覆蓋原資料',
                        backdrop: 'rgba(0,0,0,0.6)'
                    }).then((result) => {
                        if (result.isDenied) {
                            list=loadData;
                            blacklist("save");
                            Swal.fire('已覆蓋原資料');
                        }else if (result.isConfirmed){
                            for(let i=0;i<loadData.length;i++){
                                if(!list.find(element => element.id === loadData[i].id)){
                                    //console.log(loadData[i]);
                                    list.unshift(loadData[i]);
                                }
                            }
                            blacklist("save");
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
    function wordPure(word){
        if(nameLength>=0 && word.length>nameLength){
            return word.substring(0,nameLength)+"...";
        }else{
            return word;
        }
    }
    function getElementByXpath(paths) {
        return document.evaluate(paths, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
})();