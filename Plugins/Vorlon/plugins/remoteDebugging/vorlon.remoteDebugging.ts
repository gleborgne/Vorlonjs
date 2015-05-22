module VORLON {
    declare var $: any;
    declare var io;

    export class Location {
        columnNumber: number;
        lineNumber: number;
        scriptId: string;
    }

    export interface ScriptParsed {
        scriptId: string;
        url: string;
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
        isContentScript: boolean;
        sourceMapUrl: string;
        scriptSource: ScriptSource;
    }

    export interface ScriptSource {
        scriptSource: string;
    }

    export interface CallFrame {
        callFrameId: string;
        functionName: string;
        location: Location;
        scopeChain: any;
        this: any;
    }

    export class evaluateOnCallFrame {
        callFrameId: string;
        expression: string;
        objectGroup: string;
        returnByValue: boolean;
    }

    export class remoteDebugging extends Plugin {
        // Client
        private _timeoutId;
        private item;

        constructor() {
            super("remoteDebugging", "control.html", "control.css");
            this._ready = false;
        }

        public getID(): string {
            return "REMOTEDEBUGGER";
        }

        private _markForRefresh() {
            if (this._timeoutId) {
                clearTimeout(this._timeoutId);
            }

            this._timeoutId = setTimeout(() => {
                this.refresh();
            }, 10000);
        }

        public refresh(): void {
        }

        private _getTab(json: any): any {
            var find = null;
            var searchTab = document.title;
            json.forEach((item) => {
                console.log('checking tab ' + item.title);
                if (item.title.indexOf(searchTab) != -1) {
                    find = item;
                    console.log('tab match ' + item.title);
                }
            });
            return find;
        }

        private _packageJson(): any {
            var packageJson = {
                type: 'json',
                json: JSON.stringify(this.item)
            }

            return packageJson;
        }

        public onRealtimeMessageReceivedFromDashboardSide(receivedObject: any): void {
            var json;
            var xhr = new XMLHttpRequest();
            var xd;
            if (receivedObject && receivedObject.type) {
                switch (receivedObject.type) {
                    case "getJSON":
                        console.log('trying to get json metadata from browser');
                        xhr.open("GET", "http://localhost:9222/json", true);
                        xhr.withCredentials = true;
                        xhr.onreadystatechange = () => {
                            if (xhr.readyState == 4 && xhr.status == 200) {
                                console.log('json call success ' + xhr.responseText);
                                json = JSON.parse(xhr.responseText);
                                this.item = this._getTab(json);

                                Core.Messenger.sendRealtimeMessage(this.getID(), this._packageJson(), RuntimeSide.Client);
                            } else {
                                console.log('json call failed ' + xhr.readyState + '/' + xhr.status + '/' + xhr.responseText);
                            }
                        }
                        xhr.send();
                        break;
                }
                return;
            }
        }

        // DASHBOARD
        private _socket: any;
        private _index: number;
        private _protocol;
        private _scriptsParsed: Array<any>;
        private _timeout;
        private _dashboardDiv: HTMLDivElement;
        private _containerDiv: HTMLElement;
        private _selectScript: HTMLOListElement;
        private _code: HTMLDivElement;

        public startDashboardSide(div: HTMLDivElement = null): void {
            this._dashboardDiv = div;

            this._insertHtmlContentAsync(this._dashboardDiv,(filledDiv) => {
                this._containerDiv = filledDiv;

                this._code = <HTMLDivElement>this._containerDiv.querySelector("#code");

                this._selectScript = <HTMLOListElement>this._containerDiv.querySelector("#listScripts");
                this._selectScript.innerHTML = "";
                //this._selectScript.appendChild(document.createElement('option'));
                /*this._selectScript.addEventListener("change",(elt: any) => {
                    this._code.innerHTML = "";
                    $("option:selected", this._selectScript).each(function () {
                        _that._displayScript($(this)[0].id);
                    });
                });*/
                Core.Messenger.sendRealtimeMessage(this.getID(), {
                    type: "getJSON",
                    order: null
                }, RuntimeSide.Dashboard);

                var splitter = $('.remote-debugging-container').split({
                    orientation: 'vertical',
                    limit: 200,
                    position: '70%'
                });
                splitter.refresh();
                this._index = 0;
                this._scriptsParsed = [];
                this._timeout = null;
                this._ready = true;
            });
        }

        private _displayScript(id: number): void {
            this._scriptsParsed.forEach((script) => {
                if (script.scriptId == id) {
                    /*script.scriptSource.split('\n').forEach((line) => {
                        var ligne = document.createElement("div");
                        ligne.innerHTML = line;
                        this._code.appendChild(ligne);
                    });*/
                    this._code.innerHTML = script.scriptSource;
                }
            });
        }

        private _empty(): void {
            this._selectScript.innerHTML = "";
            this._scriptsParsed = [];
            this._timeout = null;
        }

        // List of all commands (https://developer.chrome.com/devtools/docs/protocol/1.1/index)
        private _connectWithClient(receivedObject: any): void {
            console.log('received json metadata ' + receivedObject.json);
            var json = JSON.parse(receivedObject.json);
            var url: string = "";


            if (json && json.webSocketDebuggerUrl) {
                url = json.webSocketDebuggerUrl;
                console.log('opening websocket to ' + url);
                this._socket = new WebSocket(url);
                this._socket.onopen = () => {
                    if (this._socket.readyState === WebSocket.OPEN) {

                        var json = {
                            "method": "Debugger.enable",
                            "id": this._index++
                        };
                        console.log('send Debugger.enable');
                        this._socket.send(JSON.stringify(json));
                    }
                };

                this._socket.onerror = (err) => {
                    console.error('error from rdp websocket', err);
                };

                this._socket.onmessage = (message) => {
                    var command = {};
                    if (message && message.data) {
                        var data = JSON.parse(message.data);
                        console.log('received ' + data.method, data);
                        if (data.method && data.method === "Debugger.scriptParsed") {
                            //console.log('script parsed ', data);
                            if (data.params.url.indexOf("extensions::unload_event") == -1) {
                                this._scriptParsed(data);
                            }
                            else {
                                this._empty();
                            }
                        }
                        if (data && data.result) {
                            var result = data.result;
                            if (result.scriptSource) {
                                var script: ScriptParsed = this._scriptsParsed[data.id];

                                script.scriptSource = result.scriptSource;
                                if (!this._timeout && script.startLine == 3)
                                    this._timeout = setTimeout(() => {
                                        this._displayScript(+script.scriptId);
                                        this._addBreakpoint(script);
                                    }, 1000);
                            }
                            else if (result.breakpointId) {
                                console.log("Breakpoint added:", result);
                            }
                            else if (result.result) {
                                console.log("Result expression: ", result.result);
                                command = {
                                    "id": this._index++,
                                    "method": "Debugger.resume",
                                }
                                console.log('send Debugger.resume');
                                this._socket.send(JSON.stringify(command));
                            }
                        }
                        if (data.method && data.method === "Debugger.paused") {
                            this._debuggerPaused(data);
                        }
                    }
                };
            }
        }

        private _scriptParsed(data: any): void {
            var li: HTMLLIElement = document.createElement('li');
            var name: string = "";
            var url: string = data.params.url;
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
                var selected: any = _that._selectScript.querySelector('.selected');
                if (selected) {
                    selected.classList.remove('selected');
                }
                var click = $(this);
                Tools.AddClass(click[0], 'selected');
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
        }

        private _addBreakpoint(script: ScriptParsed): void {
            this._setBreakPoint(script);
        }

        private _setBreakPoint(script: ScriptParsed): void {
            var location: Location = new Location();
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
        }

        private _debuggerPaused(data: any): void {
            var callFrameToEvaluate: CallFrame = data.params.callFrames[0];
            var evaluateCallFrame: evaluateOnCallFrame = new evaluateOnCallFrame();
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
        }

        public onRealtimeMessageReceivedFromClientSide(receivedObject: any): void {
            if (receivedObject && receivedObject.type === "json") {
                if (receivedObject.json !== "null") {
                    this._connectWithClient(receivedObject);
                }
                else {
                    console.log("Failed connection!");
                }
            }
        }
    }

    Core.RegisterPlugin(new remoteDebugging());
}