## 腳本下載:
[![下載YT黑名單腳本](https://github.com/wuilliam104286/image_saves/blob/master/img/button/btn-dl-red-ch.png?raw=true "下載YT黑名單腳本")](https://greasyfork.org/zh-TW/scripts/428366-youtube%E7%95%99%E8%A8%80%E9%BB%91%E5%90%8D%E5%96%AE "下載YT黑名單腳本")

## 腳本功能&注意事項:
- 屏蔽黑名單內頻道在其他影片下的留言
- 可以查看和移除黑名單內的頻道
- 此腳本僅能屏蔽影片和社群下方留言
- 黑名單可以導入/導出json檔
- 黑名單由上而下為新->舊
- 無需登入，只要允許在無痕模式下運作，開無痕也能使用
- 此腳本才剛完成，尚在測試中
- 此腳本語言為繁體中文

## 腳本內設定:腳本內設定:
- 是否刪除在黑名單內的留言true=刪除/false=不刪除留言但用deleteText裡的文字覆蓋
> 默認: const deleteComment = true;

- 不刪除留言時用deleteText裡的文字覆蓋
> 默認: const deleteText = "留言被屏蔽";

- 黑名單導出的檔名(不可為空)
> 默認: const exportName = "黑名單";

- 黑名單佔整個畫面的寬度比例
> 默認: const blacklistWidth = "50%";

- 名字顯示最長字數(超過此限制將會以'...'省略，數字為負將不限制)
> 默認: const nameLength = -1;
