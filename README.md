cooky-template
==============

Template engine in node.js

cooky-templateはシンプルな機能を持つテンプレートエンジンです。  
特徴として、非同期なユーザー定義テンプレート関数に対応しています。

## Simple Example
以下のコードがcooky-templateができることの全てです。

__sample.js__
```js
module.exports.args = {
    fileDir  : './',
    isStrict : true,
};
var CookyTemplate = require('cooky-template');

// テンプレートファイル名（module.exports.args.fileDir以降）
var tplFile = '010_sample.tpl';

// テンプレートパラメタ
var tplParam = {
    title : 'CookyTemplate',
    say   : 'hello!',
    money : 10000,
    flag  : true,
    flag2 : false,
    list  : ['taro', 'jiro', 'hanako'],
    info  : [
        {key:'name', value:'cooky'},
        {key:'version', value:'1.0.0'},
        {key:'desc', value:'Template engine in node.js'},
    ],
};

// テンプレート関数
var tplFuncsName = 'echo, echoAsync';
var tplFuncsArray = [
    // echo
    function(cc, callback, arg){
        callback(null, arg);
    },
    // echoAsync
    function(cc, callback, arg){
        process.nextTick(function(){
            callback(null, arg);
        });
    },
];

// 解析
CookyTemplate.compile(
    tplFile,
    null, // or cooky-chain object.
    tplParam,
    tplFuncsName,
    tplFuncsArray,
    function(err, warns, data){ // callback
        if (err) {
            console.log(err);
            return;
        }
        if (warns) console.log(warns);
        console.log(data);
});
```

__sample.tpl__
```html
<html>
<head>
    <meta charset="utf8">
    <title>[% title %]</title>
</head>
<body>

    <!-- INCLUDE -->
    [% INCLUDE subtitle.tpl %]

    <!-- PARAM -->
    <br />
    say "[% say %]"<br />
    money : [% money | comma %]yen<br />

    <!-- FUNC -->
    <br />
    [% echo('this is echo') %]<br />
    [% echoAsync('this is echoAsync') %]<br />

    <!-- IF -->
    <br />
    flag is 
    [% IF flag %]
        true
        [% IF flag2 %]
            -> true
        [% ELSE %]
            -> false
        [% /IF %]
    [% ELSE %]
        false
        [% IF flag2 %]
            -> true
        [% ELSE %]
            -> false
        [% /IF %]
    [% /IF %]
    <br />

    <!-- FOR（配列）-->
    <br />
    [% FOR value IN list %]
        - [% loop.count %] : [% value %]<br />
    [% /FOR %]

    <!-- FOR（連想配列）-->
    <br />
    [% FOR data IN info %]
        [% data.key %] : [% data.value %]<br>
    [% /FOR %]

</body>
</html>
```

__OutputHtml__
```js
Example

say "hello!"
money : 10,000

this is echo
this is echoAsync

flag is true -> false 

- 1 : a
- 2 : b
- 3 : c

name : cooky
version : 1.0.0
desc : Template engine in node.js
```

__module.exports.args__
* fileDir - テンプレートファイルが置いてあるディレクトリを指定します。
* isStrict - テンプレート上で未定義の変数が使用された場合に警告を出力するかを設定します。trueなら出力します。


### compile(tplFile, cc, tplParam, tplFuncsName, tplFuncsArray, callback)
テンプレートを解析します。

__Arguments__
* tplFile - 解析するテンプレートのファイル名です。
* cc - 必要ならcooky-chainを渡してください。これはユーザー定義テンプレート関数内で使用するためであり、cooky-template自体がccを使用することはありません。
* tplParam - テンプレート上で使用するパラメタの連想配列です。
* tplFuncsName - ユーザー定義テンプレート関数名をコンマ(,)で繋げた文字列です。これはtplFuncsArrayの並び順と対応している必要があります。
* tplFuncsArray - ユーザー定義テンプレート関数の配列です。
* callback - 解析後に呼び出されるコールバックです。

__callback__
* err - エラー情報です。nullでなければ解析は完了していません。
* warns - 警告情報の配列です。nullでなくても解析は完了していることがあります。
* data - 解析後のテンプレ―ト内容です。

### FOR
loopという変数が自動で設定されます
* index - 0から始まるループの回数が入ります
* count - 1から始まるループの回数が入ります
* total - ループの総数が入ります
* first - 最初のループかどうかの真偽値が入ります
* last - 最後のループかどうかの真偽値が入ります

