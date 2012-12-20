/**
 * cooky-template
 *
 * Template engine in node.js
 */
var Module = function(){};
var Fs = require('fs');
var Util = require("util");

/**
 * require時設定
 *
 * @param  module.parent.exports.args : {
 *             isStrict     : strictモード（存在しないパラメタを許可しない）かどうか
 *             fileDir      : テンプレートのディレクトリ（/で終わること）
 *             fileCharcode : ファイル文字コード
 *             tagLeft      : タグ開始文字列
 *             tagRight     : タグ終了文字列
 *         }
 */
var moduleParentExportsArgs = module.parent.exports.args || {};
var IS_STRICT = moduleParentExportsArgs.isStrict || '';
var FILE_DIR = moduleParentExportsArgs.fileDir || '';
var FILE_CHARCODE = moduleParentExportsArgs.fileCharcode || 'utf8';
var TAG_LEFT = moduleParentExportsArgs.tagLeft || '[%';
var TAG_RIGHT = moduleParentExportsArgs.tagRight || '%]';

var TAG_COMMENT_CHAR = '#';
var TAG_COMMENT_LEFT = TAG_LEFT + TAG_COMMENT_CHAR;
var TAG_COMMENT_RIGHT = TAG_COMMENT_CHAR + TAG_RIGHT;

var NEST_VAR_LEFT = '${';
var NEST_VAR_RIGHT = '}';

/**
 * コンパイル
 *
 * @param  tplFileName   : テンプレートファイル名
 * @param  cc            : cooky-chainオブジェクト
 * @param  params        : テンプレートで使用するパラメタの連想配列
 * @param  tplFuncsName  : 全てのテンプレート関数名を','で繋いだ文字列
 * @param  tplFuncsArray : テンプレート関数の配列、順番はtplFuncsNameと連動しているものとする
 * @param  callback (
 *             err    : エラーメッセージ、設定されている場合はコンパイル失敗
 *             warns  : 注意メッセージ配列、設定されていてもコンパイルは成功している場合がある
 *             result : コンパイル後のテンプレート文字列
 *         )
 */
module.exports.compile = function(tplFileName, cc, params, tplFuncsName, tplFuncsArray, callback){

    try {
       var fileData = Fs.readFileSync(FILE_DIR + tplFileName, FILE_CHARCODE);
    }
    catch(err) {
        callback(err, [], null);
        return;
    }

    // 先端ノード
    var nodeFirst = new BaseNode;
    nodeFirst.isFirst = true;
    nodeFirst.first = nodeFirst;
    nodeFirst.isError = false;
    nodeFirst.cc = cc;
    nodeFirst.nodeCouht = 0;
    nodeFirst.callback = callback;
    nodeFirst.warns = [];
    nodeFirst.warn = function(warn){
        nodeFirst.warns.push(warn);
    };
    nodeFirst.error = function(err){
        if (!nodeFirst.isError) {
            nodeFirst.isError = true;
            nodeFirst.callback(err, nodeFirst.warns, null);
        }
    };
    if (tplFuncsName) {
        // ATのテンプレ関数は必ずあるとして','で繋ぐ
        nodeFirst.tplFuncsName = Module._tplFuncsName + ',' + tplFuncsName;
        nodeFirst.tplFuncsArray = Module._tplFuncsArray.concat(tplFuncsArray);
    }

    // 末端ノード
    var nodeLast = new BaseNode;
    nodeLast.isLast = true;
    
    // 開始ノード
    var node = new BaseNode;
    node.tpl = fileData;
    node.params = params;

    // ノードチェイン
    nodeFirst.next = node;
    node.prev = nodeFirst;
    node.next = nodeLast;
    nodeLast.prev = node;
    node.first = nodeFirst;
    node.first.nodeCount = 1;

    // 解析開始
    node.parse();
}


//========================================================
// ノードクラス
//========================================================

/**
 * 基底ノード
 */
var BaseNode = function(){};
BaseNode.prototype = {
    output  : '',
};

/**
 * 解析
 */
