# AngelicLink_zh_cn (天使链接汉化脚本)

基于 Tampermonkey 的 DMM 游戏 エンジェリックリンク(天使链接) 网页版AI汉化脚本。

* 游戏每次从cloudflare worker同步最新汉化词库。
* 自动收集并上传未翻译文本（10分钟上传一次），采用**gemini-3-flash-preview**模型自动翻译，部分文本采用人工校准。
* 优化游戏内中文字体显示。

##  食用方法
*(A. 点击 [这里](https://raw.githubusercontent.com/mrrockist/angeliclink_zh_cn/main/angeliclink.user.js) 安装脚本。)*

*(B. 通过Greasy Fork [订阅](https://greasyfork.org/zh-CN/scripts/569494-%E3%82%A8%E3%83%B3%E3%82%B8%E3%82%A7%E3%83%AA%E3%83%83%E3%82%AF%E3%83%AA%E3%83%B3%E3%82%AF-translate-chs) )*

##  隐私声明
为了不断完善汉化库，本脚本只会在后台自动收集游戏中**未被翻译的日文文本**，并匿名上传至cloudflare worker。不会收集您的账号、密码或其他个人隐私数据。

##  开源协议
[MIT License](LICENSE)
