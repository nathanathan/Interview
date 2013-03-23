(function(){
    // Establish the root object, `window` in the browser, or `global` on the server.
    var root = this;
    
    // Underscore is expected to have been loaded in advance.
    var _ = root._;
    
    root.XLSXInterview = {
        processWorkbook: function(wbJson){
            var recursiveExtend = function(obj) {
                _.each(Array.prototype.slice.call(arguments, 1), function(source) {
                    if (source) {
                        for (var prop in source) {
                            if (prop in obj) {
                                if (_.isObject(obj[prop]) && _.isObject(source[prop])) {
                                    obj[prop] = recursiveExtend(obj[prop], source[prop]);
                                } else {
                                    obj[prop] = [].concat(obj[prop]).concat(source[prop]);
                                }
                            } else {
                                obj[prop] = source[prop];
                            }
                        }
                    }
                });
                return obj;
            };
            var listToNestedDict = function(list){
                var outObj = {};
                if(list.length > 1){
                    outObj[list[0]] = listToNestedDict(list.slice(1));
                    return outObj;
                } else {
                    return list[0];
                }
            };
            /*
            Construct a JSON object from JSON paths in the headers.
            For now only dot notation is supported.
            For example:
            {"text.english": "hello", "text.french" : "bonjour"}
            becomes
            {"text": {"english": "hello", "french" : "bonjour"}.
            */
            var groupColumnHeaders = function(row) {
                var outRow = {};
                _.each(row, function(value, columnHeader){
                    var chComponents = columnHeader.split('.');
                    outRow = recursiveExtend(outRow, listToNestedDict(chComponents.concat(value)));
                });
                return outRow;
            }
            var outWb = {};
            var type_regex = /^(\w+)\s*(\S.*)?\s*$/;
            _.each(wbJson, function(sheet, sheetName){
                var outSheet = [];
                var outArrayStack = [outSheet];
                _.each(sheet, function(row){
                    var curStack = outArrayStack[outArrayStack.length - 1];
                    var typeParse, typeControl, typeParam;
                    var outRow;
                    outRow = groupColumnHeaders(row);
                    console.log(row, outRow)
                    //Parse the type column:
                    if('type' in outRow) {
                        typeParse = outRow.type.match(type_regex);
                        console.log(typeParse);
                        if(typeParse && typeParse.length > 0) {
                            console.log(typeParse);
                            typeControl = typeParse[typeParse.length - 2];
                            typeParam = typeParse[typeParse.length - 1];
                            if(typeControl === "begin"){
                                outRow.children = [];
                                outRow.type = typeParam;
                                //TODO: Param
                                outArrayStack.push(outRow.children);
                            } else if(typeControl === "end"){
                                outArrayStack.pop();
                                return;
                            } else {
                                outRow.type = typeControl;
                                outRow.param = typeParam;
                            }
                        }
                    }
                    
                    curStack.push(outRow);
                });
                if(outArrayStack.length > 1) {
                    throw Error("Unmatched begin statement.");
                }
                outWb[sheetName] = outSheet;
            });
            return outWb;
        }
    };

}).call(this);