BaseNode.prototype.parse = function(){
    var tpl = this.tpl + '';

    // タグを探す
    var tagLeftPos = tpl.indexOf(TAG_LEFT);

    // 無ければ終了
    if (tagLeftPos == -1) {
        this.output = tpl;
        this.end();
        return;;
    }

    // タグまでをこのノードの出力とする
    this.output = tpl.substring(0, tagLeftPos);

    // 範囲コメントだったら次へ
    if (tpl.charAt(tagLeftPos + TAG_LEFT.length) == TAG_COMMENT_CHAR) {
        var commentRightPos = tpl.indexOf(TAG_COMMENT_RIGHT, tagLeftPos);
        var node = new BaseNode;
        node.tpl = tpl.substring(commentRightPos + TAG_COMMENT_RIGHT.length);
        node.params = this.params;
        this.chain(node);
        process.nextTick(function(){
            node.parse();
        });
    }
    else {
        // タグを境に分岐
        var tagRightPos = tpl.indexOf(TAG_RIGHT, tagLeftPos);
        var tag = tpl.substring(tagLeftPos + TAG_LEFT.length, tagRightPos).trim();
        this.split(tag, tpl.substring(tagRightPos + TAG_RIGHT.length));
    }

    // このノードの解析終了
    this.end();
}

/**
 * 解析終了
 */
BaseNode.prototype.end = function(){

    // エラーが発生していたら終了
    if (this.first.isError) {
        return;
    }

    // 処理カウント減らす
    this.first.nodeCount--;

    // 全ての処理が終了した(処理カウントが0)なら出力
    if (this.first.nodeCount == 0) {
        var node = this.first;
        var output = '';
        while (!node.isLast) {
            output += node.output;
            node = node.next;
        }
        this.first.callback(null, this.first.warns, output);
    }
}

/**
 * 分岐
 *
 * @param  tag : テンプレートのタグ部
 * @param  tpl : タグ部以降のテンプレート
 */
BaseNode.prototype.split = function(tag, tpl){

    var tagNode = null;

    // 特殊ノード検索
    for (var key in specialNodeList) {
        if (tag.indexOf(key) != -1) {

            // blockタイプでなければノード作成してしまう
            if (specialNodeList[key].type == 'line') {
                tagNode = new specialNodeList[key].node;
                tagNode.expression = tag.trim();
                break;
            }

            // 終了位置検索
            var tryCount = 0;
            var tmpTpl = tpl;
            var nestCount = 0;
            var tagEndPos = 0;
            
            while (true) {
                if (tryCount++ > 100) {
                    this.first.error('"' + tag + '" の終了タグ検索が規定回数を超えました');
                    return;
                }

                var tmpEndPos = tmpTpl.indexOf(specialNodeList[key].end);
                var nestPos = tmpTpl.indexOf(specialNodeList[key].start);
                if (nestPos == -1 || tmpEndPos <= nestPos) {
                    if (nestCount <= 0) {
                        tagEndPos += tmpEndPos;
                        break;
                    }
                    else {
                        nestCount--;
                        var length = tmpEndPos + specialNodeList[key].end.length;
                        tagEndPos += length;
                        tmpTpl = tmpTpl.substring(length);
                    }
                }
                else {
                    nestCount++;
                    var length = nestPos + specialNodeList[key].start.length;
                    tagEndPos += length;
                    tmpTpl = tmpTpl.substring(length);

                }

            }
            if (tagEndPos == 0) {
                this.first.error('"' + tag + '" の終了タグが見つかりません');
                return;
            }

            // ノード作成
            tagNode = new specialNodeList[key].node;
            tagNode.expression = tag.trim();
            tagNode.block = tpl.substring(0, tagEndPos);
            tpl = tpl.substring(tagEndPos + specialNodeList[key].end.length);

            break;
        }
    }

    // 特殊ノード以外
    if (!tagNode) {
        tagNode = (tag.indexOf('(') != -1) ? new NodeFunc : new NodeParam;
        tagNode.expression = tag.trim();
    }

    // ノード設定
    this.chain(tagNode);
    tagNode.params = this.params;
    
    // 変数展開
    var expression = tagNode.expression;
    var varLeftPos = expression.lastIndexOf(NEST_VAR_LEFT);
    while (varLeftPos != -1) {
        var varRightPos = expression.indexOf(NEST_VAR_RIGHT, varLeftPos);
        var leftPart = expression.substring(0, varLeftPos);
        var varPart = expression.substring(varLeftPos + NEST_VAR_LEFT.length, varRightPos);
        var rightPart = expression.substring(varRightPos + NEST_VAR_RIGHT.length);
        var varKeys = varPart.split(".");
        var varValues = tagNode.params;
        for (var idx in varKeys) {
            var key = varKeys[idx].trim();
            if (!(key in varValues)) {
                varValues = 'null';
                break;
            }
            varValues = varValues[key];
        }
        expression = leftPart + varValues + rightPart;
        varLeftPos = expression.lastIndexOf(NEST_VAR_LEFT);
    }
    tagNode.expression = expression;

    // 解析実行
    process.nextTick(function(){
        tagNode.exec(function(output){
            output = (output != undefined) ? output : '';
            tagNode.tpl = output + tagNode.output;
            tagNode.parse();
        });
    });

    // まだテンプレートがあればノード作成
    if (tpl) {
        var tplNode = new BaseNode;
        tplNode.tpl = tpl;
        tplNode.params = this.params;
        tagNode.chain(tplNode);
        process.nextTick(function(){
            tplNode.parse();
        });
    }
}

