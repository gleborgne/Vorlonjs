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
            _super.call(this, "RemoteDebugging", "control.html", "control.css");
            this._ready = false;
        }
        remoteDebugging.prototype.getID = function () {
            return "RemoteDebugging";
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
            json.forEach(function (item) {
                if (item.title.toLowerCase().indexOf("demo") != -1) {
                    find = item;
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
                        xhr.open("GET", "http://localhost:9222/json", true);
                        xhr.withCredentials = true;
                        xhr.onreadystatechange = function () {
                            if (xhr.readyState == 4 && xhr.status == 200) {
                                json = JSON.parse(xhr.responseText);
                                _this.item = _this._getTab(json);
                                VORLON.Core.Messenger.sendRealtimeMessage(_this.getID(), _this._packageJson(), VORLON.RuntimeSide.Client);
                            }
                        };
                        xhr.send();
                        break;
                }
                return;
            }
        };
        remoteDebugging.prototype.startDashboardSide = function (div) {
            if (div === void 0) { div = null; }
            VORLON.Core.Messenger.sendRealtimeMessage(this.getID(), {
                type: "getJSON",
                order: null
            }, VORLON.RuntimeSide.Dashboard);
            this._index = 0;
            this._scriptsParsed = {};
            this._timeout = null;
            this._ready = true;
        };
        remoteDebugging.prototype._connectWithClient = function (receivedObject) {
            var _this = this;
            var json = JSON.parse(receivedObject.json);
            var url = "";
            if (json && json.webSocketDebuggerUrl) {
                url = json.webSocketDebuggerUrl;
                this._socket = new WebSocket(url);
                this._socket.onopen = function () {
                    if (_this._socket.readyState === WebSocket.OPEN) {
                        var json = {
                            "method": "Debugger.enable",
                            "id": _this._index++
                        };
                        _this._socket.send(JSON.stringify(json));
                    }
                };
                this._socket.onerror = function () {
                };
                this._socket.onmessage = function (message) {
                    var command = {};
                    if (message && message.data) {
                        var data = JSON.parse(message.data);
                        if (data.method && data.method === "Debugger.scriptParsed") {
                            _this._scriptParsed(data);
                        }
                        if (data && data.result) {
                            var result = data.result;
                            if (result.scriptSource) {
                                var script = _this._scriptsParsed[data.id];
                                script.scriptSource = result.scriptSource;
                                if (!_this._timeout && script.startLine == 3)
                                    _this._timeout = setTimeout(function () {
                                        _this._displayScript(script);
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
            var id = this._index++;
            var command = {
                "id": id,
                "method": "Debugger.getScriptSource",
                "params": { "scriptId": data.params.scriptId.toString() }
            };
            this._scriptsParsed[id] = data.params;
            this._socket.send(JSON.stringify(command));
        };
        remoteDebugging.prototype._displayScript = function (script) {
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