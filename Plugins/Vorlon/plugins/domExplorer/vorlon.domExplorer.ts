module VORLON {
    declare var $: any;
    export class DOMExplorer extends Plugin {

        private _previousSelectedNode: HTMLElement;
        private _internalId = 0;
        private _lastElementSelectedClientSide;
        private _newAppliedStyles = {};
        private _newAppliedAttributes = {};
        private _lastContentState = '';
        private _lastReceivedObject = null;
        private _clikedNodeID = null;
        constructor() {
            super("domExplorer", "control.html", "control.css");
            this._ready = false;
        }

        public getID(): string {
            return "DOM";
        }
        private _packageDOM(root: HTMLElement, packagedObject: PackagedNode, withChildsNodes: boolean = false): void {
            if (!root.childNodes || root.childNodes.length === 0) {
                return;
            }

            for (var index = 0; index < root.childNodes.length; index++) {
                var node = <HTMLElement>root.childNodes[index];

                var packagedNode = new PackagedNode(node);
                if (withChildsNodes) {
                    this._packageDOM(node, packagedNode);
                }
                if (node.childNodes && node.childNodes.length >= 0) {
                    packagedNode.hasChildnodes = true;
                }
                packagedObject.children.push(packagedNode);
            }
        }

        private _packageAndSendDOM(element?: HTMLElement) {
            this._internalId = 0;
            this._newAppliedStyles = {};
            this._newAppliedAttributes = {};
            if (!element) {
                var packagedObject = new PackagedNode(document.body);
                packagedObject.rootHTML = document.body.innerHTML;
                this._packageDOM(document.body, packagedObject, false);
            }
            else {
                var packagedObject = new PackagedNode(element);
                packagedObject.rootHTML = element.innerHTML;
                this._packageDOM(element, packagedObject, false);
                packagedObject.refreshbyId = true;
            }
            this.sendToDashboard(packagedObject);
        }

        private _markForRefresh() {
            this.refresh();
        }

        public startClientSide(): void {

        }

        private _getElementByInternalId(internalId: string, node: any, getNode: boolean= false): any {
            if (node.__vorlon && node.__vorlon.internalId === internalId) {
                return node;
            }
            var children = 'children';
            if (getNode) {
                children = 'childNodes'
            }
            if (!node[children]) {
                return null;
            }

            for (var index = 0; index < node[children].length; index++) {
                var result = this._getElementByInternalId(internalId, node[children][index], getNode);
                if (result) {
                    return result;
                }
            }
            return null;
        }

        public onRealtimeMessageReceivedFromDashboardSide(receivedObject: any): void {
            var obj = <ReceivedObjectClientSide>receivedObject;
            if (!obj.order) {
                switch (obj.type) {
                    case ReceivedObjectClientSideType.unselect:
                        if (this._lastElementSelectedClientSide) {
                            this._lastElementSelectedClientSide.style.outline = this._lastElementSelectedClientSide.__savedOutline;
                        }
                        break;
                    case ReceivedObjectClientSideType.dirtycheck:
                        this.sendToDashboard({
                            action: 'dirtycheck',
                            rootHTML: document.body.innerHTML
                        });
                        break;
                    case ReceivedObjectClientSideType.refresh:
                        this.refresh();
                        this._lastContentState = document.body.innerHTML;
                        break;
                    case ReceivedObjectClientSideType.valueEdit:
                        this.refreshbyId(obj.internalID);
                        this._lastContentState = document.body.innerHTML;
                        break;
                }
                return;
            }
            if (obj.type === ReceivedObjectClientSideType.valueEdit) {
                var element = this._getElementByInternalId(obj.order, document.body, true);

                if (!element) {
                    return;
                }
            }
            else {
                var element = this._getElementByInternalId(obj.order, document.body);

                if (!element) {
                    return;
                }
            }
            switch (obj.type) {
                case ReceivedObjectClientSideType.select:
                    element.__savedOutline = element.style.outline;
                    element.style.outline = "2px solid red";
                    this._lastElementSelectedClientSide = element;
                    break;
                case ReceivedObjectClientSideType.unselect:
                    element.style.outline = element.__savedOutline;
                    break;
                case ReceivedObjectClientSideType.ruleEdit:
                    element.style[obj.property] = obj.newValue;
                    break;
                case ReceivedObjectClientSideType.attributeEdit:
                    element.setAttribute(obj.attributeName, obj.attributeValue);
                    if (obj.attributeName && obj.attributeName.indexOf('on') === 0) {
                        element[obj.attributeName] = function () {
                            try { eval(obj.attributeValue); }
                            catch (e) { console.error(e); }
                        };
                    }
                    break;
                case ReceivedObjectClientSideType.valueEdit:
                    element.parentNode.innerHTML = obj.newValue;
                    break;
            }
        }

        public refresh(): void {
            this._packageAndSendDOM();
        }
        public refreshbyId(internaID: any): void {
            if (internaID)
                this._packageAndSendDOM(this._getElementByInternalId(internaID, document.body));
        }
        // DASHBOARD
        private _containerDiv: HTMLElement;
        private _treeDiv: HTMLElement;
        private _styleView: HTMLElement;
        private _attributesView: HTMLElement;
        private _dashboardDiv: HTMLDivElement;
        private _refreshButton: Element;

        public startDashboardSide(div: HTMLDivElement = null): void {
            this._dashboardDiv = div;

            this._insertHtmlContentAsync(this._dashboardDiv, (filledDiv) => {
                this._containerDiv = filledDiv;
                this._treeDiv = Tools.QuerySelectorById(filledDiv, "treeView");
                this._styleView = Tools.QuerySelectorById(filledDiv, "styleView");
                this._attributesView = Tools.QuerySelectorById(filledDiv, "attributesView");
                this._refreshButton = this._containerDiv.querySelector('x-action[event="refresh"]');

                this._containerDiv.addEventListener('refresh', () => {
                    this.sendToClient({
                        type: ReceivedObjectClientSideType.refresh,
                        order: null
                    });
                });

                this._treeDiv.addEventListener('click', function (e) {
                    var button = <HTMLElement>e.target;
                    if (button.className.match('treeNodeButton')) {
                        button.hasAttribute('data-collapsed') ? button.removeAttribute('data-collapsed') : button.setAttribute('data-collapsed', '');
                    }
                });

                this._treeDiv.addEventListener('mouseenter', (e) => {
                    var node = <HTMLElement>e.target;
                    var parent = node.parentElement;
                    var isHeader = node.className.match('treeNodeHeader');
                    if (isHeader || parent.className.match('treeNodeClosingText')) {
                        if (isHeader) {
                            parent.setAttribute('data-hovered-tag', '');
                        }
                        else {
                            parent.parentElement.parentElement.setAttribute('data-hovered-tag', '');
                        }
                    }
                }, true);

                this._treeDiv.addEventListener('mouseleave', (e) => {
                    var node = <HTMLElement>e.target;
                    if (node.className.match('treeNodeHeader') || node.parentElement.className.match('treeNodeClosingText')) {
                        var hovered = this._treeDiv.querySelector('[data-hovered-tag]')
                        if (hovered) hovered.removeAttribute('data-hovered-tag');
                    }
                }, true);

                $('.dom-explorer-container').split({
                    orientation: 'vertical',
                    limit: 50,
                    position: '70%'
                });
                $('#accordion').accordion({
                    heightStyle: "content"
                });

                this._ready = true;
            });
        }
        private _makeEditable(element: HTMLElement): void {
            element.contentEditable = "true";
            element.focus();
            Tools.AddClass(element, "editable");

            var range = document.createRange();
            range.setStart(element, 0);
            range.setEnd(element, 1);
            window.getSelection().addRange(range);
        }
        private _generateClickableAttributeValue(label: HTMLElement, value: string, internalId: string): HTMLElement {
            // Value
            var valueElement = document.createElement("div");
            valueElement.contentEditable = "false";
            valueElement.innerHTML = value || "&nbsp;";
            valueElement.className = "attributeValue";
            valueElement.addEventListener("keydown", (evt) => {
                if (evt.keyCode === 13 || evt.keyCode === 9) { // Enter or tab
                    //Create the properties object of elements.
                    var propertyObject: any = {};
                    propertyObject.property = label.innerHTML;
                    propertyObject.newValue = valueElement.innerHTML;
                    if (this._newAppliedAttributes[internalId] !== undefined) {
                        var propsArr = this._newAppliedAttributes[internalId];
                        //check if property exists in array
                        for (var index = 0; index < propsArr.length; index++) {
                            var propObj = propsArr[index];
                            if (propObj.property === propertyObject.property) {
                                propObj.newValue = propertyObject.newValue;
                                propertyObject = propObj;
                                propsArr.splice(index, 1);
                                break;
                            }
                        }
                        propsArr.push(propertyObject);
                    } else {
                        var proArr = [];
                        proArr.push(propertyObject);
                        this._newAppliedAttributes[internalId] = proArr;
                    }
                    this.sendToClient({
                        type: ReceivedObjectClientSideType.attributeEdit,
                        attributeName: label.innerHTML,
                        attributeValue: valueElement.innerHTML,
                        order: internalId
                    });
                    evt.preventDefault();
                    valueElement.contentEditable = "false";
                    Tools.RemoveClass(valueElement, "editable");
                }
            });

            valueElement.addEventListener("blur", () => {
                valueElement.contentEditable = "false";
                Tools.RemoveClass(valueElement, "editable");
            });


            valueElement.addEventListener("click", () => this._makeEditable(valueElement));

            return valueElement;
        }
        private _generateClickableValue(label: HTMLElement, value: string, internalId: string): HTMLElement {
            // Value
            var valueElement = document.createElement("div");
            valueElement.contentEditable = "false";
            valueElement.innerHTML = value || "&nbsp;";
            valueElement.className = "styleValue";
            valueElement.addEventListener("keydown", (evt) => {
                if (evt.keyCode === 13 || evt.keyCode === 9) { // Enter or tab
                    //Create the properties object of elements.
                    var propertyObject: any = {};
                    propertyObject.property = label.innerHTML;
                    propertyObject.newValue = valueElement.innerHTML;
                    if (this._newAppliedStyles[internalId] !== undefined) {
                        var propsArr = this._newAppliedStyles[internalId];
                        //check if property exists in array
                        for (var index = 0; index < propsArr.length; index++) {
                            var propObj = propsArr[index];
                            if (propObj.property === propertyObject.property) {
                                propObj.newValue = propertyObject.newValue;
                                propertyObject = propObj;
                                propsArr.splice(index, 1);
                                break;
                            }
                        }
                        propsArr.push(propertyObject);
                    } else {
                        var proArr = [];
                        proArr.push(propertyObject);
                        this._newAppliedStyles[internalId] = proArr;
                    }
                    this.sendToClient({
                        type: ReceivedObjectClientSideType.ruleEdit,
                        property: label.innerHTML,
                        newValue: valueElement.innerHTML,
                        order: internalId
                    });
                    evt.preventDefault();
                    valueElement.contentEditable = "false";
                    Tools.RemoveClass(valueElement, "editable");
                }
            });

            valueElement.addEventListener("blur", () => {
                valueElement.contentEditable = "false";
                Tools.RemoveClass(valueElement, "editable");
            });


            valueElement.addEventListener("click", () => this._makeEditable(valueElement));

            return valueElement;
        }
        // Generate styles for a selected node
        private _generateAttribute(attributeName: string, value: string, internalId: string, editableLabel = false): void {
            var wrap = document.createElement("div");
            wrap.className = 'attributeWrap';
            var label = document.createElement("div");
            label.innerHTML = attributeName;
            label.className = "attributeName";
            label.contentEditable = "false";
            var valueElement = this._generateClickableAttributeValue(label, value, internalId);
            wrap.appendChild(label);
            wrap.appendChild(valueElement);
            this._attributesView.appendChild(wrap);

            if (editableLabel) {
                label.addEventListener("blur", () => {
                    label.contentEditable = "false";
                    Tools.RemoveClass(label, "editable");
                });

                label.addEventListener("click", () => {
                    this._makeEditable(label);
                });

                label.addEventListener("keydown", (evt) => {
                    if (evt.keyCode === 13 || evt.keyCode === 9) { // Enter or tab
                        this._makeEditable(valueElement);
                        evt.preventDefault();
                    }
                });
            }
        }
        // Generate styles for a selected node
        private _generateStyle(property: string, value: string, internalId: string, editableLabel = false): void {
            var wrap = document.createElement("div");
            wrap.className = 'styleWrap';
            var label = document.createElement("div");
            label.innerHTML = property;
            label.className = "styleLabel";
            label.contentEditable = "false";
            var valueElement = this._generateClickableValue(label, value, internalId);
            wrap.appendChild(label);
            wrap.appendChild(valueElement);
            this._styleView.appendChild(wrap);

            if (editableLabel) {
                label.addEventListener("blur", () => {
                    label.contentEditable = "false";
                    Tools.RemoveClass(label, "editable");
                });

                label.addEventListener("click", () => {
                    this._makeEditable(label);
                });

                label.addEventListener("keydown", (evt) => {
                    if (evt.keyCode === 13 || evt.keyCode === 9) { // Enter or tab
                        this._makeEditable(valueElement);
                        evt.preventDefault();
                    }
                });
            }
        }
        private _generateStyles(styles: string[], internalId: string): void {
            while (this._styleView.hasChildNodes()) {
                this._styleView.removeChild(this._styleView.lastChild);
            }

            // Current styles
            for (var index = 0; index < styles.length; index++) {
                var style = styles[index];
                var splits = style.split(":");

                this._generateStyle(splits[0], splits[1], internalId);
            }
            if (this._newAppliedStyles[internalId]) {
                var newProps = this._newAppliedStyles[internalId];
                for (var index = 0; index < newProps.length; index++) {
                    var currentObj = newProps[index];
                    this._generateStyle(currentObj.property, currentObj.newValue, internalId);
                }
            }
            // Append add style button
            this._generateButton(this._styleView, "+", "styleButton").addEventListener('click', (e) => {
                this._generateStyle("property", "value", internalId, true);
                this._styleView.appendChild(<HTMLElement>e.target);
            });
        }
        private _generateAttributes(attributes: string[], internalId: string): void {
            while (this._attributesView.hasChildNodes()) {
                this._attributesView.removeChild(this._attributesView.lastChild);
            }

            // Current styles
            for (var index = 0; index < attributes.length; index++) {
                var att = attributes[index];
                this._generateAttribute(att[0], att[1], internalId);
            }
            if (this._newAppliedAttributes[internalId]) {
                var newProps = this._newAppliedAttributes[internalId];
                for (var index = 0; index < newProps.length; index++) {
                    var currentObj = newProps[index];
                    this._generateAttribute(currentObj.property, currentObj.newValue, internalId);
                }
            }
            // Append add style button
            this._generateButton(this._attributesView, "+", "styleButton").addEventListener('click', (e) => {
                this._generateAttribute("property", "value", internalId, true);
                this._attributesView.appendChild(<HTMLElement>e.target);
            });
        }
        private _appendSpan(parent: HTMLElement, className: string, value: string): void {
            var span = document.createElement("span");
            span.className = className;
            span.innerHTML = value;

            parent.appendChild(span);
        }
        private _generateColorfullLink(link: HTMLAnchorElement, receivedObject: any): void {
            this._appendSpan(link, "nodeName", receivedObject.name);
            var that = this;
            receivedObject.attributes.forEach(function (attr) {
                var node = document.createElement('span');
                node.className = 'nodeAttribute';
                var nodeName = document.createElement('span');
                nodeName.innerHTML = attr[0];

                var nodeValue = document.createElement('span');
                nodeValue.innerHTML = attr[1];
                node.appendChild(nodeName);
                node.appendChild(nodeValue);
                link.appendChild(node);
            });
        }
        private _generateColorfullClosingLink(link: HTMLElement, receivedObject: any): void {
            this._appendSpan(link, "nodeName", receivedObject.name);
        }
        private _generateButton(parentNode: HTMLElement, text: string, className: string, attribute?: any) {
            var button = document.createElement("button");
            button.innerHTML = text;
            button.className = className;
            if (attribute)
                button.setAttribute(attribute.name, attribute.value);
            button.setAttribute('button-block', '');
            return parentNode.appendChild(button);
        }
        private _spaceCheck = /[^\t\n\r ]/;
        private _generateTreeNode(parentNode: HTMLElement, receivedObject: any, first = false): void {
            if (receivedObject.type == 3) {
                if (this._spaceCheck.test(receivedObject.content)) {
                    var textNode = document.createElement('span');
                    textNode.className = 'nodeTextContent';
                    textNode.textContent = receivedObject.content.trim();
                    parentNode.appendChild(textNode);
                    textNode.contentEditable = "false";
                    textNode.addEventListener("click", () => this._makeEditable(textNode));
                    textNode.addEventListener("blur", () => {
                        this.sendToClient({
                            type: ReceivedObjectClientSideType.valueEdit,
                            newValue: textNode.innerHTML,
                            order: receivedObject.internalId
                        });
                        textNode.contentEditable = "false";
                        Tools.RemoveClass(textNode, "editable");
                    });
                    textNode.addEventListener("click", () => {
                        this._makeEditable(textNode);
                    });
                }
            }
            else {
                parentNode.setAttribute('data-has-children', '');

                var root = document.createElement("div");
                parentNode.appendChild(root);

                var container = document.createElement("div");
                container.className = 'nodeContentContainer';
                var btnAttribute = null;
                if (receivedObject.hasChildnodes) {
                    btnAttribute = { name: "data-collapsed", value: "" };
                    container.id = "vorlon-" + receivedObject.nodeId;
                }
                this._generateButton(root, "", "treeNodeButton", btnAttribute).addEventListener("click", () => {
                    if (receivedObject.hasChildnodes) {
                        this._clikedNodeID = receivedObject.internalId;
                        this.sendToClient({
                            type: ReceivedObjectClientSideType.refreshbyid,
                            internalID: receivedObject.internalId
                        });
                    }
                });

                // Main node
                var linkText = document.createElement("a");
                (<any>linkText).__targetInternalId = receivedObject.internalId;

                this._generateColorfullLink(linkText, receivedObject);

                linkText.addEventListener("click", () => {
                    if (this._previousSelectedNode) {
                        Tools.RemoveClass(this._previousSelectedNode, "treeNodeSelected");
                        this.sendToClient({
                            type: ReceivedObjectClientSideType.unselect,
                            order: (<any>this._previousSelectedNode).__targetInternalId
                        });
                    }
                    else {
                        this.sendToClient({
                            type: ReceivedObjectClientSideType.unselect,
                            order: null
                        });
                    }

                    Tools.AddClass(linkText, "treeNodeSelected");
                    this.sendToClient({
                        type: ReceivedObjectClientSideType.select,
                        order: receivedObject.internalId
                    });
                    this._generateAttributes(receivedObject.attributes, receivedObject.internalId);
                    this._generateStyles(receivedObject.styles, receivedObject.internalId);

                    this._previousSelectedNode = linkText;
                });

                linkText.href = "#";

                linkText.className = "treeNodeHeader";

                root.appendChild(linkText);
                root.className = first ? "firstTreeNodeText" : "treeNodeText";

                // Tools
                if (receivedObject.id) {
                    var toolsLink = document.createElement("a");
                    toolsLink.innerHTML = "#";
                    toolsLink.className = "treeNodeTools";
                    toolsLink.href = "#";

                    toolsLink.addEventListener("click", () => {
                        Core.Messenger.sendRealtimeMessage("CONSOLE", {
                            type: "order",
                            order: receivedObject.id
                        }, RuntimeSide.Client, "protocol");
                    });

                    root.appendChild(toolsLink);
                }

                // Children
                var nodes = receivedObject.children;
                if (nodes && nodes.length) {
                    for (var index = 0; index < nodes.length; index++) {
                        var child = nodes[index];
                        if (child.nodeType != 3) this._generateTreeNode(container, child);
                    }
                }
                if (receivedObject.name) {
                    var closingLink = document.createElement("div");
                    closingLink.className = "treeNodeClosingText";
                    this._generateColorfullClosingLink(closingLink, receivedObject);
                    container.appendChild(closingLink);
                }

                root.appendChild(container);
            }
        }
        private _insertReceivedObject(receivedObject: any, root: any) {
            if (root.internalId === this._clikedNodeID) {
                this._clikedNodeID = null;
                root = receivedObject;
                root.hasChildnodes = false;
                return root;
            }
            else {
                if (root.children && root.children.length) {
                    for (var index = 0; index < root.children.length; index++) {
                        var res = this._insertReceivedObject(receivedObject, root.children[index])
                        if (res) {
                            root.children[index] = res;
                            return root;
                        }
                    }
                }
            }

        }
        public onRealtimeMessageReceivedFromClientSide(receivedObject: any): void {
            if (receivedObject.action) {
                switch (receivedObject.action) {
                    case "dirtycheck":
                        if (this._lastContentState != receivedObject.rootHTML) {
                            this._refreshButton.setAttribute('changed', '');
                        }
                        else this._refreshButton.removeAttribute('changed');
                        break;
                }
            }
            else if (receivedObject.refreshbyId) {
                this._refreshButton.removeAttribute('changed');
                var b = this._insertReceivedObject(receivedObject, this._lastReceivedObject);
                while (this._treeDiv.hasChildNodes()) {
                    this._treeDiv.removeChild(this._treeDiv.lastChild);
                }
                this._generateTreeNode(this._treeDiv, this._lastReceivedObject, true);
            }
            else {
                this._refreshButton.removeAttribute('changed');
                this._lastContentState = receivedObject.rootHTML;
                this._lastReceivedObject = receivedObject;
                while (this._treeDiv.hasChildNodes()) {
                    this._treeDiv.removeChild(this._treeDiv.lastChild);
                }
                this._generateTreeNode(this._treeDiv, receivedObject, true);
            }
        }
    }
    enum ReceivedObjectClientSideType {
        unselect,
        select,
        dirtycheck,
        refresh,
        refreshbyid,
        valueEdit,
        ruleEdit,
        attributeEdit
    }
    class ReceivedObjectClientSide {
        public order: string;
        public type: ReceivedObjectClientSideType;
        public newValue: string;
        public attributeValue: string;
        public attributeName: string;
        public internalID: string;
        public property: string;
        constructor() { }
    }

    class PackagedNode {
        id: String;
        type: String;
        name: String;
        classes: String;
        content: String;
        attributes: Array<any>;
        styles: any;
        internalId: string;
        hasChildnodes: boolean;
        rootHTML: any;
        children: Array<any>;
        refreshbyId: boolean;
        constructor(node: any) {
            this.id = node.id;
            this.type = node.nodeType;
            this.name = node.localName;
            this.classes = node.className;
            this.content = node.textContent;
            this.attributes = node.attributes ? Array.prototype.map.call(node.attributes, function (attr) {
                return [attr.name, attr.value];
            }) : [];
            this.styles = this._getAppliedStyles(node);
            if (!node.__vorlon) {
                node.__vorlon = <any>{
                    internalId: VORLON.Tools.CreateGUID()
                };
            }
            this.internalId = node.__vorlon.internalId;
            this.children = [];
        }
        private _getAppliedStyles(node: HTMLElement): string[] {
            // Style sheets
            var styleNode = new Array<string>();
            var sheets = <any>document.styleSheets;
            var style: CSSStyleDeclaration;
            var appliedStyles = new Array<string>();

            for (var c = 0; c < sheets.length; c++) {

                var rules = sheets[c].rules || sheets[c].cssRules;

                if (!rules) {
                    continue;
                }

                for (var r = 0; r < rules.length; r++) {
                    var rule = rules[r];
                    var selectorText = rule.selectorText;

                    try {
                        var matchedElts = document.querySelectorAll(selectorText);

                        for (var index = 0; index < matchedElts.length; index++) {
                            var element = matchedElts[index];
                            style = rule.style;
                            if (element === node) {
                                for (var i = 0; i < style.length; i++) {
                                    if (appliedStyles.indexOf(style[i]) === -1) {
                                        appliedStyles.push(style[i]);
                                    }
                                }
                            }
                        }
                    }
                    catch (e) {
                        // Ignoring this rule - Angular.js, etc..
                    }
                }
            }

            // Local style
            style = node.style;
            if (style) {
                for (index = 0; index < style.length; index++) {
                    if (appliedStyles.indexOf(style[index]) === -1) {
                        appliedStyles.push(style[index]);
                    }
                }
            }

            // Get effective styles
            var winObject = document.defaultView || window;
            for (index = 0; index < appliedStyles.length; index++) {
                var appliedStyle = appliedStyles[index];
                if (winObject.getComputedStyle) {
                    styleNode.push(appliedStyle + ":" + winObject.getComputedStyle(node, "").getPropertyValue(appliedStyle));
                }
            }

            return styleNode;
        }

    }
    // Register
    Core.RegisterPlugin(new DOMExplorer());
}
