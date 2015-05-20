var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var VORLON;
(function (VORLON) {
    var SRCDebugger = (function (_super) {
        __extends(SRCDebugger, _super);
        function SRCDebugger() {
            _super.call(this, "SrcDebugger", "control.html", "control.css");
            this._protocolUrl = "/vorlon/plugins/sourceDebugger/protocol.json";
            this._ready = false;
            console.log("SrcDebugger loaded!");
        }
        SRCDebugger.prototype.getID = function () {
            return "SrcDebugger";
        };
        SRCDebugger.prototype._markForRefresh = function () {
            var _this = this;
            if (this._timeoutId) {
                clearTimeout(this._timeoutId);
            }
            this._timeoutId = setTimeout(function () {
                _this.refresh();
            }, 10000);
        };
        SRCDebugger.prototype.refresh = function () {
        };
        SRCDebugger.prototype._getTab = function (json) {
            var find = null;
            json.forEach(function (item) {
                if (item.type == "other" && item.title.toLowerCase().indexOf("demo") > 0) {
                    find = item;
                }
            });
            return find;
        };
        SRCDebugger.prototype._packageJson = function () {
            var packageJson = {
                type: 'json',
                json: JSON.stringify(this.item)
            };
            return packageJson;
        };
        SRCDebugger.prototype.onRealtimeMessageReceivedFromDashboardSide = function (receivedObject) {
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
        SRCDebugger.prototype.startDashboardSide = function (div) {
            var _this = this;
            if (div === void 0) { div = null; }
            VORLON.Core.Messenger.sendRealtimeMessage(this.getID(), {
                type: "getJSON",
                order: null
            }, VORLON.RuntimeSide.Dashboard);
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        _this._protocol = JSON.parse(xhr.responseText);
                    }
                }
            };
            xhr.open("GET", this._protocolUrl);
            xhr.send();
            this._index = 0;
            this._ready = true;
        };
        //private addProtocol() {
        //    var domains = this._protocol.domains;
        //    for (var i = 0; i < domains.length; i++) {
        //        var domain = domains[i];
        //        var domainObject = this[domain.domain] = <any>{};
        //        //domainObject.on = ((domain: any) => {
        //        //    return () => {
        //        //        var events = {};
        //        //        var eventName = `${domain.domain}.${arguments[0]}`;
        //        //        console.log(eventName);
        //        //        //this.on.call(this, `${domain.domain}.${arguments[0]}`, arguments[1]);
        //        //    };
        //        //})(domain);
        //        if (domain.domain == "Debugger" && domain.commands && domain.commands.length > 0) {
        //            var commands = domain.commands;
        //            for (var j = 0; j < commands.length; j++) {
        //                this._createCommand(domain, commands[j]);
        //            }
        //        }
        //    }
        //}
        //private _createCommand(domain: any, command: any) {
        //    console.log(domain.domain + "." + command.name);
        //}
        SRCDebugger.prototype._connectWithClient = function (receivedObject) {
            var _this = this;
            var json = JSON.parse(receivedObject.json);
            var url = json.webSocketDebuggerUrl;
            this._socket = new WebSocket(url);
            //this.addProtocol();
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
                        command = {
                            "id": _this._index++,
                            "method": "Debugger.getScriptSource",
                            "params": { "scriptId": data.params.scriptId.toString() }
                        };
                        _this._socket.send(JSON.stringify(command));
                    }
                    if (data && data.result) {
                        var result = JSON.parse(data.result);
                        if (result.scriptSource) {
                            console.log(result);
                        }
                    }
                }
            };
        };
        SRCDebugger.prototype.onRealtimeMessageReceivedFromClientSide = function (receivedObject) {
            if (receivedObject && receivedObject.type === "json") {
                this._connectWithClient(receivedObject);
            }
        };
        return SRCDebugger;
    })(VORLON.Plugin);
    VORLON.SRCDebugger = SRCDebugger;
    VORLON.Core.RegisterPlugin(new SRCDebugger());
})(VORLON || (VORLON = {}));
//# sourceMappingURL=vorlon.sourceDebugger.js.map