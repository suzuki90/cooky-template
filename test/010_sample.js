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
    null, // 必要ならcooky-chainを渡す
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