/**
 * ノードのチェインを行う
 *
 * @param  next : 次とするノード
 * @note A->Bとする時はA.chain(B)と呼ぶ
 */
BaseNode.prototype.chain = function(next){

    if (!next) return;

    // チェイン
    this.next.prev = next;
    next.next = this.next
    this.next = next;
    next.prev = this;
    next.first = this.first;
    this.first.nodeCount++;
}

/**
 * PARAMノード
 *
 * @note Functionを使った解析だとthis.paramsの一覧を作るのに時間がかかると考え、不採用とした
 */
var NodeParam = function(){};
Util.inherits(NodeParam, BaseNode);
NodeParam.prototype.exec = function(callback){

    var exps = this.expression.split("|");
    var paramName = exps[0];
    var filters = exps.slice(1);
    var params = this.params;

    // パラメタ検索
    var keys = paramName.split(".");
    var notExist = false;
    for (var idx in keys) {
        var key = keys[idx].trim();
        if (!(key in params)) {
            if (IS_STRICT) {
                this.first.error('"' + this.expression + '" パラメタは存在しません');
                callback('');
                return;
            }
            else {
                params[key] = {};
                notExist = true;
            }
        }
        params = params[key];
    }

    // 特定の型は定型文を出して終了
    if (notExist || params == null) {
        callback('');
        return;
    }
    if (typeof(params) == 'function') {
        callback('[Function]');
        return;
    }
    if (typeof(params) == 'object') {
        callback(!params.length ? '' : Util.isArray(params) ? '[Array]' : '[Object]');
        return;
    }

    // 文字列に変換
    params = params.toString();

    // フィルタ取得
    var isEscape = true;
    var filterFuncs = []
    for (var idx in filters) {
        var filter = filters[idx].trim();
        if (!(filter in Module._tplFilters)) {
            this.first.error('"' + this.expression + '" フィルタ"' + filter + '"は存在しません');
            callback('');
            return;
        }
        if (filter == 'raw') {
            isEscape = false;
            continue;
        }
        filterFuncs.push(Module._tplFilters[filter]);
    }

    // 特殊文字エスケープ
    if (isEscape) {
        params = params.toString()
                    .replace(/&(?!\w+;)/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    ;
    }

    // フィルタ実行
    for (var idx in filterFuncs) {
        params = filterFuncs[idx](params);
    }

    callback(params);
}

/**
 * FUNCノード
 */
var NodeFunc = function(){};
Util.inherits(NodeFunc, BaseNode);
NodeFunc.prototype.exec = function(callback){

    // ソースコード生成
    var leftPos = this.expression.indexOf('(');
    var rightPos = this.expression.indexOf(')');
    var funcStr = this.expression.substring(0, leftPos).trim();
    var argStr = this.expression.substring(leftPos + 1, rightPos).trim();
    var code = funcStr + '(' + (argStr != "" ? 'cc,callback,' + argStr : 'cc,callback') + ')';

    // パラメタ準備
    var paramsKeyArray = [];
    var paramsArray = [];
    for (var key in this.params) {
        paramsKeyArray.push(key);
        paramsArray.push(this.params[key]);
    }
    var paramsKeyStr = paramsKeyArray.join(',');

    // eval
    var firstNode = this.first;
    try {
        var fn = new Function(firstNode.tplFuncsName + (paramsKeyStr != "" ? ', ' + paramsKeyStr : '') + ',cc,callback', code);
        fn.apply(null, firstNode.tplFuncsArray.concat(paramsArray).concat([firstNode.cc, function(err, str){
            if (err) {
                firstNode.error(err);
                return;
            }
            callback(str);
        }]));
    }
    catch (err) {
        err = '"' + this.expression + '" ' + err;
        if (IS_STRICT) {
            firstNode.error(err);
        }
        else {
            firstNode.warn(err);
            callback('');
        }
    }
}

/**
 * IFノード
 */
var NodeIf = function(){};
Util.inherits(NodeIf, BaseNode);
NodeIf.prototype.exec = function(callback){
    var tagInfo = specialNodeList['IF'];
    var blockTrue = this.block;
    var blockFalse = '';
    
    // ELSE位置検索
    var tagElsePos = this.block.indexOf(tagInfo.else);
    if (tagElsePos == -1) {
        blockTrue = this.block;
    }
    else {
        // ELSEがある
        var tmpTagElesPos = tagElsePos;
        var tryCount = 0;
        var tmpBlock = this.block;
        tagElsePos = 0;
        while (true) {
            if (tryCount++ > 100) {
                this.first.error('ブロック"' + this.block + '"のELSE検索が規定回数を超えました');
                callback('');
                return;
            }

            // ネストが無ければ終了
            var tagIfPos = tmpBlock.indexOf(tagInfo.start);
            if ((tagIfPos == -1) || (tmpTagElesPos < tagIfPos)) {
                tagElsePos += tmpTagElesPos;
                break;
            }

            // 終了タグの位置から再検索
            var substringPos = tmpBlock.indexOf(tagInfo.end) + tagInfo.end.length;
            tagElsePos += substringPos
            tmpBlock = tmpBlock.substring(substringPos);
            tmpTagElesPos = tmpBlock.indexOf(tagInfo.else);

            // ELSEが無くなれば終了
            if (tmpTagElesPos == -1) {
                tagElsePos = 0;
                break;
            }
        }

        // ブロック分け
        if (tagElsePos != 0) {
            blockTrue = this.block.substring(0, tagElsePos);
            blockFalse = this.block.substring(tagElsePos + tagInfo.else.length);
        }
    }

    // パラメタ準備
    var paramsKeyArray = [];
    var paramsArray = [];
    for (var key in this.params) {
        paramsKeyArray.push(key);
        paramsArray.push(this.params[key]);
    }
    var paramsKeyStr = paramsKeyArray.join(',');

    // eval
    try {
        var fn = new Function(paramsKeyStr, 'return (' + this.expression.substring('2') + ')'); // 'IF'.length = 2
        callback(fn.apply(null, paramsArray) ? blockTrue : blockFalse);
    }
    catch (err) {
        err = '"' + this.expression + '" ' + err;
        if (IS_STRICT) {
            this.first.error(err);
        }
        else {
            this.first.warn(err);
            callback(blockFalse);
        }
    }
}

/**
 * FORノード
 */
var NodeFor = function(){};
Util.inherits(NodeFor, BaseNode);
NodeFor.prototype.exec = function(callback){

    // 式解析
    var inPos = this.expression.indexOf('IN');
    if (inPos == -1) {
        this.first.error('"' + this.expression + '" 大文字で IN が含まれていません)');
        callback('');
        return;
    }
    var varName = this.expression.substring(3, inPos).trim(); // 'FOR'.length = 3
    var arrayName = this.expression.substring(inPos + 2);
    var arrayNameKeys = arrayName.split(".");
    var array = this.params;
    for (var idx in arrayNameKeys) {
        var name = arrayNameKeys[idx].trim();
        if (!(name in array)) {
            if (IS_STRICT) {
                this.first.error('"' + this.expression + '" ' + arrayName + 'は存在しません)');
                callback('');
                return;
            }
            else {
                callback('');
                return;
            }
        }
        array = array[name];
    }

    // 配列の要素数だけノードを作成
    var lastNode = this;
    var params = this.params;
    var block = this.block;
    var count = 1;
    for (var key in array) {
        (function(){
            var node = new BaseNode;
            node.params = {__proto__ : params};
            node.params[varName] = array[key];
            node.params.loop = {
                index : count - 1,
                count : count,
                total : array.length,
                first : (count == 1),
                last  : (count == array.length),
            };
            node.tpl = block;
            lastNode.chain(node);
            lastNode = node;
            process.nextTick(function(){
                node.parse();
            });
            count++;
        })();
    }

    // FORノード自体は終了
    callback('');
}

/**
 * INCLUDEノード
 */
var NodeInclude = function(){};
Util.inherits(NodeInclude, BaseNode);
NodeInclude.prototype.exec = function(callback){

    var self = this;

    // ファイル読み込み
    var fileName = this.expression.substring(7).trim(); // 'INCLUDE'.length = 7
    Fs.readFile(FILE_DIR + fileName, FILE_CHARCODE, function(err, data){
        if (err) {
            self.first.error('"' + self.expression + '" ファイルが読み込めません (FILE_DIR=' + FILE_DIR + ')');
            callback('');
            return;
        }
        callback(data);
    });
}

// 特殊ノード一覧
var specialNodeList = {
    'INCLUDE' : {
        type : 'line',
        node : NodeInclude,
    },
    'IF' : {
        type : 'block',
        start : TAG_LEFT + ' IF ',
        end : TAG_LEFT + ' /IF ' + TAG_RIGHT,
        else : TAG_LEFT + ' ELSE ' + TAG_RIGHT,
        node : NodeIf,
    },
    'FOR' : {
        type : 'block',
        start : TAG_LEFT + ' FOR ',
        end : TAG_LEFT + ' /FOR ' + TAG_RIGHT,
        node : NodeFor,
    }
}

/**
 * テンプレートフィルタ
 *
 * @note  引数valueがstring型という保証はされる
 */
Module._tplFilters = {
    'trim' : function(value){
        return value.trim();
    },
    'nl2br' : function(value){
        return value.replace(/\n/g, '<br />');
    },
    'nl2li' : function(value){
        return '<li>' + value.replace(/\n/g, '</li><li>') + '</li>';
    },
    'comma' : function(value){
        if (typeof(value) != 'string') value = value.toString();
        while(value != (value = value.replace(/^(-?\d+)(\d{3})/, '$1,$2'))){}
        return value;
    },
};

/**
 * テンプレート関数
 *
 * @note 関数が１つ以上あることを前提にクラス作成している
 */
Module._tplFuncs = {
    // サンプル
    'sample' : function(cc, callback, arg){ // 引数のccとcallbackは自動で先頭に追加される
        callback(null, arg + arg); // callback(err, result);
    },
};
// Function用引数の準備
Module._tplFuncsNameArray = [];
Module._tplFuncsArray = [];
for (var name in Module._tplFuncs) {
    Module._tplFuncsNameArray.push(name);
    Module._tplFuncsArray.push(Module._tplFuncs[name]);
}
Module._tplFuncsName = Module._tplFuncsNameArray.join(',');

