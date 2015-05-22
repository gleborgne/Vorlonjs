declare module VORLON {
    class Location {
        columnNumber: number;
        lineNumber: number;
        scriptId: string;
    }
    interface ScriptParsed {
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
    interface ScriptSource {
        scriptSource: string;
    }
    interface CallFrame {
        callFrameId: string;
        functionName: string;
        location: Location;
        scopeChain: any;
        this: any;
    }
    class evaluateOnCallFrame {
        callFrameId: string;
        expression: string;
        objectGroup: string;
        returnByValue: boolean;
    }
    class remoteDebugging extends Plugin {
        private _timeoutId;
        private item;
        constructor();
        getID(): string;
        private _markForRefresh();
        refresh(): void;
        private _getTab(json);
        private _packageJson();
        onRealtimeMessageReceivedFromDashboardSide(receivedObject: any): void;
        private _socket;
        private _index;
        private _protocol;
        private _scriptsParsed;
        private _timeout;
        startDashboardSide(div?: HTMLDivElement): void;
        private _connectWithClient(receivedObject);
        private _scriptParsed(data);
        private _displayScript(script);
        private _setBreakPoint(script);
        private _debuggerPaused(data);
        onRealtimeMessageReceivedFromClientSide(receivedObject: any): void;
    }
}
