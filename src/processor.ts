interface ElementWithAttributes {
    element: Element;
    attributes: [string, string][];
    text: string;
}

export default class Processor {
    static BASE_RE = /\{\:[ ]*([^\}\n ][^\}\n]*)[ ]*\}/;
    static BLOCK_RE = /\n[ ]*\{\:?[ ]*([^\}\n ][^\}\n]*)[ ]*\}[ ]*$/;

    static parse(el: HTMLElement) {
        return new Processor().recurseAndParseElements(el);
    }

    /**
     * Traverses an elements child nodes and returns the text content.
     * @param el HTML element to get text nodes of.
     * @returns Top level text of the element.
     */
    private getTopLevelText(el: Element) {
        const texts = [];

        for (let child of Array.from(el.childNodes)) {
            if (child.nodeType == Node.TEXT_NODE) {
                texts.push((child as CharacterData).data);
            }
        }

        return texts.join("");
    }

    /**
     * Parse a string and return the [key, value] attribute pairs.
     * @param str String to pull attributes from.
     * @returns {[string, string]} Array of [key, value] attribute pairs.
     */
    private getAttrs(str: string) {
        const trys = (str ?? "")
            // Split the string at spaces that are *not* between quotes.
            .split(/\s(?=(?:[^'"`]*(['"`])[^'"`]*\1)*[^'"`]*$)/)
            // Trim the resulting strings.
            .map((t) => t && t.trim())
            // Remove any strings that are undefined, zero length, or just a quote character.
            .filter((t) => t && t !== '"' && t !== "'" && t.length);

        if (!trys || !trys.length) return;

        // These characters are not allowed to be inside an attribute key.
        const allowedKeyChars = /[^\t\n\f />"'=]/;

        // {: data=value }
        const keySeparator = "=";
        // { .class }
        const classChar = ".";
        // { #id }
        // currently not allowed due to Obsidian tag
        // TODO: Figure out a workaround.
        /* const idChar = "#"; */
        const attrs: Array<[string, string]> = [];

        for (let pair of trys) {
            if (!pair || !pair.length) continue;


            
            //#id
            /* if (pair.charAt(0) === idChar) {
                attrs.push(["id", pair.slice(1)]);
                continue;
            } */

            // .class
            if (pair.charAt(0) === classChar) {
                attrs.push(["class", pair.slice(1)]);
                continue;
            }

            // data=value
            if (
                new RegExp(keySeparator).test(pair) &&
                allowedKeyChars.test(pair.slice(0, pair.indexOf(keySeparator)))
            ) {
                attrs.push([...pair.split(keySeparator, 2)] as [
                    string,
                    string
                ]);
                continue;
            }

            // checked
            attrs.push([pair, null]);
        }
        return attrs;
    }

    /**
     *
     * @param el HTML element to parse.
     * @returns {ElementWithAttributes} Element, attributes to apply, original matched text.
     */
    private recurseAndParseElements(el: HTMLElement): ElementWithAttributes[] {
        const elements: ElementWithAttributes[] = [];

        // Text content of this node and *not* the children.
        const text = this.getTopLevelText(el);

        if (Processor.BLOCK_RE.test(text)) {
            // Attributes should apply to the whole block.
            let [original, attribute_string] =
                text.match(Processor.BASE_RE) ?? [];
            elements.push({
                element: el,
                attributes: this.getAttrs(attribute_string),
                text: attribute_string
            });
            el.innerHTML = el.innerHTML.replace(original, "");
        } else if (Processor.BASE_RE.test(text)) {
            // Attributes are inline.

            // Get the text nodes that contains the attribute string.
            let textNode = Array.from(el.childNodes).find(
                (node) =>
                    node.nodeType == Node.TEXT_NODE &&
                    Processor.BASE_RE.test(text)
            );

            // Find the HTML element that is the previous sibling of the text node.
            // textNode.previousSibling could return another text node.
            // previousElementSibling does not existing on a text node.
            let sibling =
                Array.from(el.children).find(
                    (node) => node.nextSibling == textNode
                ) ?? el;

            // Collapsible elements are a special case due to the collapse handle.
            if (sibling && sibling.hasClass("collapse-indicator")) {
                sibling = sibling.parentElement;
            }

            if (sibling && sibling instanceof HTMLBRElement) {
                sibling = sibling.parentElement;
            }

            // Parse out the attribute string.
            let [original, attribute_string] =
                text.match(Processor.BASE_RE) ?? [];

            elements.push({
                element: sibling,
                attributes: this.getAttrs(attribute_string),
                text: attribute_string
            });

            // Remove the original attribute string from the text content.
            textNode.textContent = textNode.textContent.replace(original, "");
        }

        // Recursively find all attributes from the children of this element.
        for (let child of Array.from(el.children)) {
            if (!(child instanceof HTMLElement)) continue;
            elements.push(...this.recurseAndParseElements(child));
        }

        return elements;
    }
}