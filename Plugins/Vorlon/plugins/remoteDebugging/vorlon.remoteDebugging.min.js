var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var VORLON;
(function (VORLON) {
    var Location = (function () {
        function Location() {
        }
        return Location;
    })();
    VORLON.Location = Location;
    var evaluateOnCallFrame = (function () {
        function evaluateOnCallFrame() {
        }
        return evaluateOnCallFrame;
    })();
    VORLON.evaluateOnCallFrame = evaluateOnCallFrame;
    var remoteDebugging = (function (_super) {
        __extends(remoteDebugging, _super);
        function remoteDebugging() {
            _super.call(this, "remoteDebugging", "control.html", "control.css");
            this._ready = false;
        }
        remoteDebugging.prototype.getID = function () {
            return "REMOTEDEBUGGER";
        };
        remoteDebugging.prototype._markForRefresh = function () {
            var _this = this;
            if (this._timeoutId) {
                clearTimeout(this._timeoutId);
            }
            this._timeoutId = setTimeout(function () {
                _this.refresh();
            }, 10000);
        };
        remoteDebugging.prototype.refresh = function () {
        };
        remoteDebugging.prototype._getTab = function (json) {
            var find = null;
            var searchTab = document.title;
            json.forEach(function (item) {
                console.log('checking tab ' + item.title);
                if (item.title.indexOf(searchTab) != -1) {
                    find = item;
                    console.log('tab match ' + item.title);
                }
            });
            return find;
        };
        remoteDebugging.prototype._packageJson = function () {
            var packageJson = {
                type: 'json',
                json: JSON.stringify(this.item)
            };
            return packageJson;
        };
        remoteDebugging.prototype.onRealtimeMessageReceivedFromDashboardSide = function (receivedObject) {
            var _this = this;
            var json;
            var xhr = new XMLHttpRequest();
            var xd;
            if (receivedObject && receivedObject.type) {
                switch (receivedObject.type) {
                    case "getJSON":
                        console.log('trying to get json metadata from browser');
                        xhr.open("GET", "http://localhost:9222/json", true);
                        xhr.withCredentials = true;
                        xhr.onreadystatechange = function () {
                            if (xhr.readyState == 4 && xhr.status == 200) {
                                console.log('json call success ' + xhr.responseText);
                                json = JSON.parse(xhr.responseText);
                                _this.item = _this._getTab(json);
                                VORLON.Core.Messenger.sendRealtimeMessage(_this.getID(), _this._packageJson(), VORLON.RuntimeSide.Client);
                            }
                            else {
                                console.log('json call failed ' + xhr.readyState + '/' + xhr.status + '/' + xhr.responseText);
                            }
                        };
                        xhr.send();
                        break;
                }
                return;
            }
        };
        remoteDebugging.prototype.startDashboardSide = function (div) {
            var _this = this;
            if (div === void 0) { div = null; }
            this._dashboardDiv = div;
            this._insertHtmlContentAsync(this._dashboardDiv, function (filledDiv) {
                _this._containerDiv = filledDiv;
                _this._code = _this._containerDiv.querySelector("#code");
                _this._selectScript = _this._containerDiv.querySelector("#listScripts");
                _this._selectScript.innerHTML = "";
                //this._selectScript.appendChild(document.createElement('option'));
                /*this._selectScript.addEventListener("change",(elt: any) => {
                    this._code.innerHTML = "";
                    $("option:selected", this._selectScript).each(function () {
                        _that._displayScript($(this)[0].id);
                    });
                });*/
                VORLON.Core.Messenger.sendRealtimeMessage(_this.getID(), {
                    type: "getJSON",
                    order: null
                }, VORLON.RuntimeSide.Dashboard);
                var splitter = $('.remote-debugging-container').split({
                    orientation: 'vertical',
                    limit: 200,
                    position: '70%'
                });
                splitter.refresh();
                _this._index = 0;
                _this._scriptsParsed = [];
                _this._timeout = null;
                _this._ready = true;
            });
        };
        remoteDebugging.prototype._displayScript = function (id) {
            var _this = this;
            this._scriptsParsed.forEach(function (script) {
                if (script.scriptId == id) {
                    /*script.scriptSource.split('\n').forEach((line) => {
                        var ligne = document.createElement("div");
                        ligne.innerHTML = line;
                        this._code.appendChild(ligne);
                    });*/
                    _this._code.innerHTML = script.scriptSource;
                }
            });
        };
        remoteDebugging.prototype._empty = function () {
            this._selectScript.innerHTML = "";
            this._scriptsParsed = [];
            this._timeout = null;
        };
        // List of all commands (https://developer.chrome.com/devtools/docs/protocol/1.1/index)
        remoteDebugging.prototype._connectWithClient = function (receivedObject) {
            var _this = this;
            console.log('received json metadata ' + receivedObject.json);
            var json = JSON.parse(receivedObject.json);
            var url = "";
            if (json && json.webSocketDebuggerUrl) {
                url = json.webSocketDebuggerUrl;
                console.log('opening websocket to ' + url);
                this._socket = new WebSocket(url);
                this._socket.onopen = function () {
                    if (_this._socket.readyState === WebSocket.OPEN) {
                        var json = {
                            "method": "Debugger.enable",
                            "id": _this._index++
                        };
                        console.log('send Debugger.enable');
                        _this._socket.send(JSON.stringify(json));
                    }
                };
                this._socket.onerror = function (err) {
                    console.error('error from rdp websocket', err);
                };
                this._socket.onmessage = function (message) {
                    var command = {};
                    if (message && message.data) {
                        var data = JSON.parse(message.data);
                        console.log('received ' + data.method, data);
                        if (data.method && data.method === "Debugger.scriptParsed") {
                            //console.log('script parsed ', data);
                            if (data.params.url.indexOf("extensions::unload_event") == -1) {
                                _this._scriptParsed(data);
                            }
                            else {
                                _this._empty();
                            }
                        }
                        if (data && data.result) {
                            var result = data.result;
                            if (result.scriptSource) {
                                var script = _this._scriptsParsed[data.id];
                                script.scriptSource = result.scriptSource;
                                if (!_this._timeout && script.startLine == 3)
                                    _this._timeout = setTimeout(function () {
                                        _this._displayScript(+script.scriptId);
                                        _this._addBreakpoint(script);
                                    }, 1000);
                            }
                            else if (result.breakpointId) {
                                console.log("Breakpoint added:", result);
                            }
                            else if (result.result) {
                                console.log("Result expression: ", result.result);
                                command = {
                                    "id": _this._index++,
                                    "method": "Debugger.resume",
                                };
                                console.log('send Debugger.resume');
                                _this._socket.send(JSON.stringify(command));
                            }
                        }
                        if (data.method && data.method === "Debugger.paused") {
                            _this._debuggerPaused(data);
                        }
                    }
                };
            }
        };
        remoteDebugging.prototype._scriptParsed = function (data) {
            var li = document.createElement('li');
            var name = "";
            var url = data.params.url;
            var tmp = url.substring(0, url.lastIndexOf('.js'));
            if (tmp !== "") {
                name = tmp.substring(tmp.lastIndexOf('/') + 1, tmp.length) + ".js";
            }
            else {
                name = url.substring(url.lastIndexOf('/') + 1, url.length);
            }
            li.id = data.params.scriptId;
            li.innerHTML = name;
            var _that = this;
            li.addEventListener("click", function (elt) {
                var selected = _that._selectScript.querySelector('.selected');
                if (selected) {
                    selected.classList.remove('selected');
                }
                var click = $(this);
                VORLON.Tools.AddClass(click[0], 'selected');
                _that._displayScript(click[0].id);
            });
            this._selectScript.appendChild(li);
            var id = this._index++;
            var command = {
                "id": id,
                "method": "Debugger.getScriptSource",
                "params": { "scriptId": data.params.scriptId.toString() }
            };
            this._scriptsParsed[id] = data.params;
            console.log('send Debugger.getScriptSource');
            this._socket.send(JSON.stringify(command));
        };
        remoteDebugging.prototype._addBreakpoint = function (script) {
            this._setBreakPoint(script);
        };
        remoteDebugging.prototype._setBreakPoint = function (script) {
            var location = new Location();
            location.columnNumber = 0;
            location.lineNumber = 8;
            location.scriptId = script.scriptId;
            var command = {
                "id": this._index++,
                "method": "Debugger.setBreakpoint",
                "params": { "location": location }
            };
            console.log('send Debugger.setBreakpoint');
            this._socket.send(JSON.stringify(command));
        };
        remoteDebugging.prototype._debuggerPaused = function (data) {
            var callFrameToEvaluate = data.params.callFrames[0];
            var evaluateCallFrame = new evaluateOnCallFrame();
            evaluateCallFrame.callFrameId = callFrameToEvaluate.callFrameId;
            evaluateCallFrame.expression = "i + j";
            evaluateCallFrame.objectGroup = "";
            evaluateCallFrame.returnByValue = true;
            var command = {
                "id": this._index++,
                "method": "Debugger.evaluateOnCallFrame",
                "params": evaluateCallFrame
            };
            console.log('send Debugger.evaluateOnCallFrame');
            this._socket.send(JSON.stringify(command));
        };
        remoteDebugging.prototype.onRealtimeMessageReceivedFromClientSide = function (receivedObject) {
            if (receivedObject && receivedObject.type === "json") {
                if (receivedObject.json !== "null") {
                    this._connectWithClient(receivedObject);
                }
                else {
                    console.log("Failed connection!");
                }
            }
        };
        return remoteDebugging;
    })(VORLON.Plugin);
    VORLON.remoteDebugging = remoteDebugging;
    VORLON.Core.RegisterPlugin(new remoteDebugging());
})(VORLON || (VORLON = {}));
//# sourceMappingURL=vorlon.remoteDebugging.js.map