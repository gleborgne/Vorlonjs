module VORLON {
    import Socket = SocketIO.Socket;
    declare var $: any;
    declare var io;
    export class SRCDebugger extends Plugin {
        // Client
        private _timeoutId;
        private item;

        constructor() {
            super("SrcDebugger", "control.html", "control.css");
            this._ready = false;
            console.log("SrcDebugger loaded!");
        }

        public getID(): string {
            return "SrcDebugger";
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
                if (item.type == "other" && item.title.toLowerCase().indexOf("demo") > 0) {
                    find = item;
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
                        xhr.open("GET", "http://localhost:9222/json", true);
                        xhr.withCredentials = true;
                        xhr.onreadystatechange = () => {
                            if (xhr.readyState == 4 && xhr.status == 200) {
                                json = JSON.parse(xhr.responseText);
                                this.item = this._getTab(json);

                                Core.Messenger.sendRealtimeMessage(this.getID(), this._packageJson(), RuntimeSide.Client);
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
        public startDashboardSide(div: HTMLDivElement = null): void {
            Core.Messenger.sendRealtimeMessage(this.getID(), {
                type: "getJSON",
                order: null
            }, RuntimeSide.Dashboard);
            this._ready = true;
        }

        private _connectWithClient(receivedObject: any): void {
            var json = JSON.parse(receivedObject.json);
            var url = json.webSocketDebuggerUrl.replace("localhost", "172.16.245.94");
            this._socket = io.connect(url);
        }

        public onRealtimeMessageReceivedFromClientSide(receivedObject: any): void {
            if (receivedObject && receivedObject.type == "json") {
                this._connectWithClient(receivedObject);
            }
        }
    }

    Core.RegisterPlugin(new SRCDebugger());
}