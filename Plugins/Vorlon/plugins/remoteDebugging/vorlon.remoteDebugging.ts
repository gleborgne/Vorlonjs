﻿module VORLON {
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
            json.forEach((item) => {
                console.log('checking tab ' + item.title);
                if (item.title.toLowerCase().indexOf("vorlon") != -1) {
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
        private _scriptsParsed: any;
        private _timeout;
        public startDashboardSide(div: HTMLDivElement = null): void {
            Core.Messenger.sendRealtimeMessage(this.getID(), {
                type: "getJSON",
                order: null
            }, RuntimeSide.Dashboard);
            this._index = 0;
            this._scriptsParsed = {};
            this._timeout = null;
            this._ready = true;
        }

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
                            this._scriptParsed(data);
                        }
                        if (data && data.result) {
                            var result = data.result;
                            if (result.scriptSource) {
                                var script: ScriptParsed = this._scriptsParsed[data.id];

                                script.scriptSource = result.scriptSource;
                                if (!this._timeout && script.startLine == 3)
                                    this._timeout = setTimeout(() => {
                                        this._displayScript(script);
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

        private _displayScript(script: ScriptParsed): void {
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