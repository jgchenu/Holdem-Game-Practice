# Wendao Serif

这是基于 Noto Serif SC 可变字体生成的项目字形子集，仅包含界面、课程与牌桌使用的文字及基础标点。派生字体命名为 Wendao Serif，保留原始版权与 SIL Open Font License，详见同目录 OFL.txt。字体在本地随 Web 与原生包分发，不请求在线字体服务。

上游：[Google Fonts / Noto Serif SC](https://github.com/google/fonts/tree/main/ofl/notoserifsc)，源文件 `NotoSerifSC[wght].ttf`。生成时使用 fonttools[woff] 4.67.0。

字体源版本：`2e61f4355afd22b801791b0df176065082423b87`。SHA-256：`050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9`。当前子集为 749 个映射字符、290,652 字节。

重新生成：将上游文件下载为 `artifacts/fonts/NotoSerifSC.ttf`，在独立 Python 环境安装 `fonttools[woff]==4.67.0`，运行 `python scripts/font-subset.py`。新增界面文字时应重新生成；不在子集中的字符仍使用系统字体回退。保留当前 OFL.txt 随字体一起分发。
